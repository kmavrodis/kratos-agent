---
name: rag-search
description: Azure AI Search knowledge base
enabled: true
index_name: knowledge-base
---

# RAG Search Skill

## Instructions

When the user asks about internal policies, documentation, procedures, or knowledge base content, use the `rag_search` tool to retrieve relevant content from the Azure AI Search knowledge base.

**IMPORTANT**: Always pass `index_name: "knowledge-base"` when calling `rag_search`. This is the dedicated search index for the generic knowledge base.

### 1. When to Use

Use this skill when the user's question relates to:
- Internal documentation, policies, or procedures
- Product or service information stored in the knowledge base
- Reference material, FAQs, or how-to guides
- Any question that should be grounded in authoritative internal content

**Do NOT use** for: real-time web data (→ `web_search`), calculations (→ `code_interpreter`).

### 2. Craft the Search Query

- Be specific with domain terms rather than generic phrases
- Include the key concept and context (e.g., "onboarding process new employee" rather than just "onboarding")
- If the first query returns low-relevance results, rephrase with synonyms or more specific terms

### 3. Interpret Search Results

Results contain: title, content, source, page, relevance score.

- **Synthesize** multiple results into a coherent answer rather than dumping raw excerpts
- **Cite sources** with document title and page number (e.g., "Per the *Employee Handbook*, p. 12...")
- **Quote exact wording** when precision matters (policies, procedures, requirements)
- **Flag gaps** — if the retrieved content doesn't fully answer the question, say so explicitly
- **Note confidence** — if results have low relevance scores, mention that the information may not be complete

### 4. Multi-Step Workflows

Combine RAG search with other skills for richer answers:

- **Knowledge + summary**: `rag_search` → `document_summary` to condense retrieved content
- **Knowledge + analysis**: `rag_search` → `code_interpreter` to analyze data referenced in docs
- **Knowledge + web verification**: `rag_search` → `web_search` to check if internal info is still current
- **Knowledge + email**: `rag_search` → `email_draft` to compose a response grounded in policy

### 5. Response Guidelines

- Present information clearly and accurately — do not paraphrase in ways that change the meaning
- Use bullet points or tables for structured information
- Always include the source document and page reference
- If multiple documents are relevant, present findings from each and note any differences
- If no relevant results are found, say so clearly and suggest the user refine their query

### 6. Error Handling

If the search returns an error or no results:
- Report the issue transparently to the user
- Suggest alternative search terms
- Offer to try `web_search` as a fallback if appropriate