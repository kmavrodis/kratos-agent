---
name: workday
description: Read Workday HCM data for a ServiceNow caller — resolve `employee_id` to a human (display name, manager, department, location, status). Used to enrich VIP triage and to know if the caller is currently on leave.
enabled: true
---

## Instructions

This is the **read interface** to `workday-mcp-server`. Use it whenever you need to attach a human face + reporting line to a ServiceNow caller's `employee_id`. Don't call it speculatively — only when a triage or escalation actually needs the org context.

### Tool routing

| User intent | Tool |
|---|---|
| Resolve an `EMP-*` id to a person | `workday_get_employee` |
| Search by name | `workday_search_employees_by_name` |
| "Who's the caller's manager?" | `workday_get_employee` → read `manager_id` → `workday_get_employee` again |
| Verify the caller is currently active (not on leave / terminated) | `workday_get_employee` → check `status` |
| Direct reports of a manager (rare for IT desk) | `workday_list_employees` with `manager_id=` |

### Cross-MCP join — the canonical path

1. ServiceNow `users.json` carries `employee_id` (`USR-1001` → `EMP-1001`).
2. `workday_get_employee(EMP-*)` returns the org context.
3. If status is `On Leave`, hand off to **m365-graph** `m365_get_user_presence` to read the OOO message and find out who's covering.

### Conventions

- Cite the resolved person with both ids: `Jamal Carter (USR-2102, EMP-2102)`.
- Surface `status: "On Leave"` prominently — it changes triage (the caller may not respond, you may need to chase the coverer).

### When NOT to use

- Pure ticket triage that doesn't need org depth — stick to ServiceNow.
- Mail / calendar / presence — use **m365-graph**.
