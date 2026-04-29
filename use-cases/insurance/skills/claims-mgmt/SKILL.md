---
name: claims-mgmt
description: End-to-end claims intake and processing pipeline — triage, damage assessment, fraud scoring, and pre-assessment for human adjuster review
enabled: true
---

## Overview

The **claims-mgmt** skill orchestrates the full claims automation pipeline for insurance claims submitted through the frontend. It coordinates four internal sub-skills and one external MCP service to process a claim from initial submission to a structured recommendation ready for human review.

## Pipeline Architecture

```
Claim Submission (Frontend)
        │
        ▼
   ┌─────────┐
   │ TRIAGE  │  ← Classify claim type & urgency (SLM)
   └────┬────┘
        │
        ▼
   ┌──────────────────┐
   │ EVIDENCE CHECK   │  ← Are documents/images attached?
   └────┬─────────────┘
        │
        ├── YES (≥1 document) ──────────────────────┐
        │   (proceed immediately;                    │
        │    mention optional extras but             │
        │    do NOT block for them)                  ▼
        │                                 ┌──────────────────┐
        │                                 │ DOC EXTRACTION   │
        │                                 │ ┌─ ARGUS MCP     │  ← Preferred: external
        │                                 │ │  (preferred)    │     MCP extraction
        │                                 │ └─ FALLBACK:     │  ← Fallback: native
        │                                 │    Vision LLM    │     model analysis
        │                                 └────┬─────────────┘
        │                                      │
        ├── NO (0 documents) ───┐              │
        │                       ▼              │
        │              ┌────────────────┐      │
        │              │ ASK USER for   │      │
        │              │ at least 1 doc │      │
        │              └────────┬───────┘      │
        │                       │              │
        │                  (loop until ≥1)     │
        │                       │              │
        │                       └──────────────┤
        │                                      │
        │                                 ┌────┴────────────────────────┐
        │                                 │                             │
        │                                 ▼                             ▼
        │                          ┌──────────────┐      ┌──────────────┐
        │                          │   DAMAGE     │      │   FRAUD      │
        │                          │  ASSESSMENT  │      │   SCORE      │
        │                          │ (Vision LLM) │      │ (LLM + CRM  │
        │                          └──────┬───────┘      │   skill)     │
        │                                 │              └──────┬───────┘
        │                                 │                     │
        │                                 └──────────┬──────────┘
        │                                            │
        │                                            ▼
        │                                  ┌─────────────────┐
        │                                  │ PRE-ASSESSMENT  │  ← Coverage determination
        │                                  │ (High Reasoning │     for human review
        │                                  │      LLM)       │     (o3 / o4-mini)
        │                                  └────────┬────────┘
        │                                           │
        └───────────────────────────────────────────►│
                                                    ▼
                                            Human Adjuster Review
```

## Sub-Skills (Internal)

| Sub-Skill | Reference | Model | Purpose |
|-----------|-----------|-------|---------|
| **Triage** | [references/triage.md](references/triage.md) | Azure OpenAI SLM | Classify claim type and urgency |
| **Damage Assessment** | [references/damage.md](references/damage.md) | Azure OpenAI LLM (Vision enabled) | Predict costs by analyzing submitted evidence |
| **Fraud Score** | [references/fraud.md](references/fraud.md) | Azure OpenAI LLM + CRM via MCP | Calculate fraud risk score |
| **Pre-Assessment** | [references/assessment.md](references/assessment.md) | Azure OpenAI LLM (High Reasoning) | Assess policy coverage and produce settlement recommendation |

## External Dependency

| Service | Type | Purpose |
|---------|------|---------|
| **ARGUS Doc Extraction** | External MCP Server "argus" | **Preferred** extraction method. Extract structured information from submitted evidence (text + images) using Azure OpenAI Vision + Azure Document Intelligence. Configured separately in `mcp.json` — not managed by this skill. |

### ARGUS Fallback — Native Vision LLM Extraction

ARGUS is the **preferred** extraction method, but the pipeline must not fail if it is unavailable. If ARGUS cannot be used — because it is not configured in `mcp.json`, the MCP server is unreachable, or the call returns an error — fall back to **native Vision LLM extraction**:

1. Use the same Vision-capable model used by Damage Assessment to analyze the submitted images and documents directly
2. Extract all available structured information: damage descriptions, dates, amounts, names, vehicle details, locations, and any other claim-relevant data visible in the evidence
3. For text-based documents (PDFs, invoices, reports), extract key fields and summarize the content
4. For images, describe visible damage, read any text/labels in the image, and note relevant details
5. Produce output in the same structured format that ARGUS would return, so downstream steps (Damage Assessment, Fraud Score, Pre-Assessment) can consume it without changes
6. Add `"extraction_method": "fallback_vision_llm"` to the output so downstream steps know ARGUS was not used
7. Add `"extraction_note": "Extracted via native Vision LLM — ARGUS MCP was unavailable. Results may be less detailed than full document intelligence extraction."` to flag reduced fidelity

The fallback extraction is **good enough** to proceed through the full pipeline. Do **not** halt the pipeline or ask the user to try again later because ARGUS is unavailable.

## When to Invoke

Use the **claims-mgmt** skill when:

- A customer submits a new insurance claim through the frontend
- A claims handler initiates a claim intake workflow
- An existing claim needs to be re-assessed (e.g. new evidence submitted)
- The user asks to process, evaluate, or assess an insurance claim

## Pipeline Execution Rules

