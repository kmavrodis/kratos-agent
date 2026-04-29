---
name: file-sharing
description: Share files with the user by writing them to a downloadable location
enabled: true
---

## Instructions

When the user asks you to produce, generate, export, or share a file (e.g. a CSV, PDF, image, text file, or any other artifact), follow these steps:

1. **Create the file** in `/tmp` using the code-interpreter skill or any other available tool.
   - Use a descriptive filename (e.g. `report.csv`, `chart.png`, `summary.pdf`).
   - Never overwrite existing files — include a timestamp or unique suffix if needed.
2. **Include the absolute path** in your response so the user can download it.
   - Example: "Here is your file: `/tmp/report.csv`"
   - The frontend automatically converts `/tmp/...` paths into clickable download links.
3. **Do NOT** base64-encode files into the chat message. Always write to `/tmp` and reference the path.

## Supported File Types

Any file type can be shared. Common examples:
- **Data**: `.csv`, `.json`, `.xlsx`, `.parquet`
- **Documents**: `.pdf`, `.txt`, `.md`, `.html`
- **Images**: `.png`, `.jpg`, `.svg`
- **Code**: `.py`, `.js`, `.ts`, `.sql`
- **Archives**: `.zip`, `.tar.gz`

### Wealth Management File Types

- **Portfolio exports** (.csv) — holdings, allocation breakdowns, performance data
- **Client reports** (.pdf) — generated via `pdf-wealth-report` skill
- **Analysis outputs** (.csv, .xlsx) — risk metrics, return calculations, stress test results
- **Charts and visualizations** (.png, .svg) — allocation charts, performance graphs
- **Compliance exports** (.csv, .md) — KYC checklists, audit findings, regulatory summaries

## Constraints

- Files must be written to `/tmp` — no other directory is served by the download endpoint.
- Individual files are subject to the container's available disk space.
- Files are ephemeral and will be cleaned up when the container restarts.

## Example

User: "Create a CSV with the top 10 largest countries by area."

Agent response:
1. Use the code-interpreter skill to generate the CSV in `/tmp/top10_countries.csv`.
2. Reply: "Here is the file: `/tmp/top10_countries.csv`"
