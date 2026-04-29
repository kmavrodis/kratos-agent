# Fraud Score — Fraud Risk Assessment

## Purpose

Calculate a fraud risk score for each submitted claim by analyzing claim data patterns, customer history, and CRM records. This sub-skill flags suspicious claims for investigation by the Special Investigations Unit (SIU) before settlement proceeds.

## Model Requirement

- **Azure OpenAI LLM** — standard reasoning model for pattern analysis and risk scoring
- **CRM data via crm skill** — uses the existing **crm** skill (called with `domain: "insurance"`) to retrieve customer history, prior claims, policy changes, and behavioral patterns

## When to Invoke

- After triage for **every** claim (fraud scoring is mandatory in the pipeline)
- With elevated priority when triage flags `potential_fraud`
- With elevated priority when damage assessment detects inconsistencies between reported incident and observed damage

## Input

The fraud scoring step receives:

1. **Triage output** — claim type, urgency, flags, and incident description
2. **Damage assessment output** — estimated costs, damage severity, any inconsistency notes
3. **CRM customer data** — retrieved via the **crm** skill with `domain: "insurance"`, including:
   - Customer profile (tenure, contact history, address changes)
   - Prior claims history (frequency, types, amounts, outcomes)
   - Policy modification history (recent coverage increases, add-ons before incident)
   - Payment history (lapsed policies, late payments, reinstatements)
4. **Extracted evidence metadata** — from ARGUS (document authenticity signals, timestamp consistency)

## Fraud Indicators

The model evaluates the following risk signals:

### High-Risk Indicators (weighted heavily)

| Indicator | Description |
|-----------|-------------|
| **Recent coverage increase** | Coverage limit or add-on increased shortly before the claim (< 90 days) |
| **Claims frequency** | Multiple claims within 12 months, especially same claim type |
| **Inconsistent damage** | Damage assessment doesn't match the reported incident narrative |
| **Policy timing** | Claim filed very early in the policy term (< 60 days from effective date) |
| **Document anomalies** | ARGUS extraction flags on document authenticity, altered dates, or metadata inconsistencies |

### Medium-Risk Indicators

| Indicator | Description |
|-----------|-------------|
| **Address changes** | Recent address change before or after the incident |
| **Duplicate patterns** | Similar claim details to previously flagged or denied claims in the portfolio |
| **Excessive claim amount** | Claimed amount significantly above market rates for the damage type |
| **Third-party involvement** | Known third-party repair shops or medical providers with elevated fraud history |
| **Weekend/holiday filing** | Incident reportedly occurred on weekend/holiday with delayed reporting |

### Low-Risk Indicators

| Indicator | Description |
|-----------|-------------|
| **Long-tenure customer** | Customer with 5+ years of clean history |
| **Consistent reporting** | Incident details consistent across all submitted evidence |
| **Moderate claim amount** | Claim within normal range for the damage type and coverage |

## Output

Return a structured fraud assessment:

```json
{
  "fraud_score": 0-100,
  "risk_level": "<low|medium|high|critical>",
  "triggered_indicators": [
    {
      "indicator": "indicator_name",
      "weight": "<high|medium|low>",
      "detail": "Specific finding"
    }
  ],
  "crm_context": {
    "customer_tenure_years": 0,
    "prior_claims_count_12m": 0,
    "prior_claims_total": 0,
    "recent_policy_changes": ["list of changes within 90 days"],
    "payment_status": "current|lapsed|reinstated"
  },
  "recommendation": "<proceed|enhanced_review|siu_referral>",
  "reasoning": "Summary of fraud risk assessment rationale",
  "confidence": 0.0-1.0
}
```

## Scoring Rules

| Score Range | Risk Level | Action |
|-------------|-----------|--------|
| 0–25 | `low` | Proceed to pre-assessment |
| 26–50 | `medium` | Proceed with enhanced documentation requirements |
| 51–75 | `high` | Flag for senior adjuster review before proceeding |
| 76–100 | `critical` | Mandatory SIU referral — do not proceed to settlement |

## Processing Rules

1. **Every claim gets scored** — no exceptions, even for long-tenure customers
2. When CRM data is unavailable from the **crm** skill, assign a baseline medium-risk score and flag `crm_data_unavailable`
3. Never disclose the fraud score or fraud indicators to the claimant or frontend user — this is internal-only data
4. If multiple high-risk indicators trigger simultaneously, escalate to `critical` regardless of the numerical score
5. Fraud scoring must complete **before** the pre-assessment step proceeds
6. Log all fraud assessments for audit trail and model improvement

## Integration Notes

- CRM data is fetched via the **crm** skill — call with `domain: "insurance"` and use `action: "search_id"` or `action: "policies"` to retrieve customer history and policy details. The crm skill runs as an earlier step in the claims-mgmt pipeline and its output is passed to fraud scoring.
- Results feed into the **Pre-Assessment** sub-skill as a gating factor
- If fraud score is `critical`, the pipeline halts and routes to SIU — pre-assessment is skipped
- Fraud scores and indicators are stored but **never exposed** to the frontend or the claimant
