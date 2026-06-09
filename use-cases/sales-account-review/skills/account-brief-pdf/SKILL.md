---
name: account-brief-pdf
description: Render a printable single-account brief PDF — snapshot, pipeline, contacts, recent activity, risks, suggested next steps — ready for the QBR prep folder
enabled: true
---

## Instructions

Use this skill when the user asks for a **printable** or **PDF** version of an account brief — *"Build the Acme PDF"*, *"Print the account one-pager"*, *"Brief for my QBR prep folder"*.

For an in-chat brief, use `account-briefing` instead.

### 1. Gather the account data

Compose, in parallel where possible:

- `salesforce_get_account` → snapshot
- `salesforce_list_opportunities` with `open_only: true` → open pipeline
- `salesforce_list_contacts_by_account` → contact rolodex
- `salesforce_list_activities_by_account` with `limit: 8` → recent activity
- `salesforce_list_open_cases_by_account` → at-risk signals
- `salesforce_get_user` for each owner / CSM / SE you'll reference

Resolve all `USR-*` to names. Do not pass raw user ids into the PDF.

### 2. Build the status JSON

Build a single JSON object with this shape:

```json
{
  "account": { "id": "ACC-001", "name": "Acme Corp", "industry": "...", "tier": "Strategic", "health": "Green",
               "arr": 1850000, "renewal_date": "2026-09-30", "owner": "Alex Rivera", "csm": "Reese Patel", "se": "Devon Park",
               "description": "..." },
  "pipeline": [ { "id": "OPP-1001", "name": "...", "stage": "...", "amount": 420000, "probability": 0.75, "close_date": "2026-09-15", "next_step": "..." }, ... ],
  "contacts": [ { "name": "Margaret Chen", "title": "CFO", "role": "Economic Buyer", "is_primary": true }, ... ],
  "activity": [ { "date": "2026-05-18", "type": "Call", "subject": "...", "summary": "..." }, ... ],
  "cases": [ { "id": "CASE-3001", "priority": "P1", "status": "Open", "subject": "...", "summary": "..." } ],
  "risks": [ "Procurement red-lines outstanding — slipping past 6/15 target", "..." ],
  "next_steps": [ "Confirm 6/15 MSA sign with Priya by EOD Thursday", "..." ]
}
```

### 3. Render

Call `code_interpreter` with:

```
python /app/use-cases/sales-account-review/skills/account-brief-pdf/scripts/render_account_brief.py \
  --account-name "Acme Corp" \
  --status-json '<JSON from step 2>' \
  --out /tmp/account-brief-acme-corp.pdf
```

The script uses Playwright to render `assets/account-brief.html` → A4 PDF. If Playwright fails, an HTML fallback is written next to the PDF path.

### 4. Reference the file

Use the file-sharing convention:

```
📄 [/tmp/account-brief-acme-corp.pdf](/tmp/account-brief-acme-corp.pdf)
```

Then summarise in 4–6 lines what's in the brief and what jumped out.

### Constraints

- Never include personal data the AE didn't already have (no SSN-equivalents, no internal HR data).
- Never include forward-looking commitments that aren't on the opp record (don't invent "expected close $X" — use what's on the opp).
- Activity summaries on the PDF: keep to one sentence each. Trim cleanly.


<!-- skill-files -->
## Available Files

This skill directory contains the following files you can read with `read_file` using their absolute paths (prefix `/app/use-cases/sales-account-review/skills/account-brief-pdf/`):

- `assets/account-brief.html`
- `scripts/render_account_brief.py`
