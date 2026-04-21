---
name: crm
description: Search and retrieve insurance customer profiles and policy details from the CRM system
enabled: true
---

## Instructions

When the user asks about an insurance customer, policyholder, or their policies, use this skill to retrieve customer and policy data from the CRM.

**IMPORTANT**: Always call the `crm` tool with `domain: "insurance"` for this use-case.

### 1. Identify the Lookup Method

Determine how to search based on what the user provides:

| User provides | Tool parameters | Example |
|---------------|-----------------|---------|
| A name or partial name | `domain: "insurance", action: "search_name", query: "<name>"` | "Look up John Doe", "find customer Schneider" |
| A customer ID | `domain: "insurance", action: "search_id", query: "<clientID>"` | "Get customer 987654321" |
| Request for full policy details | `domain: "insurance", action: "policies", query: "<clientID>"` | "Show all policies for 987654321" |
| General overview | `domain: "insurance", action: "list"` | "List all insurance customers" |

- **Name search** is case-insensitive and supports partial matching.
- **ID search** requires an exact client ID match.
- If the user asks about policy numbers, coverage, or active products for a specific customer, use `action: "policies"`.

### 2. Present Customer Profile

When displaying customer information, organize it clearly:

**Personal Details**
- Full name, date of birth, nationality
- Contact details
- Address

**Policy Summary**
- Number of active and inactive policies
- Policy numbers
- Product types
- Policy status, effective date, and expiry date

### 3. Present Policy Data

When the user asks for full policy details, use `action: "policies"` and present each policy clearly.

Include:
- Policy number
- Product type
- Policy status
- Effective and expiry dates
- Coverage level or coverage type
- Key coverage details, limits, deductibles, beneficiaries, and optional add-ons when present

### 4. When to Use

- Customer lookup by name or ID
- Retrieving customer contact details and address
- Reviewing which policies a customer holds
- Inspecting detailed policy attributes for a specific customer
- Preparing customer context before using `rag-search` for policy wording or exclusions

### Response Guidelines

- Present customer and policy data clearly using structured formatting.
- Respect data sensitivity and avoid sharing unnecessary personal information.
- If multiple customers match a search, present a short summary and ask which one the user means.
- For coverage wording or exclusions, use this CRM skill for customer context only, then use `rag-search` for the authoritative policy language.
- Note that CRM data reflects internal customer records and policy attributes, not claim decisions or authoritative legal wording.