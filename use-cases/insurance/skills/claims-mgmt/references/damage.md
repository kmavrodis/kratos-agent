# Claim Damage Assessment — Cost Prediction

## Purpose

Predict repair or replacement costs by analyzing submitted evidence (photos, documents, and structured claim data). This sub-skill provides a preliminary damage estimate to accelerate claims processing and support the adjuster's review.

## Model Requirement

- **Azure OpenAI LLM (Vision enabled)** — must use a vision-capable model deployment to analyze submitted images (e.g. vehicle photos, property damage, medical documents)
- The model receives both text context and image inputs in a single multimodal request

## When to Invoke

- After triage has classified the claim type and urgency
- After the ARGUS Doc Extraction MCP server has extracted structured data from submitted documents/images
- For claim types: `motor`, `property`, `travel` (luggage/belongings damage), `health` (itemized medical costs)

## Input

The damage assessment receives:

1. **Triage output** — claim type, urgency, and flags from the triage step
2. **Extracted evidence data** — structured information from ARGUS (text extracts, OCR results, metadata)
3. **Submitted images** — photos of the damage (vehicle, property, belongings, injury documentation)
4. **Policy context** — coverage limits, deductibles, and applicable endorsements from the customer's active policy (retrieved via CRM). This data is already loaded by the crm skill — do **not** ask the user to provide policy documents or insurance certificates

## Assessment Process

### Step 1 — Visual Damage Analysis

For each submitted image:
- Identify the type of damage visible (structural, cosmetic, total loss, partial)
- Assess severity on a scale: `minor`, `moderate`, `severe`, `total_loss`
- Note specific damage elements (e.g. "front bumper cracked, headlight shattered, hood dented")

### Step 2 — Cost Estimation

Based on visual analysis and extracted documents:
- Estimate repair/replacement costs using damage type and severity
- Factor in regional cost benchmarks where available
- Separate labor, parts/materials, and any additional costs (towing, rental vehicle, temporary accommodation)

### Step 3 — Policy Limit Check

Cross-reference the estimated cost against:
- Policy coverage limits for the specific claim type
- Applicable deductibles
- Any sub-limits (e.g. luggage limit of 3000 CHF, glass coverage, roadside assistance caps)
- Endorsements or add-ons that may modify coverage

## Output

Return a structured damage assessment:

```json
{
  "damage_severity": "<minor|moderate|severe|total_loss>",
  "damage_description": "Detailed description of observed damage",
  "estimated_cost": {
    "total": 0.00,
    "currency": "CHF",
    "breakdown": {
      "labor": 0.00,
      "parts_materials": 0.00,
      "additional": 0.00
    }
  },
  "policy_coverage": {
    "applicable_limit": 0.00,
    "deductible": 0.00,
    "estimated_payout": 0.00,
    "sub_limits_applied": ["list of sub-limits that cap any portion"],
    "coverage_gap": 0.00
  },
  "confidence": 0.0-1.0,
  "notes": "Any caveats, assumptions, or items requiring physical inspection",
  "requires_physical_inspection": true/false
}
```

## Assessment Rules

1. If estimated cost exceeds **80% of the insured value** for motor claims, flag as potential `total_loss`
2. Always recommend physical inspection when confidence is below 0.75 or when images are low quality / insufficient
3. Never present the estimate as a final settlement amount — this is a **preliminary assessment** to support the adjuster
4. For medical/health claims, do not estimate costs from images alone — rely on extracted itemized bills from ARGUS
5. If damage appears inconsistent with the incident description from triage, flag for fraud review
6. Costs must always be expressed in the policy's currency (typically CHF for this portfolio)

## Integration Notes

- This sub-skill depends on output from both **Triage** and the **ARGUS Doc Extraction MCP server**
- Results feed into the **Pre-Assessment** sub-skill for final coverage determination
- If damage inconsistencies are detected, the **Fraud Score** sub-skill should be invoked with elevated priority
