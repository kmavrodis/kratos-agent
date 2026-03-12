---
name: rag-search
description: Azure AI Search knowledge base for grounded answers and document retrieval
---

## Instructions

1. Accept a natural language query from the user or agent.
2. Convert the query into a vector embedding using the configured embedding model.
3. Perform a hybrid search (semantic + keyword) against Azure AI Search.
4. Return the top 5 relevant documents with:
   - Document title
   - Relevance score
   - Content excerpt (max 500 characters)
   - Source metadata (filename, page number, etc.)
5. Format results as structured JSON for the agent to incorporate.

## Scripts

Run `scripts/search.py` with the `query` parameter from the user prompt.
