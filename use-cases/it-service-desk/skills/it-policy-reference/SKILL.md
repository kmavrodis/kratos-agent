---
name: it-policy-reference
description: The Olympus Industries IT Service Desk runbook + change-control policy. Cite by section number when answering policy questions ("is this action allowed?", "what's the SLA?", "what does the runbook say about X?").
enabled: true
---

## Instructions

Use this skill whenever the user (Aaron) asks "is this allowed?", "what's the SLA?", "what's the playbook for X?", or any question whose answer is governed by service-desk policy rather than this specific ticket.

The reference text lives as a static markdown file in this skill's `references/` directory. Read it on demand and cite the section number in your answer.

### Available references

- `references/it-service-desk-runbook.md` — the full L1 runbook. Sections:
  - §1 SLA targets by priority
  - §2 VIP handling (KB-211 playbook)
  - §3 Identity & Access — what L1 can do directly vs. what needs L2 / Identity team
  - §4 Endpoint — what L1 can do directly vs. what needs vendor support
  - §5 Network incidents — comms cadence + escalation
  - §6 Change control — emergency vs. normal change, approval matrix
  - §7 Public-facing work-note tone + what NEVER to write in public
  - §8 Shift handover format
  - §9 SOX SoD rules — what an L1 agent may NOT do alone (e.g. grant elevated access to themselves or a peer)

### Usage

1. Read the runbook once at the start of any policy-relevant turn.
2. **Quote the relevant rule verbatim** with the section reference (e.g. *"Per §3.2, L1 may reset an MFA factor only for the original user; granting MFA bypass requires Identity & Access (Chen Wu, AGT-303)"*).
3. **Frame as reference, not order.** "The runbook says X" — let Aaron decide whether it applies.

### When the answer is "no"

If a request would violate §9 SoD or §3/§4 escalation rules, **refuse the write** and explain the policy citation. Do not propose a work-around that violates the rule. Offer the correct path (which group to escalate to, which agent is on shift, what evidence to attach).

### Cross-skill handoffs

- **ticket-actions** — before any state transition or work-note add that touches policy-sensitive data, consult this skill.
- **handover-pack-pdf** — §8 defines the handover format the PDF must follow.

### Constraints

- Do not invent runbook citations. If a question is outside the 9 sections, say so directly: *"That's not in the L1 runbook — recommend asking the IT Service Owner."*
- Do not give specific tool-config recommendations that aren't in the runbook (those are L2/L3 decisions).


<!-- skill-files -->
## Available Files

This skill directory contains the following files you can read with `read_file` using their absolute paths (prefix `/app/use-cases/it-service-desk/skills/it-policy-reference/`):

- `references/it-service-desk-runbook.md`
