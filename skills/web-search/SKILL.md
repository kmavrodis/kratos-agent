---
name: web-search
description: Real-time internet search for current information and market data
---

## Instructions

1. Accept a natural language search query from the user or agent.
2. Use the Bing Search API (via Azure Cognitive Services) to find relevant results.
3. Return the top 5 results with:
   - Title
   - URL
   - Snippet / description
   - Published date (if available)
4. Summarize the key findings for the agent to use in its response.

## Scripts

Run `scripts/search.py` with the `query` parameter from the user prompt.
