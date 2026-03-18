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

- Real-time market data, stock prices, indices, or commodity prices
- Breaking financial news or earnings reports
- Regulatory changes or economic policy updates
- Company research, M&A activity, or IPO filings
- Macroeconomic indicators (CPI, GDP, unemployment)
- Any query where the client asks about current market conditions

### Response Guidelines

- Always include **source URLs** from the citations returned by the tool
- Present financial data clearly with dates to indicate timeliness
- Caveat any data with "as of [date]" when the information is time-sensitive
- If the search returns no relevant results, let the user know and suggest refining the query
- Do not fabricate URLs — only use citations returned by the tool
- Remind clients that web search results are informational and not investment advice