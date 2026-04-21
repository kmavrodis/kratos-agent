---
name: web-search
description: Real-time internet search for banking rates, financial news, and regulatory updates
enabled: true
---

# Web Search Skill

## Instructions

When the user asks about current interest rates, financial news, competitor comparisons, regulatory updates, or anything requiring up-to-date information, use the `web_search` tool.

### How It Works

The web search tool uses the **Microsoft Foundry Responses API** with `web_search_preview`, powered by Bing Grounding. It returns real-time web results with **URL citations** so responses are grounded in verifiable sources.

### When to Use

- Current market interest rates (Fed funds rate, prime rate, treasury yields)
- Competitor bank rate comparisons
- Financial news and economic developments
- Banking regulation updates
- Consumer financial protection information
- Real-time exchange rates
- Any query where the user explicitly asks to "search" or "look up" something

### Banking-Specific Search Tips

- For rates: search "[bank name] savings rate" or "best CD rates [month] [year]"
- For regulations: search "FDIC" / "CFPB" + topic
- For comparisons: search "best [product type] accounts [year]"

### Response Guidelines

- Always include **source URLs** from the citations returned by the tool
- Present financial data with proper formatting (rates as percentages, currencies with symbols)
- Note the date/time of rate information — rates change frequently
- If the search returns no relevant results, suggest refining the query
- Do not fabricate URLs — only use citations returned by the tool
- Include a disclaimer when presenting rate comparisons: "Rates shown are for informational purposes and may vary. Contact the institution for current rates and eligibility."
