"""OpenTelemetry setup for distributed tracing and metrics."""

import logging
import os

from opentelemetry import metrics, trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.config import Settings

logger = logging.getLogger(__name__)

# GenAI metric bucket boundaries per OTel semantic conventions
_TOKEN_BUCKETS = (1, 4, 16, 64, 256, 1024, 4096, 16384, 65536, 262144, 1048576, 4194304, 16777216, 67108864)
_DURATION_BUCKETS = (0.01, 0.02, 0.04, 0.08, 0.16, 0.32, 0.64, 1.28, 2.56, 5.12, 10.24, 20.48, 40.96, 81.92)


def setup_telemetry(settings: Settings) -> None:
    """Configure OpenTelemetry with Azure Monitor exporter and OpenAI SDK instrumentation."""
    resource = Resource.create(
        {
            "service.name": settings.otel_service_name,
            "service.version": "0.1.0",
            "deployment.environment": settings.environment,
        }
    )

    provider = TracerProvider(resource=resource)

    if settings.applicationinsights_connection_string:
        try:
            from azure.monitor.opentelemetry.exporter import (
                AzureMonitorMetricExporter,
                AzureMonitorTraceExporter,
            )

            # Traces
            exporter = AzureMonitorTraceExporter(
                connection_string=settings.applicationinsights_connection_string
            )
            provider.add_span_processor(BatchSpanProcessor(exporter))
            logger.info("Azure Monitor trace exporter configured")

            # Metrics
            metric_exporter = AzureMonitorMetricExporter(
                connection_string=settings.applicationinsights_connection_string
            )
            metric_reader = PeriodicExportingMetricReader(metric_exporter, export_interval_millis=60000)
            meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
            metrics.set_meter_provider(meter_provider)
            logger.info("Azure Monitor metric exporter configured")
        except Exception:
            logger.warning("Failed to configure Azure Monitor exporter — traces/metrics will be local only")

    trace.set_tracer_provider(provider)

    # Auto-instrument FastAPI
    FastAPIInstrumentor().instrument(tracer_provider=provider)

    # Instrument OpenAI SDK for Foundry model call tracing
    try:
        from opentelemetry.instrumentation.openai_v2 import OpenAIInstrumentor

        OpenAIInstrumentor().instrument(tracer_provider=provider)
        logger.info("OpenAI SDK tracing instrumented")
    except Exception:
        logger.warning("Failed to instrument OpenAI SDK — model call traces will not be captured")

    # Enable GenAI content recording if the env var is set
    if os.environ.get("AZURE_TRACING_GEN_AI_CONTENT_RECORDING_ENABLED", "").lower() == "true":
        logger.info("GenAI content recording enabled — prompts and completions will be captured in traces")

    logger.info("OpenTelemetry initialized — service=%s", settings.otel_service_name)


# ── GenAI Metrics ────────────────────────────────────────────────────────────
# Expose histograms per OTel GenAI semantic conventions so copilot_agent.py can
# record token usage and operation duration without coupling to the exporter setup.

_meter = metrics.get_meter("kratos-agent", "0.1.0")

token_usage_histogram = _meter.create_histogram(
    name="gen_ai.client.token.usage",
    description="Number of input and output tokens used",
    unit="{token}",
)

operation_duration_histogram = _meter.create_histogram(
    name="gen_ai.client.operation.duration",
    description="GenAI operation duration",
    unit="s",
)
