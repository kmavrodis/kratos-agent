---
name: handover-pack-pdf
description: Build the downloadable shift-handover pack PDF — per §8.1 of the IT runbook. Cover with outgoing/incoming shifts, then sections for open P1/P2, awaiting-user, pending escalations, VIP watchlist, network/change in flight, notes for incoming. Renders via the inline HTML template + Playwright.
enabled: true
---

## Instructions

Use this skill when Aaron asks for "the handover pack", "the PDF", "end-of-shift summary", or any variation. This is the **deliverable** the persona exists to produce.

### Workflow

1. **Gather the data** by chaining other skills first:
   - Open ticket list via `servicenow_list_tickets` (omit `state` filter; render handles the bucketing).
   - For each P1/P2, fetch recent work notes: `servicenow_list_work_notes(ticket_id, limit: 3)`.
   - For VIP callers: cross-join via **workday** + **m365-graph** for status / OOO.
2. **Read the policy** via **it-policy-reference** — the section order in §8.1 is what the PDF must follow.
3. **Render** by invoking `scripts/render_handover.py` via `code_interpreter`:

```bash
python /app/use-cases/it-service-desk/skills/handover-pack-pdf/scripts/render_handover.py \
  --outgoing-shift "Day (Aaron Cole, AGT-301)" \
  --incoming-shift "Night (Chen Wu, AGT-303)" \
  --shift-date 2026-06-08 \
  --tickets-json '<JSON object — see below>' \
  --notes-for-incoming "Free text from Aaron…" \
  --out /tmp/handover-2026-06-08-day-to-night.pdf
```

4. **Confirm in chat:** "Handover saved to `/tmp/handover-…pdf` — N pages, X open P1/P2, Y awaiting user, Z pending escalations." Reference the path so **file-sharing** picks it up.

### Tickets-JSON shape

The render script expects a single object with these keys:

```json
{
  "p1_p2_open": [{ "id": "INC-7002", "priority": "P1", "state": "In Progress", "caller": "Diana Whitfield", "caller_vip": true, "assigned_to": "Bea Lindgren (AGT-302)", "short_description": "...", "last_note": "..." }, ...],
  "awaiting_user": [{ "id": "INC-7001", "caller": "Jamal Carter", "assigned_to": "Aaron Cole (AGT-301)", "short_description": "...", "what_we_asked": "..." }, ...],
  "pending_escalations": [{ "id": "INC-7004", "escalated_to": "Network L2", "escalated_when": "2 hours ago", "why": "..." }, ...],
  "vip_watchlist": [{ "id": "INC-7002", "caller": "Diana Whitfield", "vip_rationale": "Executive (CEO)", "status": "..." }, ...],
  "network_change_in_flight": [{ "id": "CHG-9001", "type": "Change", "state": "Scheduled", "summary": "..." }, ...]
}
```

### Assets

- `assets/handover-pack.html` — Jinja-style template (string substitution, no Jinja). Cool-grey + ServiceNow-blue theme. Cover + one section per §8.1 bullet.

### Constraints

- **Always include the §8.1 sections in order.** Print empty sections with *"None"* rather than skipping.
- The handover is **not** a triage doc — keep each ticket row to 2-3 lines.
- VIP names appear (this is internal); do not include any §7.2-prohibited content (the PDF is internal-only, but stay consistent with the tone rules).
- Do not auto-email. §8.2 explicitly says PDF only; email is a separate workflow.

### When NOT to use

- Spot question on a single ticket — use **ticket-triage**.
- Verbal queue summary — use **queue-overview**, answer inline.


<!-- skill-files -->
## Available Files

This skill directory contains the following files you can read with `read_file` using their absolute paths (prefix `/app/use-cases/it-service-desk/skills/handover-pack-pdf/`):

- `assets/handover-pack.html`
- `scripts/render_handover.py`
