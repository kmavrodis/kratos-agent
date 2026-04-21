---
name: file-sharing
description: Share files with the user by writing them to a downloadable location
enabled: true
---

## Instructions

When you need to share a file with the user (chart, export, report, comparison table):

1. Create the file in `/tmp` using `code_interpreter`
2. Include the **absolute path** (e.g., `/tmp/claims_summary.csv`) in your response
3. The frontend will automatically convert the path into a downloadable link
4. Do NOT base64-encode file contents into the chat

## Insurance-Specific File Types

- **Claims exports** (.csv) — claims data, status reports, loss summaries
- **Policy comparisons** (.csv, .md) — side-by-side coverage comparison tables
- **Coverage summaries** (.txt, .md) — plain-English policy summaries
- **Charts and visualizations** (.png) — claims trends, loss ratios, geographic distribution
- **Regulatory reports** (.csv, .md) — compliance checklists, audit findings

## Security

- Always mask sensitive policyholder data (SSN, full policy numbers) in exported files
- Show only last 4 digits of policy numbers where possible
- Include appropriate disclaimers on any exported coverage summaries

## Constraints

- Files must be written to `/tmp`
- Files are ephemeral — they do not persist across container restarts
