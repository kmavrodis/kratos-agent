---
name: journals-queue-review
description: Surface journal entries needing controller attention — drafts pending posting, manual JEs, period-end accruals
enabled: true
---

## Instructions

Use this skill when the controller asks about the JE queue, manual entries, drafts, or anything posted in a period (e.g. "Show me all manual JEs in May", "What's still in Draft for June?", "Drill into JE-30099").

### 1. Pull the JEs

`sap_list_journal_entries` with the filters the user gave. Common combos:

- **All manuals for a period** → `period`, `type: "Manual"`
- **Pending drafts** → `status: "Draft"`
- **JEs touching a GL or cost centre** → `gl_account` or `cost_centre`
- **One JE by id** → `sap_get_journal_entry`

### 2. Render

```markdown
# Journals queue — {filter description}

| JE | Date | Period | Type | Source | Status | Total | Lines |
|---|---|---|---|---|---|---|---|
| JE-30099 | 27 May | 2026-05 | **Manual** | FI | Posted | $480,000 | 2 |
| JE-30100 | 1 Jun  | 2026-06 | Standard   | AP | **Draft** | $38,000 | 2 |

## Detail: JE-30099 — Manual, $480,000
| Line | GL | Cost Centre | Debit | Credit | Memo |
|---|---|---|---|---|---|
| 1 | 6200 (T&E) | CC-0021 (Field Sales — Americas) | $480,000 | — | T&E adjustment — clearing prior period |
| 2 | 2100 (AP)  | — | — | $480,000 | AP clearing |

## Watch-outs
- 🔴 **JE-30099** — Manual entry, single large round number ($480k), no cross-check against an AP source document. Worth verifying with the originator before close.
```

### Constraints

- Always render line-level detail for **Manual** JEs — they're the audit risk.
- Format currency as `$1,234,567` (no decimals for whole dollars).
- For draft JEs, lead with the Draft flag and remind that they're not yet in the ledger.
- If filtering returns zero results, say so explicitly and propose what else to try.
