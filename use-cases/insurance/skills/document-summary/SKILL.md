---
name: document-summary
description: Summarize insurance documents — policy wordings, claims reports, regulatory filings, and coverage comparisons into concise briefs
enabled: true
---

## Instructions

When the user asks you to summarize, condense, or brief an insurance document or body of text, follow this workflow:

### 1. Source the Content

Content can come from multiple places:
- **Pasted inline** by the user in the chat
- **Retrieved via `rag_search`** from the insurance knowledge base
- **From a file** in `/tmp` (read it via `code_interpreter`)
- **From a URL** via `web_search` (fetch and extract key content)
- **Uploaded files** (PDF, DOCX, TXT) — use `code_interpreter` to extract text first:
  - PDF: `pip install PyPDF2` then read with `PdfReader`
  - DOCX: `pip install python-docx` then iterate paragraphs

If the user references a topic without providing text, use `rag_search` or `web_search` to retrieve relevant content first.

### 2. Summary Formats

Choose the format based on user request or default to **Executive Brief**:

#### Executive Brief (default)
- 3-5 bullet points capturing the most critical information
- Total length: 100-200 words
- Best for: quick policy overviews, claims status updates

#### Coverage Summary
- Structured with: Coverage type, Limits, Deductibles, Key exclusions, Endorsements
- Best for: translating dense policy language into plain English

#### Comparison Summary
- Side-by-side table comparing two or more policies, coverage options, or carriers
- Columns: Feature, Option A, Option B
- Best for: policy renewals, coverage evaluations, competitor analysis

#### Action Items
- Bulleted list of tasks, decisions, or follow-ups
- Include owner and deadline if mentioned
- Best for: claims review meetings, underwriting decisions

### 3. Insurance-Specific Guidelines

- **Highlight coverage changes** — any modifications to limits, deductibles, or exclusions
- **Flag deadlines** — renewal dates, claims filing windows, waiting periods, proof-of-loss deadlines
- **Preserve exact policy wording** for exclusions, limitations, and conditions — do not paraphrase these
- **Note regulatory implications** — if a document references specific regulations or compliance requirements
- **Distinguish binding vs. informational** — is this a policy document (binding) or a summary (informational)?

### 4. Multi-Document Summaries

When summarizing content from multiple sources:
1. Retrieve all relevant content first
2. Identify common themes and contradictions
3. Organize by theme rather than by source
4. Note where sources agree or disagree — especially important for coverage disputes

### 5. Output Options

- **Inline response**: Default — the summary appears directly in chat
- **File output**: If the user asks to save it, use `code_interpreter` to write to `/tmp`

## Constraints

- Never fabricate information that isn't in the source material
- If the source is too short to meaningfully summarize, say so and return the original
- For very long content (>10,000 words), summarize in chunks and then synthesize
- Always cite the source document when summarizing policy language
