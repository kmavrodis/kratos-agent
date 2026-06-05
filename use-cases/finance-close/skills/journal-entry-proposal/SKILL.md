---
name: journal-entry-proposal
description: Propose and post journal entries — accruals, reclasses, manuals — with strict H-I-T-L confirmation
enabled: true
---

## Instructions

Use this skill when the controller asks you to draft, propose, accrue, reclass, or post a journal entry (e.g. "Propose an accrual for the June Sentinel licence", "Reclass $92k of consulting from HQ to Engineering", "Post JE-39001").

This is a **write workflow** with **two-step** writes (propose → post). Strict confirmation pattern.

### Pattern

#### Step 1 — propose (creates Draft)

Build the proposed JE from the user's request, then call `sap_propose_journal_entry`. The tool validates that:

- Debits == credits (balanced)
- Every `gl_account` exists
- Every `cost_centre` (when set) exists

If validation fails, surface the error verbatim, propose a fix, ask the user.

If validation succeeds, you get back a `Draft` JE with a new `JE-*` id.

#### Step 2 — show the draft + ask to post

Render the Draft with full line detail:

```
I've created Draft JE-39001:

- Date:     1 June 2026 · Period 2026-06
- Type:     Accrual · Source FI · Currency USD
- Total:    $42,000 (debits == credits)

| # | GL | Cost Centre | Debit | Credit | Memo |
|---|---|---|---|---|---|
| 1 | 6400 (Software & Subscriptions) | CC-0011 (Platform Eng) | $42,000 | — | Sentinel Observability — June licence accrual |
| 2 | 2200 (Accrued Liabilities) | — | — | $42,000 | Accrued liability — vendor V-1102 |

Confirm to post? (yes / edit / no)
```

Use `ask_user` to pause. Wait.

#### Step 3 — execute

- **yes** → `sap_post_journal_entry` with the Draft id
- **edit X** → gather the correction, re-call `sap_propose_journal_entry` with the new payload, show the new draft, re-confirm
- **no** → stop and acknowledge — the Draft stays Drafted (won't post)

#### Step 4 — report

After Post succeeds:

```
Posted: JE-39001 · period 2026-06 · $42,000 total · 2 lines · accrual.

Audit trail recorded. Anything else for the close?
```

### Common patterns

- **Accrual**: vendor invoice expected but not yet received → debit the expense GL on the requesting cost centre, credit **GL 2200 (Accrued Liabilities)**. Don't search for the credit account — it's 2200. (When the invoice arrives, AP later debits 2200 and credits AP — but that's a separate workflow.)
- **Reclass**: move expense from one cost centre to another → debit the new cost centre, credit the old (same GL on both lines).
- **Manual**: true one-off; flag as `Manual` and double-confirm the lack of supporting source.

### Constraints

- **Never** call `sap_post_journal_entry` without explicit `yes` in the same turn after showing the draft.
- For a Manual JE, re-confirm specifically: *"This will be flagged as Manual (no source doc). Confirm to post?"* — manuals attract audit scrutiny.
- If the user gives an amount only, ask for: cost centre, GL account, memo, and source. Don't guess.
- Round-trip currency: render `$42,000`; pass `42000` to the tool.
