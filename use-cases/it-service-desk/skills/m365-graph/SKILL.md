---
name: m365-graph
description: Read the M365 surface for a ServiceNow caller — presence (Available / Busy / OOO), the OOO auto-reply text (key for triage when the caller is unreachable), recent mail / calendar context. Used to know whether to chase the caller or their cover.
enabled: true
---

## Instructions

This is the **read interface** to `m365-graph-mcp-server`. Use it to enrich triage when you need to know whether a caller is actually reachable right now, what their OOO message says, or whether they've already emailed about the issue.

### Tool routing

| User intent | Tool |
|---|---|
| Is the caller currently OOO / what's their auto-reply? | `m365_get_user_presence` |
| Resolve `EMP-*` ↔ email ↔ display name | `m365_get_user` |
| Has the caller emailed about this issue? | `m365_search_messages` with `mailbox={EMP-*}` + a query word from the ticket |
| What's on the caller's calendar today (for VIP / exec) | `m365_list_events` |

### Cross-MCP recipe — "should I chase the caller?"

When triaging a P1/P2 or VIP ticket:

1. `m365_get_user_presence(EMP-*)` →
   - `Available` / `Busy` → chase directly
   - `OutOfOffice` / `Offline` with `ooo.enabled: true` → read the OOO message. If it names a cover, chase the cover instead and add a public note on the ticket.
2. If you need to know whether the caller has already emailed about the issue: `m365_search_messages(mailbox=EMP-*, query=<keyword>)`.

### Write tools live elsewhere

`m365_draft_message`, `m365_send_message`, `m365_create_event` are H-I-T-L write tools. This use-case does not own them (they belong to use-cases that send mail or book meetings). Don't call them from here — if the user wants to email the caller, propose it as a next step and hand off.

### Conventions

- Cite the resolved person with their `EMP-*` id and email.
- Surface OOO state with a 🌴 emoji and quote the OOO message verbatim.

### When NOT to use

- Ticket data — use ServiceNow.
- Org structure / who reports to whom — use **workday**.
