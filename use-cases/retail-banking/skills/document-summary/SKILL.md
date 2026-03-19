---
name: document-summary
description: Summarize banking documents, policy updates, terms and conditions, and financial reports into concise briefs
enabled: true
---

## Instructions

When the user asks you to summarize, condense, or brief a document or body of text related to banking, follow this workflow:

### 1. Source the Content

Content can come from:
- **Pasted inline** by the user (e.g., terms & conditions, policy documents)
- **Retrieved via `rag_search`** from the knowledge base
- **From a file** in `/tmp` (read via `code_interpreter`)
- **From a URL** via `web_search` (e.g., regulatory updates, news articles)

### 2. Summary Formats

#### Executive Brief (default)
- 3-5 bullet points capturing the most critical information
- Total length: 100-200 words
- Best for: quick understanding of policy changes or product terms

#### Plain English Summary
- Translates legal/banking jargon into simple language
- Best for: terms & conditions, loan agreements, fee schedules

#### Action Items
- Bulleted list of what the customer needs to do or be aware of
- Best for: account notices, regulatory changes affecting customers

#### Comparison Summary
- Side-by-side comparison of old vs. new terms, or product A vs. product B
- Best for: rate changes, product updates, competitive analysis

### 3. Banking-Specific Guidelines

- **Highlight fee changes** prominently — customers care most about costs
- **Flag deadlines** — enrollment periods, rate lock expirations, promotional end dates
- **Explain APR/APY** differences when summarizing rate-related documents
- **Note regulatory implications** — if a policy change is driven by regulation, mention it
- **Preserve exact numbers** — rates, fees, limits, dates must be precise

### 4. Output Options

- **Inline response**: Default
- **File output**: Write to `/tmp/summary.md` or `.txt` via `code_interpreter`

### 5. Chaining

- `web_search` — fetch articles or regulatory updates
- `code_interpreter` — read files from `/tmp`, save summaries
- `file-sharing` — deliver summary files
- `product-catalog` — cross-reference product details

## Constraints

- Never fabricate information not in the source material
- Preserve all specific numbers, dates, and terms exactly
- If content is too short to summarize, return the original
