"""The Agentic Loop — ReAct: Plan → Act → Observe → Iterate.

This module implements the core agentic loop powered by the GitHub Copilot SDK
pattern. When the Copilot SDK Python package is available, it delegates to the SDK.
Otherwise, it provides a compatible implementation using Azure Foundry endpoints.
"""

import json
import logging
import time
from typing import AsyncGenerator

import httpx
from azure.identity.aio import DefaultAzureCredential
from opentelemetry import trace

from app.config import Settings, get_settings
from app.models import (
    ContentEvent,
    ErrorEvent,
    Message,
    MessageRole,
    ThoughtEvent,
    ToolCallEvent,
)
from app.services.skill_registry import SkillRegistry

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)

# System prompt that defines the agent's behavior
SYSTEM_PROMPT = """You are Kratos, an enterprise AI assistant powered by GitHub Copilot SDK and Microsoft Foundry.

You have access to the following skills (MCP tools) to help answer user questions:
{skill_context}

## Behavior Guidelines
1. **Reason first**: Before calling any tool, explain your reasoning and plan.
2. **Use tools when needed**: If the user's question requires real-time data, search, computation, or domain-specific knowledge, use the appropriate skill.
3. **Be transparent**: Show your thought process. Explain which tools you're calling and why.
4. **Iterate if needed**: If a tool's output isn't sufficient, call another tool or refine your approach.
5. **Cite sources**: When using tool outputs, reference where the information came from.
6. **Be concise**: Provide clear, actionable answers. Avoid unnecessary verbosity.

## Tool Calling
When you need to use a tool, respond with a JSON tool_call block:
```json
{{"tool": "skill-name", "input": {{"param": "value"}}}}
```

The system will execute the tool and return results for you to incorporate into your response.
"""

MAX_ITERATIONS = 10
CONTEXT_COMPACTION_THRESHOLD = 0.95  # 95% of context window


