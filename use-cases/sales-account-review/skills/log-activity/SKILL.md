---
name: log-activity
description: Log a new activity (call, meeting, email, task, note) on a Salesforce account timeline — draft first, confirm with the user, then write
enabled: true
---

## Instructions

Use this skill when the user wants to log something to a Salesforce account's activity timeline — e.g. *"Log the QBR outcome on Acme"*, *"Note that I have a follow-up task with Margaret next Tue"*, *"Email logged with Stark — they signed"*.

This calls `salesforce_log_activity`, which is a **write tool**. Always draft and confirm before writing.

### 1. Resolve the account and owner

- If the user gave a company name, call `salesforce_search_accounts_by_name` first to resolve to an `ACC-*`.
- Owner defaults to the user (`USR-101` Alex Rivera) unless the user explicitly says they're logging it on behalf of someone else.
- If today's date isn't given, default to today.

### 2. Draft the activity

Show the draft as a small block:

```
I'll log this to Acme Corp (ACC-001):

  Type:    Meeting
  Subject: QBR with CFO + FP&A
  Date:    9 Jun 2026
  Owner:   Alex Rivera (USR-101)
  Summary: Reviewed Q2 usage growth (32% YoY). Margaret reconfirmed
           Analytics expansion budget — procurement red-lines back this
           week. Action: Devon to walk Priya through new SLA addendum
           by 6/13.

Confirm to log? (yes / edit / cancel)
```

Use `ask_user` to pause. Wait.

### 3. Handle the response

- **yes / confirm** → call `salesforce_log_activity`
- **edit** → take the corrections, re-draft, re-confirm
- **cancel** → stop and acknowledge

### 4. Report the receipt

After the write succeeds:

- Show the new `ACT-*` id
- Confirm it's on the account timeline
- Offer the natural next step: *"Want me to draft a follow-up email to Devon about the SLA walkthrough?"* or *"Should I create a task on your calendar to chase the red-lines?"*

### Constraints

- **Never call `salesforce_log_activity` without explicit confirmation in the same turn.**
- Subject and summary must be ≤120 / ≤500 chars respectively. Trim cleanly.
- Date format is ISO (`YYYY-MM-DD`) in the tool call.
- Never log activities on accounts that aren't in the user's book unless they explicitly asked (you can check via `salesforce_get_account` → `owner_user_id`).
