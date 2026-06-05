---
name: cost-centre-brief
description: Brief on one cost centre — budget vs YTD actual, owner, recent JEs, suggested watch-outs
enabled: true
---

## Instructions

Use this skill when the user asks about a cost centre's performance, "how is X tracking", or "brief me on the {function} spend" (e.g. "Brief me on CC-0031", "How is the Cleveland plant tracking against budget?", "Engineering year-to-date").

### 1. Resolve the cost centre

- If the user gave a `CC-*` id → `sap_get_cost_centre`
- If they named a function or department → `sap_list_cost_centres(function: '<fn>')` and either pick the single match or ask

### 2. Pull recent JEs touching it

`sap_list_journal_entries(cost_centre: <id>, limit: 10)` — newest first.

### 3. Render

```markdown
# Cleveland Plant Operations (CC-0031) — Brief

## Snapshot
- **Function**: Operations
- **Owner**: Wesley Park (EMP-1031)
- **Budget (YTD)**: $14,500,000
- **Actual (YTD)**: $7,240,000
- **Tracking**: 50.0% of annual budget consumed — broadly in line if the year is 50% done.
- **Currency**: USD

## Recent JEs touching this cost centre (last 10)
| JE | Date | Type | Status | Debit to CC | Memo |
|---|---|---|---|---|---|
| JE-30001 | 31 May | Standard | Posted | $248,000 | Raw material consumption — May |
| … |

## Watch-outs
- None of the recent JEs are Manual; the May activity looks routine.
- (Conditional) If a Manual or large round-number JE appears: surface it.
```

### Constraints

- Show `actual / budget` as `$X / $Y` plus a percentage.
- If actuals exceed pro-rata budget by >10%, flag with 🟡 watch.
- Don't propose JEs from this skill — suggest `journal-entry-proposal` if the user wants to act on a finding.
- If the user asks for the owner's wider org context, suggest cross-referencing via Workday in a follow-up.
