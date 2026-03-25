"""Application configuration via environment variables and Azure Key Vault."""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    All production secrets are accessed via Managed Identity — no secrets in code.
    """

    # Azure service endpoints (set by Bicep / azd)
    cosmos_db_endpoint: str = ""
    ai_search_endpoint: str = ""
    key_vault_uri: str = ""

    # Microsoft Foundry (deployed by Bicep)
    foundry_endpoint: str = ""
    foundry_model_deployment: str = "gpt-51"
    foundry_project_name: str = ""

    # Azure Blob Storage for skills
    blob_storage_endpoint: str = ""
    blob_skills_container: str = "skills"

    # Observability
    applicationinsights_connection_string: str = ""
    otel_service_name: str = "kratos-agent-service"

    # Server
    host: str = "0.0.0.0"  # noqa: S104
    port: int = 8000
    environment: str = "development"

    # Cosmos DB database
    cosmos_db_database: str = "kratos-agent"

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
