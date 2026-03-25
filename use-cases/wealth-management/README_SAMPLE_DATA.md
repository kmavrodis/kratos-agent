# Sample Data Ingestion for RAG Search

This guide explains how to ingest the PDF documents in `sample-data/` into Azure AI Search so the **rag-search** skill can retrieve them at runtime.

## Prerequisites

- Azure AI Search resource provisioned (part of `azd up`)
- Azure Foundry / AI Services resource provisioned
- `az login` completed (DefaultAzureCredential)
- **Search Index Data Contributor** role on the AI Search resource

## 1. Deploy an Embedding Model

In your Foundry project (Azure AI Studio), manually deploy a text embedding model:

1. Go to **Azure AI Foundry** → your project → **Deployments**
2. Click **Deploy model** → choose **text-embedding-ada-002** (or **text-embedding-3-small**)
3. Note the **deployment name** (e.g. `text-embedding-ada-002`)

## 2. Configure the Ingester

Edit the configuration variables at the top of `src/backend/app/services/ai_search_tools.py`:

| Variable | Location | What to set |
|----------|----------|-------------|
| `AI_SEARCH_ENDPOINT` | `_get_ai_search_endpoint()` default | Your search endpoint, e.g. `https://srch-xxxxx.search.windows.net` |
| `EMBEDDING_DEPLOYMENT` | Module-level constant | The deployment name from step 1 (e.g. `text-embedding-ada-002`) |
| `FOUNDRY_ENDPOINT` | `_generate_embeddings()` default | Your Foundry endpoint, e.g. `https://oai-xxxxx.services.ai.azure.com/...` |
| `EMBEDDING_DIMENSIONS` | Module-level constant | `1536` for ada-002 / embedding-3-small, `3072` for embedding-3-large |

These can also be set as environment variables instead of editing the file.

## 3. PDF Files Location

Sample PDFs are located in:

```
use-cases/wealth-management/sample-data/
```

Contents:
- `FINMA KYC Periodic Review Guidelines for Individuals.pdf` — FINMA KYC/AML policies
- `SwissMortgagePolicyIndividuals.pdf` — Mortgage lending policies
- `MR_DE_*.pdf` — Investment fund / ETF factsheets (iShares, etc.)
- `ai-opportunities-1.pdf`, `seeking-growth-in-investments-1.pdf`, etc. — Investment research

The ingester automatically picks up all `*.pdf` files from this folder.

## 4. Run the Ingestion

From `src/backend/`, run these three commands in order:

```bash
# Step 1 — Create the search index (with vector field)
python3 -m app.services.ai_search_tools create-index wm-knowledge-base

# Step 2 — Ingest all PDFs (extracts text, chunks, generates embeddings, uploads)
python3 -m app.services.ai_search_tools ingest wm-knowledge-base

# Step 3 (optional) — If you need to start over, delete and recreate
python3 -m app.services.ai_search_tools delete-index wm-knowledge-base
```

The `ingest` command is **idempotent** — re-running it updates existing documents rather than creating duplicates.

## 5. Verify

After ingestion, the output should show all chunks uploaded successfully:

```
INFO — Ingestion complete — index=wm-knowledge-base pdfs=12 chunks=52 uploaded=52 failed=0 vectors=True
```

You can also verify in the Azure Portal → AI Search → `wm-knowledge-base` → Search explorer.
