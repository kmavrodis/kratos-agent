---
name: lab-trend
description: Show a side-by-side trend of one or more lab values for a patient
enabled: true
---

## Instructions

Use this skill when the user asks for a trend, history, or progression of specific lab values (e.g. "Show me Eleanor's last 3 A1Cs", "George's eGFR trend", "How has Tomás's lipid panel changed?").

### 1. Resolve the patient

`epic_search_patients_by_name` → `epic_get_patient` if needed.

### 2. Pull observations for each lab code

For each lab code the user named, call `epic_list_observations(patient_id, code: '<code>', limit: 10)`.

Common codes in our fixtures: `A1C`, `BP`, `LDL`, `EGFR`, `TSH`, `FT4`, `HR`, `TEMP`, `SPO2`, `PEF`.

### 3. Render side-by-side

For one lab:

```markdown
# George Achterberg (PAT-100006) — HbA1c trend

| Date | HbA1c | Interpretation |
|---|---|---|
| 10 Mar 2026 | 7.8% | Above goal |
```

For multiple labs:

```markdown
# George Achterberg (PAT-100006) — Lab trends

## HbA1c
| Date | Value | Interpretation |
|---|---|---|
| 10 Mar 2026 | 7.8% | Above goal |

## eGFR
| Date | Value | Interpretation |
|---|---|---|
| 10 Mar 2026 | 42 mL/min/1.73m² | CKD stage 3 |

## Reading
A1C is drifting up against an eGFR that puts him in CKD-3. Consider the SGLT-2 indication for renal protection (he's already on empagliflozin) and whether adding a GLP-1 is appropriate. Recheck both in 3 months.
```

### Constraints

- Quote values + units verbatim.
- Order newest-first by `effective_at`.
- If the patient has no readings for the requested code, say so directly ("No HbA1c on file in the last 12 months.").
- The "Reading" section is clinical context, not a recommendation — keep it short and frame as considerations.