### Ordering & Dependencies

1. **Triage** runs first — always. It determines the claim type and routes the pipeline.
2. **Evidence Check** — after triage, verify whether the user has submitted at least one supporting document (photo, report, invoice, or any claim-related file). If **no documents are attached**, pause the pipeline and ask the user to provide at least one piece of evidence before proceeding. Repeat until at least one document is available. Triage results are preserved and do not need to be re-run.
3. **Document Extraction** runs once evidence is available. Attempt **ARGUS Doc Extraction** (external MCP) first. If ARGUS is not configured or fails, fall back to **native Vision LLM extraction** (see ARGUS Fallback section). Wait for extraction results before proceeding.
4. **Damage Assessment** and **Fraud Score** can run **in parallel** after extraction completes — they are independent of each other.
5. **Pre-Assessment** runs last — it requires outputs from all upstream steps (triage, extraction, damage, fraud).

### Evidence Requirements

The pipeline **cannot proceed past triage** without at least one supporting document. Acceptable evidence includes:

- Photos of the damage (vehicle, property, belongings, injury)
- Police or accident reports
- Repair estimates or invoices
- Medical reports or bills
- Third-party correspondence
- Any other claim-related documentation

**When evidence is missing** (0 documents), respond to the user with:
1. Confirmation that the claim has been triaged (share the claim type and urgency)
2. A clear request to upload or provide at least one supporting document to continue processing
3. Examples of acceptable documents based on the claim type (e.g. "For a motor claim, please provide photos of the vehicle damage, a police report, or a repair estimate")
4. Reassurance that additional documents can be added later, but at least one is needed now to proceed

**When at least 1 document is received**, the pipeline **proceeds immediately** to ARGUS extraction and downstream steps. Do NOT pause to ask for additional evidence — proceed with what is available. You MAY include a brief note that the user can optionally provide additional documents at any time to strengthen the claim, but this must not block the pipeline.

**Do NOT** skip this check or proceed to damage assessment / fraud scoring / pre-assessment without evidence.

### CRM-Resolved Policyholder Rule

When the **crm** skill has already identified the customer and loaded their active policy, **do NOT** ask the user to provide:
- Insurance certificate or policy confirmation
- Policy number or policy documents
- Any information that is already available from CRM

The CRM-loaded policy data (coverage limits, deductibles, endorsements, policy status, effective dates) is the authoritative source. Treat it as already available for all downstream steps. Only ask for information that is genuinely missing and cannot be retrieved from CRM or the user's prior messages.

### Gating Rules

- If **no evidence documents** are attached → pause pipeline after triage, ask the user to provide at least one document, and do not proceed until received
- If **≥1 evidence document** is attached → proceed immediately through the full pipeline. Mention that additional documents can be submitted later to strengthen the claim, but do **not** block or pause for them
- If **Triage** confidence is below 0.7 → flag for manual classification before proceeding
- If **Fraud Score** returns `critical` (76–100) → halt pipeline, route to SIU. Do **not** proceed to pre-assessment
- If **Damage Assessment** confidence is below 0.75 → proceed but flag `requires_physical_inspection` in the pre-assessment
- If **ARGUS extraction** fails or is unavailable → fall back to native Vision LLM extraction (see ARGUS Fallback section) and proceed. Add `extraction_method: "fallback_vision_llm"` to the extraction output. Only flag `incomplete_evidence` if the fallback also fails to extract meaningful data

### Data Flow

- Each step passes its structured output to the next step(s) in the pipeline
- The **Pre-Assessment** step aggregates all upstream outputs into the final recommendation
- CRM data is fetched via MCP with `domain: "insurance"` — used by both Fraud Score (customer history) and Pre-Assessment (policy details)
- Policy wording is retrieved via `rag-search` with `index_name: "ins-knowledge-base"` — used by Pre-Assessment

## Skill Dependencies

This skill integrates with other insurance skills:

| Skill | Usage |
|-------|-------|
| **crm** | Fetch customer profile and policy details (`domain: "insurance"`) — used by Fraud Score and Pre-Assessment |
| **rag-search** | Retrieve internal policy wording, exclusions, and procedures (`index_name: "ins-knowledge-base"`) — used by Pre-Assessment |
| **web-search** | Optional — check for active catastrophe events or regulatory notices when triage flags `catastrophe_event` |

## Response Format

When the full pipeline completes, present the results to the user as a structured claims processing summary:

1. **Triage Result** — claim type, urgency, classification confidence
2. **Evidence Extraction Summary** — key data points extracted from submitted documents (from ARGUS MCP or native Vision LLM fallback). If fallback was used, briefly note this but do not overemphasize it
3. **Damage Estimate** — severity, estimated cost, breakdown, policy limit check
4. **Fraud Assessment** — risk level and recommendation (do NOT expose fraud score or indicators to the claimant)
5. **Pre-Assessment Recommendation** — coverage determination, preliminary entitlement, conditions, and items for adjuster review

## Security & Compliance

- **Fraud data is internal only** — never expose fraud scores, indicators, or SIU referrals to the frontend or the claimant
- **Pre-assessment is advisory** — always mark `requires_human_review: true`. The system does not approve or deny claims autonomously
- **Audit trail** — all pipeline steps and their outputs must be logged for regulatory compliance
- **Data sensitivity** — mask personal identifiers when displaying results. Follow the same data masking rules as the CRM skill
- **Evidence handling** — submitted images and documents are processed but not stored within this skill. Storage is handled by the platform
