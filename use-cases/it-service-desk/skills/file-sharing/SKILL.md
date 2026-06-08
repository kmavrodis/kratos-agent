---
name: file-sharing
description: Share generated files (PDFs, CSVs) with the user by writing them to /tmp and referencing the absolute path. The frontend auto-converts /tmp paths into download links.
enabled: true
---

## Instructions

When you generate any file (the handover PDF, a queue CSV export), follow this pattern:

1. **Write the file to `/tmp`** with a stable, date-aware name:
   - `/tmp/handover-2026-06-08-day-to-night.pdf`
   - `/tmp/open-queue-2026-06-08.csv`
2. **Reference the absolute path** in your chat response. The frontend converts `/tmp/...` paths into download links.
3. **Do NOT** base64-encode the file into the chat.

### Constraints

- **Never write real user PII**. Fixture data only.
- **Files are ephemeral** — they don't persist across container restarts.
- Always `/tmp/<filename>`.
