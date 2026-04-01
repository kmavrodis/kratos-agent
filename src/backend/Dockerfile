FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including Node.js 20 (required for Copilot CLI and MCP servers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    nodejs \
    npm \
    && npm install -g @github/copilot faker-mcp-server \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy backend application
COPY src/backend/ .

# Install dependencies
RUN pip install --no-cache-dir .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
