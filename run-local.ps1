#!/usr/bin/env pwsh
# Bootstrap kratos-agent in fully local mode (Azurite + SQLite).
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.local.example" ".env.local"
    Write-Host "Created .env.local from template." -ForegroundColor Yellow
    Write-Host "Edit .env.local and set COPILOT_GITHUB_TOKEN before continuing." -ForegroundColor Yellow
    exit 1
}

docker compose --env-file .env.local up --build
