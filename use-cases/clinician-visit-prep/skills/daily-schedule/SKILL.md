---
name: daily-schedule
description: Pull a clinician's schedule for a date and produce one-line summaries for each patient
enabled: true
---

## Instructions

Use this skill when the user asks for today's clinic schedule, tomorrow's schedule, or a brief on the list of patients they're seeing (e.g. "Brief me on my patients for 2 June", "What's my clinic look like today, I'm Dr. Solomon", "Who am I seeing tomorrow?").

### 1. Resolve the practitioner

- If the user said "I'm Dr. {name}" or "I'm {practitioner_id}" → `epic_get_practitioner` to confirm and pull their department.
- If just "today" without a clinician → ask which clinician they want the schedule for.

### 2. Pull the day's schedule

`epic_list_practitioner_schedule(practitioner_id, from_date, to_date)` — same date for both.

### 3. For each booked encounter, fetch a quick context

For each `Booked` or `Planned` encounter, in parallel:

- `epic_get_patient(patient_id)` — name, DOB, MRN
- `epic_list_conditions(patient_id)` — active problem list (default — `include_resolved: false`)
- `epic_list_allergies(patient_id)` — any severe allergies to flag

### 4. Render

```markdown
# 2 June 2026 — Dr. Aniyah Solomon (Internal Medicine, Adult Primary Care)

## Schedule (3 patients)

### 10:00 · ENC-200003 · Office Visit · 30 min
**Eleanor Hsu (PAT-100001, MRN-100001)** — F, 78 (DOB 12 Mar 1948)
- **Reason today:** Follow-up — BP not at goal on current regimen
- Active problems: HTN, T2DM, ASCVD (post-MI 6 months ago)
- Allergies: ⚠️ Penicillin (moderate, rash)

### 10:45 · ENC-200102 · Office Visit · 25 min
**Marcus Bell (PAT-100002, MRN-100002)** — M, 44 (DOB 4 Sep 1981)
- **Reason today:** Follow-up after antibiotic course (acute bronchitis)
- Allergies: 🔴 Sulfa drugs (severe, hives + swelling)

### 16:30 · ENC-200501 · Office Visit · 30 min
**George Achterberg (PAT-100006, MRN-100006)** — M, 70 (DOB 22 Jul 1955)
- **Reason today:** Chronic kidney disease follow-up + A1C check
- Active problems: CKD stage 3, T2DM (with hyperglycemia), HTN
```

### Constraints

- Compute age from DOB in the chat (the tool returns DOB only).
- Flag severe allergies with 🔴, moderate with ⚠️.
- If a patient has no allergies on file, say "Allergies: none on file" — don't omit the line.
- Order strictly by encounter `start` time.
- Skip Cancelled / Finished encounters from the day's brief — focus on what's still ahead.
