---
name: vip-watchlist
description: Brief the agent on all open VIP tickets — what's blocking each, who's working it, SLA status
enabled: true
---

## Instructions

Use this skill when the user asks about VIP tickets, exec-level issues, or "what's hot right now?" (e.g. "Brief me on the open VIP tickets", "Anything blocking the execs?", "What's the VIP queue look like?").

### 1. Pull the data

- `servicenow_list_tickets` with `vip_only: true` and (typically) `state` not in `Resolved, Closed, Cancelled` — call once for each non-terminal state, or omit state and filter client-side.
- For each ticket, optionally:
  - `servicenow_list_work_notes(ticket_id)` to surface the latest agent note
  - `servicenow_get_user(caller_id)` to put a name on the caller

### 2. Render

Sort by SLA risk: `sla_breach: true` first, then P1, then P2, then by `opened_at` ascending (oldest first within each band).

```markdown
# 🔴 VIP Watchlist — {N} open tickets

## SLA-breaching ({M})

### INC-7002 · P1 · Outlook on iPhone keeps disconnecting
- **Caller**: Diana Whitfield (USR-1001) — CEO
- **Owner**: Bea Lindgren (AGT-302), Mobile Productivity
- **Opened**: 3 hours ago (06:50 UTC) — **breaching**
- **Latest note**: "Intune shows the device pending a config-profile push from this morning's tenant change. Likely root cause."
- **Linked KB**: KB-211 (VIP playbook), KB-204 (Outlook iOS Modern Auth)

## P1 / P2 in flight (not yet breaching)
- _(none right now)_

## Recommendations
- INC-7002 needs an exec-IT briefing update per KB-211 — last status was 30+ minutes ago.
- Consider paging on-call manager if the Intune push doesn't land in the next 15 minutes.
```

### Targeted variants

- **"What's hottest?"** → if there's a P1 + sla_breach, lead with that one as the headline; defer the rest to a short list.
- **"Anything for {exec name}?"** → resolve the user via `servicenow_search_users_by_name`, then `servicenow_list_tickets` filtered by `caller_id` instead of `vip_only`.

### Constraints

- If there are zero open VIP tickets, say so directly. Don't invent risk.
- Always reference the playbook (KB-211) when an SLA is breaching and the agent has clear next steps.
- Never display the caller's email or phone unless asked.
