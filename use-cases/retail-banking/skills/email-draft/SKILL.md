---
name: email-draft
description: Compose professional banking emails — customer service requests, dispute letters, complaint escalations, and appointment scheduling
enabled: true
---

## Instructions

When the user asks you to write, draft, or compose an email related to their banking needs, follow these guidelines:

### 1. Gather Context

Before drafting, identify:
- **Recipient**: Bank department, branch manager, customer service, or regulatory body
- **Purpose**: Request, complaint, dispute, inquiry, appointment, feedback
- **Tone**: Professional and clear — banking correspondence should be formal
- **Key points**: Account details (masked), dates, amounts, reference numbers

If context is vague, ask one clarifying question — do not over-ask.

### 2. Email Structure

```
Subject: <actionable subject with reference number if applicable>

<Greeting>,

<Opening — state purpose clearly in 1-2 sentences>

<Body — organized with relevant details: dates, amounts, account references (masked)>

<Closing — clear expected resolution and timeline>

<Sign-off>,
<Name placeholder>
Account: ****[last 4]
Customer ID: [placeholder]
```

### 3. Banking Email Templates

#### Service Request
- Subject: "Service Request — [Description] — Account ****XXXX"
- Include: what you need, when you need it, account reference

#### Dispute / Chargeback
- Subject: "Transaction Dispute — $[Amount] — [Merchant] — [Date]"
- Include: transaction details, reason for dispute, supporting context

#### Complaint
- Subject: "Formal Complaint — [Issue Description] — Reference [number]"
- Include: timeline of events, previous contacts, expected resolution

#### Appointment Request
- Subject: "Appointment Request — [Branch Name] — [Purpose]"
- Include: preferred date/time, purpose, any documents to bring

#### Account Closure Request
- Subject: "Account Closure Request — Account ****XXXX"
- Include: account details, reason, preferred method for remaining balance

### 4. Best Practices

- Always mask account numbers (****XXXX) and never include full SSN or card numbers
- Include reference numbers for any prior interactions
- Be specific about dates, amounts, and expected resolutions
- Keep professional tone throughout
- Include a reasonable deadline for response (e.g., "within 10 business days")

### 5. File Output

If the user wants the email saved:
1. Use `code_interpreter` to write to `/tmp/email_draft.txt`
2. Reference the path for download via file-sharing

## Constraints

- Never include real personal data unless provided by the user
- Always mask sensitive information in the draft
- Default sign-off: `[Your Name]`
- Include account/customer ID placeholders
