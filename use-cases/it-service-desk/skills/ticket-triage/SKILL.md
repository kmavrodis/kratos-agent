---
name: ticket-triage
description: Triage one ticket end-to-end — gather context, search the KB for known fixes, propose the next action
enabled: true
---

## Instructions

Use this skill when the user asks you to triage, brief on, look at, or "tell me about" a specific ticket (e.g. "Triage INC-7001", "What's happening on INC-7002?", "Walk me through that VIP ticket").

This is a **read-heavy** skill. No writes happen automatically — if a fix is obvious, **propose** it as a next step and let the user decide whether to execute it via the appropriate write skill.

### 1. Fetch the ticket + context

In parallel where possible:

- `servicenow_get_ticket(ticket_id)` — the ticket itself
- `servicenow_list_work_notes(ticket_id)` — the conversation history
- `servicenow_get_user(caller_id)` — who raised it (note VIP flag)
- `servicenow_get_ci(ci_id)` if the ticket has one — what's the impacted system

### 2. Search the KB for known fixes

Use the ticket's `tags` and `short_description` keywords to query `servicenow_search_kb`. If the ticket has `kb_article_ids` already linked, fetch those via `servicenow_get_kb_article` and lead with them.

### 3. Render the brief

```markdown
# {Ticket Number} — Triage

## Snapshot
- **Title**: Cannot log in to Workday — MFA loop
- **Priority**: P3 · Medium urgency · Low impact
- **State**: In Progress · Assigned to Aaron Cole (AGT-301), Endpoint
- **Opened**: 2 hours ago (08:14 UTC) · SLA: on track
- **Caller**: Jamal Carter (USR-2102) — Field Sales — Americas

## What's known
- Last work note (AGT-301, 9 minutes ago): "Time skew on the device — MFA TOTP off by 90s. Asked user to enable automatic time sync."
- Prior public reply from user: tried token reset, still looping.
- CI: Olympus Identity Platform (CI-IDP-01) — currently Operational.

## Likely fix (from KB-200)
> Most common cause is device time skew (TOTP off by >30s). KB-200 documents the auto-time-sync remediation and includes a Powershell snippet if the user is on Windows.

This matches the agent's last work note exactly — looks like the right path.

## Recommended next action
1. Wait 5 minutes for the user to enable time sync, then ask them to retry.
2. If still failing, escalate to Identity & Access (queue) and consider clearing the cached MFA token in Entra per KB-200 step 4.
3. Update ticket state → Resolved once the user confirms sign-in works.

If you'd like me to add a public note nudging the user to retry, just say so.
```

### Constraints

- VIP callers: lead with "🔴 VIP" badge and reference KB-211 if the ticket is P1/P2.
- Don't propose writes you don't have evidence for — "I'd close this" without a clear remediation is worse than "needs more info".
- If the KB returns no matches, say so. Don't pad with generic IT advice.
