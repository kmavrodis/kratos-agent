---
name: queue-overview
description: List the open ticket queue for an assignment group or agent, sorted by priority and age
enabled: true
---

## Instructions

Use this skill when the user asks about a queue, their team's workload, or "what's on Aaron's plate?" (e.g. "Show me Identity & Access open queue", "What's Aaron Cole working on?", "Network tickets pending tonight").

### Tool to use

`servicenow_list_tickets` with one or more of:

- `assignment_group` — queue name (`Identity & Access`, `Endpoint`, `Network`, `Mobile Productivity`, `Collaboration Tools`, `IT Provisioning`)
- `assigned_to` — `AGT-*` id of a specific agent
- `state` — typically omit to show all non-terminal, then filter client-side

### Render

Sort by priority (P1 → P4), then by `opened_at` ascending. Show 1 row per ticket:

```markdown
# {Queue or Agent} — Open Queue ({N} tickets)

| # | Priority | Ticket | Caller | State | Age |
|---|---|---|---|---|---|
| 1 | P1 | INC-7002 — Outlook on iPhone… | Diana Whitfield 🔴 VIP | In Progress | 3h |
| 2 | P2 | INC-7004 — Plant Wi-Fi dropping… | Wes Park | In Progress | 5h |
| 3 | P3 | INC-7001 — Workday MFA loop | Jamal Carter | In Progress | 2h |
| 4 | P3 | INC-7003 — Slack channel missing | Theo Nakamura | New | 19h |
```

Mark VIP callers with a 🔴 badge.

Summary line: `**N open · X P1/P2 · Y breaching SLA · Z unassigned**`.

### Constraints

- Don't fetch work notes unless the user specifically asks to dig into one.
- If the queue is empty, say so directly and offer to switch to another queue.
- Always include the ticket id in column 3.
