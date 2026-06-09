---
name: file-sharing
description: Convention for writing downloadable files to /tmp so the user can pick them up
enabled: true
---

## Instructions

When you produce a file the user needs to download — a PDF brief, a CSV export, a chart — write it to `/tmp/<descriptive-name>.<ext>` and reference the path in your response.

The backend exposes `/tmp` paths to the frontend as downloadable artifacts. The user clicks the path to open / save.

### Naming convention

- `/tmp/account-brief-<account-slug>.pdf` — single-account briefing PDFs
- `/tmp/pipeline-<owner>-<period>.csv` — pipeline exports
- `/tmp/<name>.png` — charts

Use lowercase, hyphens, no spaces, no special characters.

### How to reference

After writing the file, mention it in your response on its own line as a markdown link:

```
📄 [/tmp/account-brief-acme-corp.pdf](/tmp/account-brief-acme-corp.pdf)
```

### Constraints

- Always `/tmp/` — not `~/`, not relative paths.
- Don't ZIP single-file outputs. One file, one link.
- Don't write to disk if the user only asked for a summary in-chat.
