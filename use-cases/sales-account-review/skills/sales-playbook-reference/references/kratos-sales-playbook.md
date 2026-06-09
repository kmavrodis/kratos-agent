# Kratos Sales Playbook (FY26)

*Owner: Riley Okafor, VP Sales Ops. Last review: 2026-04-01.*

This is the binding sales playbook for all Kratos field sales — Strategic, Enterprise, Mid-Market, and SMB / PLG segments. Every section here is in force unless explicitly waived in writing by a named approver. If you can't find what you need, escalate to deal-desk (`deal-desk@kratos.example.com`) rather than improvise.

---

## §1 — Qualification (MEDDIC)

Every opportunity in Stage 3 (Proposal) or later must have a populated MEDDIC card on the opp record. The card has 6 fields:

- **M — Metrics**: the quantified business outcome the customer expects (e.g. "30% reduction in analytics TCO over 3 years").
- **E — Economic Buyer**: the person who can authorise the purchase. Must be a named contact on the account with role `Economic Buyer`. Not the champion.
- **D — Decision Criteria**: the written criteria the customer will use to decide. If the criteria aren't documented, the opp is not qualified.
- **D — Decision Process**: the steps and timeline the customer will follow (legal, procurement, security, exec sign-off).
- **I — Identify Pain**: the specific pain the customer has today. Generic pain ("we want to be more data-driven") doesn't count.
- **C — Champion**: an internal advocate who will sell on your behalf when you're not in the room. Must be tested ("Will you take my call at 9pm Tuesday if procurement stalls?").

### §1.1 — Stage definitions

| Stage | Probability | Required to move in |
|---|---|---|
| 1 — Discovery | 10% | First meeting held; named opportunity identified |
| 2 — Qualification | 25% | MEDDIC: M + E + I + C populated |
| 3 — Proposal | 50% | All 6 MEDDIC fields; proposal sent in writing |
| 4 — Negotiation | 75% | Verbal commit from EB; red-lines or pricing actively negotiated |
| 5 — Closed Won | 100% | Counter-signed order form on file |
| Closed Lost | 0% | Written notification or hard pass from EB; required to log competitor + reason |

**Stage 4 (Negotiation) at 75% is the bar for inclusion in the forecast commit.** Anything in Stage 1–3 sits in pipeline but not in commit.

---

## §2 — Discount approval

All discounts off list are subject to the matrix below. **The named approver must sign off in writing (email or deal-desk thread) before the discount is offered to the customer in any form — verbal, deck, or written proposal.**

### §2.1 — Discount matrix

| Discount off list | Annual contract value | Approver |
|---|---|---|
| ≤ 10% | Any | AE may grant unilaterally |
| 11% – 20% | < $500k | AE Manager (one-level-up) |
| 11% – 20% | ≥ $500k | RVP Sales |
| 21% – 30% | Any | VP Sales + Deal Desk |
| > 30% | Any | **VP Sales + CFO + Deal Desk** (all three) |
| Multi-year prepay discounts | Any | Always Deal Desk regardless of size |

### §2.2 — What counts as "discount"

A discount is any departure from list pricing — including:
- % off list per unit
- Free units, free months, free seats bundled in
- Waived implementation, training, or support fees
- Extended payment terms beyond Net 30
- MDF tied to the deal (counts as effective discount)

### §2.3 — The binding line

> *"No discount above 10% may be quoted to a customer — in any form, including verbally — before written approval from the named approver in §2.1. Discounts above 30% require all three of VP Sales, CFO, and Deal Desk to co-sign. AEs who quote unapproved discounts will have the deal pulled to deal-desk for re-pricing and may have the discount denied. People specialists should never represent a discount as 'approved' or 'standard' when it sits in the above-AE-threshold band."*

### §2.4 — How to submit to deal-desk

