---
name: ticket-actions
description: Update a ticket — change state, assign, or add a work note — with explicit confirmation before any write
enabled: true
---

## Instructions

Use this skill when the user asks you to change a ticket: resolve it, reassign it, add a comment for the user, or open a fresh incident. This skill exposes the **write** path of ServiceNow.

Follow the confirmation pattern strictly. Each write needs its own confirmation; never batch multiple writes silently.

### Pattern for every write

1. **Identify the change.** Fetch the current ticket via `servicenow_get_ticket` if you don't already have it in context, so you can compare current → proposed.
2. **Show the draft.** State exactly what you'll change. For state changes, include the reason that will be logged.
3. **Ask the user to confirm.** Use `ask_user`. Wait.
4. **Call the write tool.** Use the exact values you showed.
5. **Report the receipt.** Confirm the ticket id, the new state/assignment, and the audit-trail note that was added.

### Variants

#### Resolve a ticket

```
I'll resolve INC-7001 with this audit note:

> Time-sync fix from KB-200 worked — user confirmed sign-in is now successful.

- Ticket:      INC-7001 — Cannot log in to Workday — MFA loop
- Current:     In Progress (assigned to AGT-301)
- New state:   Resolved
- Audit note:  the line above, logged internally

Confirm to resolve? (yes / no)
```

→ on yes, call `servicenow_update_ticket_state` with `new_state: "Resolved"` and the reason as `reason`.

#### Reassign a ticket

```
I'll reassign INC-7004 from Eddie Sutherland (AGT-305, Network) to Aaron Cole (AGT-301, Endpoint).

This moves the ticket to the Endpoint queue. The CMDB ownership for CI-WAP-CLE-03 still sits with Network — flag if that needs updating too.

Confirm to reassign? (yes / no)
```

→ on yes, call `servicenow_assign_ticket`. If the user also wants the assignment group changed, include that argument.

#### Add a public note

```
I'll add this public note to INC-7001 (visible to the caller):

> Hi Jamal — the device time was off by ~90 seconds, which caused the MFA loop. I've enabled auto-time-sync on your behalf. Please retry sign-in and let us know if it works.

Author: AGT-301 (Aaron Cole)

Confirm to add the note? (yes / no / edit wording)
```

→ on yes, call `servicenow_add_work_note` with `visibility: "public"`.

#### Create a new incident

```
I'll open a new incident:

- Caller:       Theo Nakamura (USR-2001)
- Title:        Cannot push to github.com/olympus repo — 403 forbidden
- Description:  …
- Category:     Access / Application
- Priority:     P3 · Low impact · Medium urgency
- Group:        Identity & Access
- CI:           CI-GITHUB-ORG

Confirm to create? (yes / no)
```

→ on yes, call `servicenow_create_incident`.

### Constraints

- **Never** chain two writes without an intervening confirmation.
- **Never** call `servicenow_add_work_note` with `visibility: "public"` without showing the exact wording first.
- If a write fails (e.g. ticket already resolved, agent doesn't exist), surface the error verbatim and propose the recovery.
- For `update_ticket_state`, always pass a `reason` — it shows up in the audit trail and explains the change to the next agent.
