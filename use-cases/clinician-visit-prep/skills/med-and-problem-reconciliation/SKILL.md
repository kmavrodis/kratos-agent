---
name: med-and-problem-reconciliation
description: List a patient's active problem list and current medications, grouped by indication, for quick reconciliation
enabled: true
---

## Instructions

Use this skill when the user asks for the active problem list, current medications, or a med-reconciliation view (e.g. "Pull the problem list for Sofia", "What's Eleanor on right now?", "Med rec for PAT-100001").

### 1. Resolve the patient

`epic_search_patients_by_name` → `epic_get_patient` if needed.

### 2. Pull both

In parallel:
- `epic_list_conditions(patient_id)` — active problems
- `epic_list_medications(patient_id, status: 'active')` — current meds
- `epic_list_allergies(patient_id)` — for context (don't reconcile, just show)

### 3. Render

Group medications by `indication`:

```markdown
# Eleanor Hsu (PAT-100001) — Active Problems & Medications

## ⚠️ Allergies
- Penicillin — moderate (rash)

## Active problems (3)
- Essential hypertension (I10) — since 2014
- Type 2 diabetes mellitus (E11.9) — since 2017
- ASCVD (I25.10) — since Aug 2025 *(post-MI)*

## Active medications (5)

### Hypertension
- Lisinopril 20 mg PO daily — since 2014 *(prescribed by Dr. Solomon)*
- Metoprolol succinate 50 mg PO daily — since Aug 2025 *(Dr. Mendez)*

### Type 2 diabetes
- Metformin 1000 mg PO BID — since 2017 *(Dr. Solomon)*

### Post-MI secondary prevention
- Atorvastatin 40 mg PO QHS — since Aug 2025 *(Dr. Mendez)*
- Aspirin 81 mg PO daily — since Aug 2025 *(Dr. Mendez)*

## Reconciliation notes
- All five active medications are matched to an active problem on the problem list — no orphans.
- Prescriber split is appropriate: PCP owns chronic management, Cardiology owns post-MI regimen.
```

### Constraints

- Resolve `prescriber_id` to the practitioner's name in parens (call `epic_get_practitioner` if you don't have it cached from another call).
- Group meds strictly by `indication` field; alphabetise within group.
- If a medication has no matching problem on the list, surface it as an "Orphan medication" entry — that's clinically significant.
- If a problem has no matching medication, note it as "On the list, no active therapy" — also clinically significant.
- Don't make clinical recommendations here — this is reconciliation only.
