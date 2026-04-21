---
name: web-search
description: Real-time internet search
enabled: true
---

# Web Search Skill

## Instructions

When the user asks about current events, live data, recent news, or anything that requires up-to-date information beyond your training cutoff, use the `web_search` tool.

### How It Works

The web search tool uses the **Microsoft Foundry Responses API** with `web_search_preview`, powered by Bing Grounding. It returns real-time web results with **URL citations** so responses are grounded in verifiable sources.

### When to Use

- Current events, breaking news, or recent developments
- Live market data, stock prices, or financial news
- Weather, sports scores, or time-sensitive information
- Verifying facts that may have changed since training
- Researching companies, people, or topics the user asks about
- Any query where the user explicitly asks to "search the web"

### Response Guidelines

- Always include **source URLs** from the citations returned by the tool
- Present information as concise bullet points or a brief summary
- Caveat any time-sensitive data with "as of [date]" when the information may change
- If the search returns no relevant results, let the user know and suggest refining the query
- Do not fabricate URLs — only use citations returned by the tool

### Error Handling

If web search returns an error or no results:
- Report the issue transparently to the user
- Suggest alternative search terms or a narrower query
- Do not fall back to generating an answer from memory when the user explicitly asked for a web search
- Do not fabricate URLs — only use citations returned by the tool