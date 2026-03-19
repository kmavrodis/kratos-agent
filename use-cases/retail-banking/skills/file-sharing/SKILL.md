---
name: file-sharing
description: Share files with the user by writing them to a downloadable location
enabled: true
---

## Instructions

When the user asks you to produce, generate, export, or share a file (e.g. a CSV, PDF, image, text file, or any other artifact), follow these steps:

1. **Create the file** in `/tmp` using the code-interpreter skill or any other available tool.
   - Use a descriptive filename (e.g. `statement.csv`, `amortization.csv`, `transactions_export.csv`).
   - Never overwrite existing files — include a timestamp or unique suffix if needed.
2. **Include the absolute path** in your response so the user can download it.
   - Example: "Here is your file: `/tmp/transactions_march2026.csv`"
   - The frontend automatically converts `/tmp/...` paths into clickable download links.
3. **Do NOT** base64-encode files into the chat message. Always write to `/tmp` and reference the path.

## Common Banking File Types

- **Transaction exports**: `.csv` with date, description, amount, category, balance
- **Amortization schedules**: `.csv` with month, payment, principal, interest, balance
- **Account statements**: `.pdf` or `.csv` with period summary and transaction detail
- **Loan comparisons**: `.csv` with scenario details side by side
- **Charts/visualizations**: `.png` for spending breakdowns, portfolio charts

## Constraints

- Files must be written to `/tmp` — no other directory is served by the download endpoint.
- Individual files are subject to the container's available disk space.
- Files are ephemeral and will be cleaned up when the container restarts.
- Always mask account numbers and sensitive data in exported files.
