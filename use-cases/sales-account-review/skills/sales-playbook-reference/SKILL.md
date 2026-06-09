---
name: sales-playbook-reference
description: Look up the Kratos sales playbook — discount thresholds, MEDDIC qualification, forecast hygiene, deal-desk approval matrix, and competitive positioning
enabled: true
---

## Instructions

Use this skill whenever the user asks about Kratos sales policy or process — discount approvals, what stage means what, deal-desk thresholds, when a POC needs MDF funding, competitive battle cards, forecast hygiene rules.

The playbook lives in `references/kratos-sales-playbook.md`. Read it (or the relevant section) and cite the section number in your answer.

### Use this skill when

- *"Can I offer 25% off?"* / *"What's the discount approval for {$X}?"* → §2 (discount matrix + deal-desk)
- *"What's the criteria for Stage 4 / Negotiation?"* / *"Is this deal qualified?"* → §1 (MEDDIC + stage definitions)
- *"What's our forecast cadence?"* / *"When does the commit lock?"* → §3 (forecast hygiene)
- *"How do I compete against {Vendor X}?"* → §4 (battle cards)
- *"Can we offer a free POC?"* / *"Does this need MDF?"* → §5 (POC + MDF policy)
- *"What's the renewal motion for {Strategic / Mid-Market}?"* → §6 (renewal playbook)

### How to answer

1. **Read the relevant section.** Don't paraphrase from memory.
2. **Cite the section number verbatim** (e.g. *"§2.3 says…"*).
3. **Quote the binding line** when the user is about to do something the playbook restricts (discount > threshold, POC > 30 days, etc.).
4. **Offer the escalation path.** Every restriction has a path: who to email, what to put in deal-desk, who can co-sign.
5. **Refuse to commit actions that violate the playbook.** "I can't draft an offer with 35% discount — that needs deal-desk + VP Sales co-approval per §2.3. I can draft the deal-desk submission instead — want me to?"

### Constraints

- Never paraphrase a percentage threshold or approval threshold from memory — always read it.
- Never assert "the playbook allows X" without a section citation.
- If the playbook is genuinely silent on the question, say so and suggest the user check with sales-ops directly.


<!-- skill-files -->
## Available Files

This skill directory contains the following files you can read with `read_file` using their absolute paths (prefix `/app/use-cases/sales-account-review/skills/sales-playbook-reference/`):

- `references/kratos-sales-playbook.md`
