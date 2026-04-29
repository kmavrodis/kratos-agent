# Pre-Assessment — Coverage & Settlement Recommendation

## Purpose

Assess the coverage applicability of the customer's policy against the submitted claim details and produce a structured recommendation for the human adjuster to review. This is the final automated step before human decision-making and must be thorough, well-reasoned, and citable.

## Model Requirement

- **Azure OpenAI LLM (High Reasoning)** — use a high-reasoning model deployment (e.g. `o3`, `o4-mini`) for complex policy interpretation, multi-factor coverage analysis, and nuanced exclusion evaluation
- This step requires deep reasoning over policy language, coverage terms, exclusions, sub-limits, and the interaction between multiple policy provisions

## When to Invoke

- After all upstream steps have completed:
  - **Triage** — claim classified
  - **ARGUS Doc Extraction** (external MCP) — evidence extracted
  - **Damage Assessment** — cost estimate produced
  - **Fraud Score** — fraud risk evaluated and cleared (score < 76)
- Do **NOT** invoke if fraud score is `critical` (76–100) — those claims route to SIU directly

## Input

The pre-assessment step receives the full pipeline context:

1. **Triage output** — claim type, urgency, classification confidence, flags
2. **Extracted evidence** — structured data from ARGUS (document contents, extracted fields, image analysis results)
3. **Damage assessment output** — estimated costs, severity, breakdown, policy limit check
4. **Fraud score output** — risk level, triggered indicators, CRM context, recommendation
5. **Customer policy details** — full policy record from CRM including:
   - Coverage type and level
   - Effective and expiry dates
   - Coverage limits, sub-limits, deductibles
   - Endorsements and add-ons
   - Beneficiaries
   - Exclusions applicable to the policy product
6. **Internal policy wording** — retrieved via `rag-search` from the insurance knowledge base for the specific product type

## Assessment Process

### Step 1 — Coverage Verification

Determine whether the claim falls within the policy's coverage scope:
- Is the policy active on the date of the incident?
- Does the claim type match the policy product (e.g. motor claim against motor policy)?
- Is the specific peril or event covered under the policy terms?
- Are there any applicable exclusions that would void or limit coverage?
- Are there waiting periods that have not yet elapsed?

### Step 2 — Exclusion Analysis

Systematically check all relevant exclusions:
- General exclusions applicable to the policy product
- Specific exclusions related to the claim circumstances
- Conditional exclusions (e.g. "excluded unless endorsement X is purchased")
- Quote the exact exclusion wording from the policy document when applicable

### Step 3 — Entitlement Calculation

Based on coverage verification and damage assessment:
- Determine the applicable coverage limit
- Apply the deductible
- Check sub-limits that may cap specific components (e.g. luggage sub-limit, glass coverage, rental vehicle days)
- Calculate the preliminary entitlement amount
- Identify any coverage gaps where costs exceed limits

### Step 4 — Recommendation Synthesis

Produce a human-readable recommendation that an adjuster can review and approve, modify, or reject.

## Output

Return a structured pre-assessment report:

```json
{
  "assessment_id": "unique_id",
  "claim_summary": {
    "claim_type": "<from triage>",
    "incident_date": "YYYY-MM-DD",
    "date_reported": "YYYY-MM-DD",
    "description": "Concise incident summary"
  },
  "coverage_determination": {
    "status": "<covered|partially_covered|not_covered|requires_review>",
    "policy_number": "PolicyNo",
    "policy_product": "Product type",
    "policy_status": "Active|Inactive|Lapsed",
    "incident_within_policy_period": true/false,
    "applicable_coverage": "Specific coverage section that applies",
    "exclusions_reviewed": [
      {
        "exclusion": "Exclusion description",
        "applies": true/false,
        "source": "Document name, page number",
        "impact": "How this affects the claim"
      }
    ],
    "waiting_period_elapsed": true/false/not_applicable
  },
  "financial_summary": {
    "estimated_loss": 0.00,
    "applicable_limit": 0.00,
    "deductible": 0.00,
    "sub_limits_applied": [
      {
        "component": "e.g. luggage",
        "limit": 0.00,
        "claimed": 0.00,
        "payable": 0.00
      }
    ],
    "preliminary_entitlement": 0.00,
    "coverage_gap": 0.00,
    "currency": "CHF"
  },
  "fraud_clearance": {
    "fraud_score": 0-100,
    "risk_level": "<low|medium|high>",
    "cleared_for_assessment": true
  },
  "recommendation": "<approve|approve_with_conditions|partial_approval|deny|escalate>",
  "conditions": ["List of conditions if approve_with_conditions"],
  "reasoning": "Detailed reasoning citing policy wording, coverage terms, and exclusion analysis",
  "requires_human_review": true,
  "review_notes": "Specific items the adjuster should verify or consider",
  "confidence": 0.0-1.0
}
```

## Assessment Rules

1. **Always cite policy wording** — every coverage determination and exclusion must reference the source document and page
2. **Never auto-approve** — `requires_human_review` is always `true`. This is a recommendation, not a decision
3. If any exclusion analysis is ambiguous, set status to `requires_review` and explain the ambiguity in `review_notes`
4. For `partially_covered` claims, clearly itemize which components are covered and which are not
5. If the policy is lapsed or inactive on the incident date, set status to `not_covered` with clear explanation
6. When multiple policies could apply (flagged as `multi_policy` by triage), assess each policy separately and present the most favorable coverage path
7. The preliminary entitlement must never exceed the applicable coverage limit minus the deductible
8. Include the fraud score summary but do not re-evaluate fraud — use the score as-is from the Fraud Score step
9. For claims with `medium` fraud risk, add a note in `review_notes` recommending enhanced verification

## Integration Notes

- This sub-skill uses **rag-search** with `index_name: "ins-knowledge-base"` to retrieve policy wording and exclusion language
- Customer and policy data comes from **CRM** with `domain: "insurance"`
- This is the terminal step of the automated pipeline — output is presented to the human adjuster via the frontend
- The adjuster can approve, modify, or reject the recommendation through the claims management interface
- All pre-assessment reports are stored for audit, compliance, and model improvement