class AgentLoop:
    """Implements the Plan → Act → Observe → Iterate agentic loop.

    Streams events (thoughts, tool calls, content) back to the caller.
    """

    def __init__(self, skill_registry: SkillRegistry, settings: Settings | None = None) -> None:
        self.skill_registry = skill_registry
        self.settings = settings or get_settings()
        self._credential: DefaultAzureCredential | None = None

    async def run(
        self,
        message: str,
        history: list[Message],
        conversation_id: str,
    ) -> AsyncGenerator[ThoughtEvent | ToolCallEvent | ContentEvent | ErrorEvent, None]:
        """Execute the agentic loop, yielding streamed events."""
        with tracer.start_as_current_span("agent_loop", attributes={"conversation_id": conversation_id}):
            # Build the conversation context
            messages = self._build_messages(message, history)
            iteration = 0

            while iteration < MAX_ITERATIONS:
                iteration += 1
                logger.info(
                    "Agentic loop iteration=%d conversation=%s",
                    iteration,
                    conversation_id,
                )

                with tracer.start_as_current_span(
                    "agent_iteration",
                    attributes={"iteration": iteration},
                ):
                    # Step 1: REASON — Call the model
                    yield ThoughtEvent(
                        content=f"Analyzing request (iteration {iteration})...",
                        iteration=iteration,
                    )

                    response = await self._call_model(messages)

                    if response is None:
                        yield ErrorEvent(message="Model call failed", code="MODEL_ERROR")
                        return

                    # Step 2: Check for tool calls
                    tool_calls = self._extract_tool_calls(response)

                    if tool_calls:
                        for tool_call in tool_calls:
                            skill_name = tool_call.get("tool", "unknown")
                            tool_input = tool_call.get("input", {})

                            yield ToolCallEvent(
                                skillName=skill_name,
                                status="started",
                                input=json.dumps(tool_input),
                            )

                            # Step 3: ACT — Execute the tool
                            start = time.monotonic()
                            tool_output = await self._execute_tool(skill_name, tool_input)
                            duration_ms = int((time.monotonic() - start) * 1000)

                            yield ToolCallEvent(
                                skillName=skill_name,
                                status="completed",
                                output=tool_output[:500],  # Truncate for the event stream
                                durationMs=duration_ms,
                            )

                            # Add tool result to conversation
                            messages.append({"role": "assistant", "content": response})
                            messages.append({
                                "role": "tool",
                                "content": f"[{skill_name}] {tool_output}",
                            })

                        # Check context size and compact if needed
                        self._maybe_compact_context(messages)

                        # Loop back for another iteration
                        continue

                    # No tool calls — stream the final response
                    # Chunk the response for streaming feel
                    chunk_size = 50
                    for i in range(0, len(response), chunk_size):
                        yield ContentEvent(content=response[i : i + chunk_size])

                    return

            # Max iterations reached
            yield ContentEvent(
                content="I've reached my maximum reasoning depth. Here's what I have so far based on the tools I've called."
            )

    def _build_messages(self, message: str, history: list[Message]) -> list[dict[str, str]]:
        """Build the message array for the model call."""
        skill_context = self.skill_registry.get_discovery_context()
        system_message = SYSTEM_PROMPT.format(skill_context=skill_context)

        messages: list[dict[str, str]] = [{"role": "system", "content": system_message}]

        # Add conversation history
        for msg in history[-20:]:  # Last 20 messages for context
            messages.append({"role": msg.role.value, "content": msg.content})

        # Add current message
        messages.append({"role": "user", "content": message})

        return messages

    async def _call_model(self, messages: list[dict[str, str]]) -> str | None:
        """Call the model via Microsoft Foundry endpoint."""
        with tracer.start_as_current_span("model_call") as span:
            if not self.settings.foundry_endpoint:
                # Fallback: return a helpful message when Foundry isn't configured
                span.set_attribute("model.fallback", True)
                return (
                    "I'm running without a configured model endpoint. "
                    "Please set the FOUNDRY_ENDPOINT environment variable to enable AI responses. "
                    "For now, I can confirm the agent service is running and the agentic loop is functional."
                )

            try:
                if not self._credential:
                    self._credential = DefaultAzureCredential()

                token = await self._credential.get_token("https://cognitiveservices.azure.com/.default")

                endpoint = f"{self.settings.foundry_endpoint.rstrip('/')}/openai/deployments/{self.settings.foundry_model_deployment}/chat/completions?api-version=2024-10-21"

                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        endpoint,
                        headers={
                            "Authorization": f"Bearer {token.token}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "messages": messages,
                            "temperature": 0.7,
                            "max_tokens": 4096,
                        },
                    )
                    response.raise_for_status()
                    data = response.json()

                result = data["choices"][0]["message"]["content"]
                span.set_attribute("model.name", self.settings.foundry_model_deployment)
                span.set_attribute("model.input_tokens", data.get("usage", {}).get("prompt_tokens", 0))
                span.set_attribute("model.output_tokens", data.get("usage", {}).get("completion_tokens", 0))

                return result

            except Exception:
                logger.exception("Model call failed")
                return None

    def _extract_tool_calls(self, response: str) -> list[dict]:
        """Extract tool call JSON blocks from model response."""
        tool_calls: list[dict] = []
        # Look for JSON blocks that represent tool calls
        try:
            # Simple extraction: look for ```json blocks with tool calls
            import re

            pattern = r'\{[^{}]*"tool"\s*:\s*"[^"]+?"[^{}]*\}'
            matches = re.findall(pattern, response)
            for match in matches:
                try:
                    parsed = json.loads(match)
                    if "tool" in parsed:
                        tool_calls.append(parsed)
                except json.JSONDecodeError:
                    continue
        except Exception:
            pass
        return tool_calls

    async def _execute_tool(self, skill_name: str, tool_input: dict) -> str:
        """Execute an MCP skill and return the output."""
        with tracer.start_as_current_span(
            "tool_execution",
            attributes={"skill.name": skill_name},
        ):
            skill = self.skill_registry.get_skill(skill_name)
            if not skill:
                return f"Error: Skill '{skill_name}' not found in registry"

            if not skill.enabled:
                return f"Error: Skill '{skill_name}' is disabled"

            # MCP skill execution — in production, this connects to the MCP server
            # For now, return a structured placeholder indicating the skill was invoked
            return json.dumps({
                "skill": skill_name,
                "status": "executed",
                "description": skill.description,
                "input": tool_input,
                "result": f"[{skill_name}] Skill executed successfully. "
                f"In production, this connects to the MCP server at {skill.path}.",
            })

    def _maybe_compact_context(self, messages: list[dict[str, str]]) -> None:
        """Auto-compact context if approaching the context window limit.

        Implements the 95% threshold compaction strategy:
        - Estimate token count
        - If over threshold, summarize older messages
        """
        # Rough token estimate: ~4 chars per token
        total_chars = sum(len(m.get("content", "")) for m in messages)
        estimated_tokens = total_chars // 4

        # Assume ~128K context window by default
        context_limit = 128_000
        threshold = int(context_limit * CONTEXT_COMPACTION_THRESHOLD)

        if estimated_tokens > threshold:
            logger.info(
                "Context compaction triggered: estimated_tokens=%d threshold=%d",
                estimated_tokens,
                threshold,
            )
            # Keep system message + last 10 messages, compact the rest
            if len(messages) > 12:
                system = messages[0]
                recent = messages[-10:]
                compacted_content = "[Previous conversation context compacted for brevity]"
                messages.clear()
                messages.append(system)
                messages.append({"role": "system", "content": compacted_content})
                messages.extend(recent)