Email `deal-desk@kratos.example.com` with:
- Account name + opportunity id
- Requested discount % + reason
- TCV with and without the discount
- Competitive context (who you're up against, their indicative pricing)
- Customer's BATNA if you walk

Deal-desk SLA is 1 business day for ≤ 20%, 3 business days for above. Don't promise the customer a turnaround faster than that.

---

## §3 — Forecast hygiene

Forecast is locked weekly on Mondays at 09:00 PT. Three categories:

- **Commit**: deals you will close this quarter. Reps are accountable to commit number.
- **Best Case**: deals that could close this quarter with one good thing happening (red-lines back, EB recommit, etc.).
- **Pipeline**: everything else qualified.

### §3.1 — Rules

- An opp must be in Stage 4+ to enter Commit.
- Close date must be ≤ end of current quarter to enter Commit or Best Case.
- An opp may not stay in Commit for more than 2 weeks without movement (next-step or stage change). If it stagnates, it falls to Best Case automatically on the third Monday.
- Pulling a deal out of Commit between week 11 and quarter-end requires a 1:1 conversation with your manager — same day. No silent pulls.

### §3.2 — What "movement" means

- A stage advance
- A documented next-step with a date (not "follow up soon")
- A new activity logged in the last 7 days
- A red-flag (competitor introduced, contact left, slip) — counts as movement *because it changes the call*, but should trigger a manager 1:1.

---

## §4 — Competitive

Maintained battle cards live in `/sales/battle-cards/` on SharePoint. The headline calls:

- **vs Internal Build**: focus on opportunity cost of eng time and TCO over 3 years. Don't trash-talk eng teams — work with them.
- **vs Snowflake / Databricks (data-platform overlap)**: position as adjacent, not replacement. Joint-sell where possible.
- **vs Tableau / Looker (BI overlap)**: lean on real-time + governance.
- **vs Salesforce / HubSpot (CRM overlap)**: not a real competition — we integrate.

### §4.1 — Competitive disclosure

If a customer says "Vendor X is offering this for less", **never** match the price on the call. The pattern is: thank them, ask for the alternative quote in writing, take it to deal-desk with the data, come back with a response inside 24h. Reps who match on the call lose negotiating power and trigger a deal-desk audit.

---

## §5 — POCs and MDF

### §5.1 — POCs (Proof of Concept)

- POCs may be offered free for up to 30 days of customer effort, capped at 1 SE-week of Kratos effort.
- POCs > 30 days or > 1 SE-week require Deal Desk approval and a written success-criteria document signed by the customer's EB.
- A POC that does not have written success criteria is **not a POC** — it's a free pilot, and we don't do free pilots.

### §5.2 — MDF (Market Development Funds)

- MDF up to $25k per account per fiscal year: AE Manager approval.
- MDF $25k – $100k: RVP + Marketing co-approval.
- MDF > $100k: VP Sales + CMO + Deal Desk co-approval.
- MDF tied to a specific deal counts against the discount matrix in §2 (treat the MDF as an equivalent discount).

---

## §6 — Renewal playbook

Renewal motion varies by tier. The default cadence:

### §6.1 — Strategic accounts

- T-180 days: renewal team kickoff (AE + CSM). Pull the usage data, identify expansion opps.
- T-120 days: customer-side EB sync. Confirm budget, surface friction.
- T-90 days: written renewal proposal sent.
- T-60 days: red-lines back, deal-desk if any change to terms.
- T-30 days: target counter-sign by this point.
- T-0: renewal effective; CSM owns the post-renewal QBR within 30 days.

### §6.2 — Multi-year discount on renewal

A multi-year renewal (2y or 3y prepay) may carry up to 8% additional discount **on top of** standard pricing — no further deal-desk needed if total discount stays under the §2.1 unilateral threshold. Above that, deal-desk applies per §2.1.

### §6.3 — The downgrade rule

If the customer wants to downgrade ARR by more than 15% at renewal, that's a **save case**, not a routine renewal. The CSM and AE Manager get pulled in immediately. Don't process the downgrade and call it a win.

---

## §7 — Order form integrity

Every quote that goes to a customer must be generated from CPQ. No spreadsheet quotes, no Word-doc quotes, no "I'll just put together a rough number" emails. If CPQ is down, log a sales-ops ticket and wait — don't improvise.

Order forms are countersigned by:
- ARR ≤ $250k: AE + customer
- ARR $250k – $1M: AE Manager + customer
- ARR > $1M: VP Sales + customer

---

## §8 — Data hygiene minimums

Every account in your book must have:
- A primary contact with a working email
- An owner (you) + a CSM if it's a customer (post-Close Won)
- An update in the last 30 days (activity, opp move, contact update — anything)

Accounts that fail this for two consecutive months are reassigned by sales-ops without warning. Don't let your book go stale.

---

*If the situation isn't covered above, escalate to `deal-desk@kratos.example.com` and CC your manager. Don't improvise a policy.*
