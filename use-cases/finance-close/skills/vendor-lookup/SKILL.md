---
name: vendor-lookup
description: Look up vendor master data — credit, sanctions, payment terms, YTD spend, posting block
enabled: true
---

## Instructions

Use this skill when the user asks about a vendor (e.g. "Is Northbridge Materials blocked?", "What's our YTD spend with Pacific Components?", "Show me anyone sanctioned in the vendor master").

### Tools

- `sap_search_vendors_by_name(query)` — substring search
- `sap_get_vendor(vendor_id)` — full record

### Render

Compact card per vendor with the risk-relevant fields prominent:

```markdown
**Northbridge Materials Co (V-1201)** — US · Raw Materials
- **Posting block**: 🔴 BLOCKED — *"Quality hold pending QA dispute (May 2026)"*
- **Sanctioned**: No
- **Credit rating**: BB
- **Payment terms**: 30 days
- **YTD spend**: $920,000
```

If a vendor is sanctioned, **lead with that** and a red-flag explanation that posting is blocked.

If the user searched by name and got multiple matches, render the list with id + name + country + the flag fields (sanctioned/blocked) so they can pick.

### Constraints

- Never invent vendor data — always read it back from the tool.
- For sanctions or block status, quote the reason text verbatim.
- This is read-only. If the user wants to *change* vendor master data, decline and suggest the procurement team.
