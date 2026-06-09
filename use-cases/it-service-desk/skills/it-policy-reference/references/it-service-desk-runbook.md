# Olympus Industries — IT Service Desk L1 Runbook

> Version 2026.2 — effective 1 April 2026. Owner: IT Service Owner (Aaron Cole, AGT-301). Reviewed quarterly.

This runbook governs L1 service-desk behaviour at Olympus Industries. It is binding on all L1 agents. Cite sections when answering policy-relevant questions ("is this allowed?", "what's the SLA?", "what's the playbook for X?").

## §1. SLA targets by priority

| Priority | Response time | Resolution target | Escalation trigger |
|---|---|---|---|
| **P1** (Critical — multi-user outage, VIP-impacting) | 15 min | 4 hours | Breach response SLA → page on-call manager. Breach resolution SLA → bridge call + Service Owner notification |
| **P2** (High — single-team outage, VIP-degraded) | 1 hour | 8 hours | Breach response → Group lead. Breach resolution → IT Service Owner |
| **P3** (Medium — single-user issue, has workaround) | 4 hours | 2 business days | No automated escalation; review at shift handover |
| **P4** (Low — request, cosmetic) | 1 business day | 5 business days | Review at weekly queue cleanup |

**§1.1.** SLA clock pauses on **On Hold (Awaiting User)** and resumes on user reply. State transitions must capture the reason (audit requirement §6.3).

**§1.2.** VIP callers (`vip: true` in user record) get an effective priority bump of one tier (a P3 reported by a VIP gets P2 SLA tracking). See §2.

## §2. VIP handling (KB-211 playbook)

**§2.1.** VIPs at Olympus include Executive team (`groups: ["execs"]` in ServiceNow user record), Board members, and the CEO Office. **Verify VIP status by reading the `vip: true` flag** — do not infer from job title alone.

**§2.2. KB-211 playbook** for VIP tickets:
1. Assign immediately to the on-shift **group lead** (not a junior agent). For Endpoint that's Aaron Cole on Day shift.
2. Page the user's **executive assistant** (Workday: read `assistant_id` if populated; otherwise the user's manager).
3. Open a private status thread; **public-facing notes must be approved by the group lead** before sending (§7.2).
4. If unresolved within 50% of SLA: page IT Service Owner.

**§2.3.** Do **not** identify the VIP by name in any public-facing communication other than direct reply to the VIP themselves. Internal work notes use the user's name; public notes use *"the requester"*.

## §3. Identity & Access — L1 boundaries

**§3.1. L1 may do directly:**
- Trigger a self-service password reset link to the user's recovery address.
- Re-enrol an MFA factor **for the original user** after voice verification (§3.3).
- Unlock a locked account (Entra) after the account-lockout cooldown (15 min).

**§3.2. L1 must escalate to Identity & Access (Chen Wu, AGT-303):**
- **Granting** any role / group membership (admin, group-admin, app-admin).
- **MFA bypass** of any duration (even 5 min for VIP).
- Adding a device to **Conditional Access exceptions**.
- Anything touching **service accounts**.

**§3.3. Voice verification.** Before re-enrolling MFA or unlocking an account for a caller, verify by phone using their primary phone on file in Workday. **Chat / Slack / email verification is insufficient** — phishing risk. Record the verification time in a work note.

## §4. Endpoint — L1 boundaries

**§4.1. L1 may do directly:**
- Trigger a remote restart via Intune.
- Re-image a device via Autopilot (user must sign in with full creds afterwards).
- Push a missing app via Intune company portal.

**§4.2. L1 must escalate to Endpoint L2:**
- BitLocker recovery (after L1 has tried the user-facing self-service flow once).
- Hardware replacement decisions (warranty, asset disposal).
- Anything touching **firmware** (TPM, BIOS, UEFI updates).

**§4.3. Vendor support.** Apple Care Enterprise and Dell ProSupport tickets are opened by L2 only — L1 captures the symptoms in the work note and routes.

## §5. Network incidents — comms cadence

**§5.1. P1 network incidents** (site outage, VPN cluster down): comms every **30 minutes** until resolution. Use the standard incident notification template (KB-301).

**§5.2. P2 network incidents** (degraded single-site or single-app): comms every **2 hours**.

**§5.3.** When a network ticket is in flight and a related caller raises a duplicate, **link** the duplicate to the parent incident and apply the same comms cadence — don't write a separate update.

## §6. Change control

**§6.1. Normal changes** require CAB approval and a 5-business-day lead time. L1 doesn't create normal changes; route the request to the appropriate L2 team.

**§6.2. Emergency changes** can be created by L1 lead (group lead role required) for P1 incidents in flight. Must include:
- Justification with the parent INC id
- Rollback plan
- Approval thread (CTO or designate) attached as a work note

**§6.3.** Every state transition on a ticket **must include a `reason`** — the audit trail depends on it. "Resolved" without a reason will be rejected by the close-the-loop quality check.

## §7. Public-facing work-note tone

**§7.1.** Public-facing notes are visible to the caller. Tone:
- First-name only after first message.
- Acknowledge the user's frustration explicitly when relevant.
- No internal jargon (`AGT-*`, `CI-*`, `CHG-*` — keep these in internal notes).
- No speculative diagnoses.

**§7.2.** **Never write in public-facing notes:**
- Other users' names or ids (privacy).
- Internal incident numbers (`INC-9999`).
- Vendor names beyond product-line ("the laptop" not "Dell Latitude 5440").
- Anything that would be embarrassing in a screenshot.

**§7.3.** For VIPs, the **group lead must approve** any public-facing wording before it sends (§2.2).

## §8. Shift handover format

**§8.1.** The handover pack PDF (produced by the **handover-pack-pdf** skill) is the official record of shift-to-shift handoff. Required sections in order:

1. **Cover** — outgoing shift, incoming shift, date/time, agent on duty.
2. **Open P1/P2 summary** — every open P1 and P2 with current state, last note, owner.
3. **Awaiting User** — tickets that may resolve quickly on user reply, with what's expected.
4. **Pending escalations** — tickets routed to L2/L3, with who's chasing.
5. **VIP watchlist** — every ticket with a VIP caller, current status.
6. **Network/Change in flight** — anything affecting more than a single user.
7. **Notes for incoming** — free-text from the outgoing lead.

**§8.2.** The handover is generated at end-of-shift (Day → Night = ~18:00 local; Night → Day = ~06:00 local) and emailed to both shift leads. Email send is a separate workflow — the agent only produces the PDF.

## §9. SOX SoD — what L1 may NOT do alone

**§9.1.** L1 agents may NOT:
- **Grant elevated access** (any admin group, service account membership) — to anyone, including themselves or a peer agent. Escalate to Identity & Access (§3.2).
- **Approve** their own ticket as resolved when they were the requester (separate the agent and caller roles).
- **Close** a ticket they did not work on without reading the work-note history.
- **Delete** any work note — corrections are appended, not edited.

**§9.2.** Audit log review is monthly. Violations of §9.1 result in a remedial training assignment and, on repeat, escalation to the IT Service Owner.

---

*Questions: IT Service Owner.*
