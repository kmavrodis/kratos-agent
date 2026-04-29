# Triage — Claim Classification

## Purpose

Classify incoming insurance claims by type and urgency to route them through the correct downstream processing pipeline. This is the first step in claims intake and determines which sub-skills and workflows are activated.

## Model Requirement

- **Azure OpenAI SLM** — use a small language model deployment (e.g. `gpt-5-mini`) for fast, cost-efficient classification
- This task does not require vision or high-reasoning capabilities

## Classification Categories

The triage step must assign each claim to exactly **one primary type**:

| Claim Type | Description | Examples |
|------------|-------------|----------|
| `motor` | Vehicle damage, collision, theft, windshield, roadside incidents | Car accident, vandalism, hail damage to vehicle |
| `property` | Damage to residential or commercial property | Fire, water damage, storm, burglary |
| `travel` | Travel-related incidents covered under travel insurance | Trip cancellation, luggage loss, medical emergency abroad |
| `life` | Life insurance claims including death benefit and disability | Death benefit claim, premium waiver on disability |
| `liability` | Third-party liability claims | Bodily injury to third party, property damage caused to others |
| `health` | Medical or health-related claims | Hospitalization, outpatient treatment, dental emergency |

## Urgency Levels

Each claim must also be assigned an urgency level:

| Urgency | Criteria |
|---------|----------|
| `critical` | Bodily injury, hospitalization, fatality, active emergency |
| `high` | Significant property damage, vehicle total loss, large-value claim |
| `standard` | Routine claims — minor damage, luggage, windshield, travel delay |
| `low` | Informational inquiries, claim status follow-ups, minor amendments |

## Input

The triage step receives the raw claim submission from the frontend, which may include:

- Free-text description of the incident
- Claim form fields (date, location, policy number, involved parties)
- Optional: attached file names or evidence metadata (but not the files themselves — those are handled by the ARGUS Doc Extraction MCP server)
- **CRM-resolved data** — if the **crm** skill has already identified the customer and loaded their active policy, include the policy type and status in the triage context. This is authoritative — do not ask the user to confirm or re-provide policy details that CRM has already supplied

## Output

Return a structured triage result:

```json
{
  "claim_type": "<motor|property|travel|life|liability|health>",
  "urgency": "<critical|high|standard|low>",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of classification decision",
  "recommended_next_steps": ["damage_assessment", "fraud_check", "pre_assessment"],
  "flags": ["potential_fraud", "multi_policy", "catastrophe_event"]
}
```

## Classification Rules

1. If the description mentions bodily injury or fatality, set urgency to `critical` regardless of claim type
2. If the claim involves multiple policies for the same customer, add `multi_policy` flag
3. If the incident description matches known catastrophe event patterns (e.g. named storms, floods, earthquakes), add `catastrophe_event` flag
4. If the reported loss amount significantly exceeds typical values for the claim type, add `potential_fraud` flag for downstream fraud scoring
5. When confidence is below 0.7, flag for manual review by a claims handler

## Integration Notes

- Triage runs **before** document extraction — it operates on structured form data and free-text only
- After triage, the claim is routed to the appropriate combination of: Damage Assessment, Fraud Scoring, and Pre-Assessment
- Document extraction is handled externally by the **ARGUS Doc Extraction MCP server** and is not part of this skill
