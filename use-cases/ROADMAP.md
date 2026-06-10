# Kratos use-case roadmap

The goal: one credible persona per major Microsoft industry vertical and every
internal horizontal function — so a Microsoft field SE can grab Kratos and
show any enterprise customer something in their language, with their systems,
in their workflow.

For *how* to build a persona to the bar (the seller test), see
`~/.copilot/skills/kratos-persona-builder/SKILL.md`. This doc is only about
*what to build next, in what order*.

## Shipped (9)

| Persona | Slot | MCPs |
|---|---|---|
| `generic` | Horizontal · utility | — |
| `wealth-management` | FSI · Wealth | (skills only) |
| `insurance` | FSI · Insurance | (skills only) |
| `retail-banking` | FSI · Banking | `faker` (migrate later) |
| `finance-close` | Internal · Finance | `sap-s4` + `m365-graph` + `workday` |
| `hr-onboarding` | Internal · HR | `workday` + `servicenow` + `m365-graph` |
| `it-service-desk` | Internal · IT Ops | `servicenow` + `workday` + `m365-graph` |
| `sales-account-review` | Internal · Sales | `salesforce` |
| `clinician-visit-prep` | Healthcare | `epic-fhir` |

All nine clear the seller-test bar. Reusable MCPs already in tree:
`workday`, `m365-graph`, `servicenow`, `salesforce`, `sap-s4`,
`core-banking`, `epic-fhir`.

## Target — 20 personas

One credible persona per slot is the north star.

| Slot | Today | Target |
|---|---|---|
| External verticals (Microsoft industry footprint) | 2 / 17 | ≥10 / 17 |
| Internal horizontals | 5 / 9 | 8 / 9 |
| **Total at "one per slot"** | **9 / 20 (45%)** | **20** |

Depth (second/third persona per vertical) is unbounded and lives in Phase D.
Don't open Phase D until the 20 are in.

## Next 11 — priority queue

Ordered by Microsoft strategic weight × MCP reuse cost. **Bold** MCPs already
exist in tree.

### Phase A — Industry breadth (5)

| # | Persona | Vertical | MCPs |
|---|---|---|---|
| 1 | Plant Floor Supervisor | Manufacturing | **`sap-s4`** + Azure IoT mock |
| 2 | Store Manager Morning Brief | Retail & CPG | POS mock + **`workday`** |
| 3 | Benefits Caseworker | Public Sector | Dataverse mock |
| 4 | Grid Storm Response | Energy & Utilities | **`sap-s4`** + weather + **`workday`** |
| 5 | NOC Triage | Telecom | **`servicenow`** + OSS mock |

### Phase B — Round out internals (3)

| # | Persona | Horizontal | MCPs |
|---|---|---|---|
| 6 | Procurement Buyer | Procurement | SAP Ariba mock + credit/sanctions |
| 7 | Legal Contract Review | Legal | Ironclad-style mock + redline output |
| 8 | Marketing Campaign Manager | Marketing | Dynamics 365 mock |

### Phase C — Remaining strategic verticals (3)

| # | Persona | Vertical | MCPs |
|---|---|---|---|
| 9 | Student Success Advisor | Education | SIS mock + **`m365-graph`** |
| 10 | Newsroom Editor | Media & Entertainment | CMS mock + social listening |
| 11 | Airline Ops Controller | Transport & Logistics | Flight-ops mock + weather |

After Phase C: **20 personas, 10 / 17 verticals, 8 / 9 horizontals.**

## Phase D — depth (optional, unbounded)

Second-persona-in-a-vertical work drops here once the 20 are in. Candidates
worth a Phase D PR: Mortgage Underwriter, AML Investigator, Care Coordinator
Discharge, Field Service Technician, Hotel Revenue Manager, Major Gifts
Officer, Commercial Leasing Agent, Precision Ag Advisor.

## Cadence

The rebuild wave (#13, #15, #16, #17, #19) shipped 5 personas in ~2 weeks,
so ≈ 2 personas / week at the seller-test bar. **Phase A + B + C ≈ 5–6 weeks**
of focused work to clear the 20-persona north star. Pick from the top of the
queue; don't skip ahead.
