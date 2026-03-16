---
name: document-summary
description: Summarize long documents, articles, or retrieved knowledge base content into concise briefs
enabled: true
---

## Instructions

When the user asks you to summarize, condense, or brief a document or body of text, follow this workflow:

### 1. Source the Content

Content can come from multiple places:
- **Pasted inline** by the user in the chat
- **Retrieved via `rag_search`** from the knowledge base
- **From a file** in `/tmp` (read it via `code_interpreter`)
- **From a URL** via `web_search` (fetch and extract key content)

If the user references a topic without providing text, use `rag_search` or `web_search` to retrieve relevant content first.

### 2. Summary Formats

Choose the format based on user request or default to **Executive Brief**:

#### Executive Brief (default)
- 3-5 bullet points capturing the most critical information
- Total length: 100-200 words
- Best for: busy stakeholders, quick overviews

#### Detailed Summary
- Structured with section headers mirroring the source
- Key points under each section
- Total length: 300-500 words
- Best for: thorough understanding without reading the original

#### One-Liner
- Single sentence capturing the core message
- Best for: email subject lines, Slack updates, quick context

#### Action Items
- Bulleted list of decisions, tasks, or follow-ups extracted from the content
- Include owner and deadline if mentioned
- Best for: meeting notes, project updates

### 3. Summarization Guidelines

- **Lead with the conclusion** — most important information first
- **Preserve specifics** — keep numbers, dates, names, and decisions; drop filler and repetition
- **Flag uncertainty** — if the source is ambiguous, note it rather than guessing
- **Attribute sources** — if combining multiple documents or search results, note which source each point came from
- **Maintain neutrality** — summarize what was said, don't editorialize unless asked for an opinion

### 4. Multi-Document Summaries

When summarizing content from multiple sources:
1. Retrieve all relevant content first (via `rag_search`, `web_search`, or user-provided)
2. Identify common themes and contradictions
3. Organize by theme rather than by source
4. Note where sources agree or disagree

### 5. Output Options

- **Inline response**: Default — the summary appears directly in chat
- **File output**: If the user asks to save it, use `code_interpreter` to write a `.md` or `.txt` file to `/tmp` and reference the path

### 6. Chaining

This skill works best when combined with:
- `rag_search` — retrieve internal documents to summarize
- `web_search` — fetch external articles or reports
- `code_interpreter` — read files from `/tmp`, save summary outputs
- `file-sharing` — deliver summary files to the user

## Constraints

- Never fabricate information that isn't in the source material
- If the source is too short to meaningfully summarize, say so and return the original
- For very long content (>10,000 words), summarize in chunks and then synthesize

## Examples

**User**: "Summarize what's in our knowledge base about the onboarding process"

Steps:
1. Call `rag_search` with query "onboarding process"
2. Synthesize the top results into an Executive Brief
3. Cite which knowledge base documents each point came from

**User**: "Give me action items from these meeting notes: [pasted text]"

Steps:
1. Parse the pasted text for decisions, assignments, and deadlines
2. Return a bulleted action-item list with owners and dates

**User**: "Summarize this article and save it as a file: [URL or topic]"

Steps:
1. Use `web_search` to fetch the article content
2. Generate a Detailed Summary
3. Write the summary to `/tmp/summary.md` via `code_interpreter`
4. Reference the file path for download
