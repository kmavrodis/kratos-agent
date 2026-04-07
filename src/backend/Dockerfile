FROM python:3.11-slim

WORKDIR /app

# Install system dependencies and Node.js 20 (required for Copilot CLI and MCP servers)
# Use NodeSource binary to avoid the heavy Debian nodejs+npm apt packages
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

RUN npm install -g @github/copilot faker-mcp-server \
    && rm -rf /root/.npm /tmp/*

# Install Playwright Chromium and its system dependencies for PDF rendering
RUN npx -y playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* /tmp/*

# Copy backend application
COPY src/backend/ .

# Install dependencies
RUN pip install --no-cache-dir .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
