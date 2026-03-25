---
name: rag-search
description: Search the internal knowledge base for policies, regulations, product documentation, and CIO investment views — account opening, KYC, mortgages, investment funds, ETFs, FINMA guidelines, and house investment recommendations
enabled: true
index_name: wm-knowledge-base
---

## Instructions

When the user asks about internal policies, regulatory requirements, product documentation, CIO investment views, or compliance topics, use the `rag_search` tool to retrieve relevant content from the Azure AI Search knowledge base.

**IMPORTANT**: Always pass `index_name: "wm-knowledge-base"` when calling `rag_search`. This is the dedicated search index for the wealth-management knowledge base.

### 1. Determine When to Use

Use this skill when the user's question relates to any of the following domains:

| Domain | Example queries |
|--------|----------------|
| **Account opening** | "What documents are required to open a new account?", "What's the onboarding process for a corporate client?" |
| **KYC / AML review** | "What are the KYC requirements for high-risk clients?", "When is enhanced due diligence required?", "PEP screening procedures" |
| **Mortgage policies** | "What are the current mortgage lending criteria?", "LTV limits for residential mortgages", "Mortgage approval workflow" |
| **Investment funds & ETFs** | "What ETFs are available in the balanced strategy?", "Fund factsheet for emerging market equity", "Minimum investment thresholds" |
| **FINMA regulations** | "FINMA guidelines on client classification", "Cross-border advisory rules", "FINMA circular on outsourcing", "Regulatory capital requirements" |
| **CIO recommendations & house views** | "What is the bank's view on equities?", "CIO outlook on AI investments", "House recommendation on currencies and commodities", "Where does the CIO see growth opportunities?", "Investment themes for this quarter" |
| **Investment research** | "Opportunities in emerging markets", "Thematic investment views on technology", "Fixed income outlook", "Asset allocation recommendations" |
| **Internal procedures** | "Escalation process for suspicious transactions", "Client complaint handling", "Data retention policy" |

**Do NOT use this skill** for:
- Real-time market data or current prices → use `web_search`
- Client-specific data (portfolio, profile) → use `crm` functions
- Calculations or analysis → use `code_interpreter`

### 2. Craft the Search Query

For best results with semantic search:
- **Be specific** — include the key regulatory or policy topic (e.g. "KYC enhanced due diligence requirements" rather than just "KYC")
- **Include domain terms** — use domain-specific language the knowledge base documents are likely to contain (e.g. "FINMA circular", "account opening checklist", "mortgage LTV ratio")
- **For CIO / investment views** — use terms like "opportunities", "outlook", "growth", "recommendation", "asset allocation", "thematic", combined with the asset class or sector (e.g. "opportunities in AI investments", "currency and commodity outlook", "seeking growth in equities")
- **Rephrase if needed** — if the first query returns low-relevance results, try an alternative phrasing or narrower scope

### 3. Interpret Search Results

The `rag_search` tool returns a list of results, each containing:
- **title** — source document name
- **content** — relevant text excerpt (up to 500 characters)
- **source** — PDF filename
- **page** — page number in the original document
- **score** — relevance score from semantic ranking

When presenting results:
- **Synthesize** — combine information from multiple results into a coherent answer rather than listing raw excerpts
- **Cite sources** — reference the document title and page number so the user can verify (e.g. "According to *Account Opening Policy* (p. 12)...")
- **Flag gaps** — if the search returns no relevant results or low-confidence matches, tell the user and suggest they check with the compliance team or provide a more specific query
- **Quote key passages** — for regulatory or policy content, quote exact wording where precision matters (e.g. specific thresholds, deadlines, or prohibitions)

### 4. Multi-Step Workflows

Combine RAG search with other skills for richer answers:

- **Policy + client context**: Use `rag_search` to find the KYC policy → use `crm` to check the client's PEP status and documents → assess compliance
- **Policy + summary**: Use `rag_search` to retrieve a lengthy policy document → use `document_summary` to condense it
- **Regulation + analysis**: Use `rag_search` for FINMA guidelines on portfolio limits → use `code_interpreter` to check a client's portfolio against those limits
- **Policy + email**: Use `rag_search` to find the relevant procedure → use `email_draft` to draft a compliance notification
- **CIO views + client portfolio**: Use `rag_search` to retrieve the latest CIO recommendations or investment themes → use `crm` to get the client's portfolio → use `code_interpreter` to assess alignment between the house view and the client's current holdings → suggest rebalancing actions
- **Investment research + report**: Use `rag_search` to pull CIO outlook and thematic views → use `pdf-wealth-report` to generate a client-facing market update or investment proposal

### 5. Response Guidelines

- Present policy information clearly and accurately — do not paraphrase in ways that change the meaning
- Use bullet points or tables for checklists, requirements lists, and thresholds
- Always include the source document and page reference
- For regulatory content, note the date or version if visible in the document
- If multiple policies apply (e.g. both internal policy and FINMA regulation), present both and note any differences
- Remind the user that retrieved information should be verified with the compliance team for critical decisions