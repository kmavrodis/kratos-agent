---
name: web-search
description: Real-time internet search for weather events, regulatory notices, carrier news, and insurance industry updates
enabled: true
---

# Web Search Skill

## Instructions

When the user asks about current events, external information, or anything that requires up-to-date data beyond your training cutoff, use the `web_search` tool.

### How It Works

The web search tool uses the **Microsoft Foundry Responses API** with `web_search_preview`, powered by Bing Grounding. It returns real-time web results with **URL citations** so responses are grounded in verifiable sources.

### When to Use

- **Weather and catastrophe events**: Active storms, hurricanes, wildfires, flooding — check severity, path, and affected regions
- **Regulatory notices**: State insurance department bulletins, NAIC updates, new compliance requirements
- **Carrier news**: Insurer financial strength ratings (AM Best, S&P), mergers, market exits, rate filings
- **Fraud alerts**: Insurance fraud trends, schemes, and law enforcement actions
- **Legislative changes**: New insurance laws, coverage mandates, consumer protection updates
- **Market conditions**: Reinsurance market trends, catastrophe loss reports, industry benchmarks

### Response Guidelines

- Always include **source URLs** from the citations returned by the tool
- Caveat any time-sensitive data with "as of [date]" — weather and regulatory situations change rapidly
- Distinguish between confirmed facts and forecasts/projections
- If the search returns no relevant results, let the user know and suggest refining the query
- Do not fabricate URLs — only use citations returned by the tool
- Clearly label external information as such, separate from internal policy guidance (which comes from `rag_search`)

### Error Handling

If web search returns an error or no results:
- Report the issue transparently to the user
- Suggest alternative search terms or a narrower query
- Do not fall back to generating an answer from memory
- If the search returns no relevant results, let the user know and suggest refining the query
- Do not fabricate URLs — only use citations returned by the tool
- Remind clients that web search results are informational and not investment advice