---
name: email-draft
description: Compose professional insurance emails — claim acknowledgments, coverage confirmations, escalation notices, and policyholder correspondence
enabled: true
---

## Instructions

When the user asks you to write, draft, or compose an email, follow these guidelines:

### 1. Gather Context

Before drafting, identify:
- **Recipient**: Who is this email for? (policyholder, agent, underwriter, claims adjuster, compliance)
- **Purpose**: What is the desired outcome? (acknowledge claim, confirm coverage, escalate, request info, notify)
- **Tone**: What register is appropriate? (formal for policyholders, professional-friendly for internal)
- **Key points**: What must be included?

If the user provides bullet points or rough notes, expand them into polished prose. If context is vague, ask one clarifying question — do not over-ask.

### 2. Insurance-Specific Templates

#### Claim Acknowledgment
```
Subject: Claim Received — [Claim Number]

Dear [Policyholder Name],

We have received your [type] claim filed on [date] regarding [brief description]. Your claim reference number is [Claim Number].

A claims adjuster will review your submission and contact you within [X] business days. In the meantime, please gather any supporting documentation (photos, receipts, police reports) that may help expedite the process.

If you have questions, contact our claims team at [phone] or reply to this email.

Sincerely,
[Agent Name]
[Company Name]
```

#### Coverage Confirmation
```
Subject: Coverage Confirmation — Policy [Policy Number]

Dear [Policyholder Name],

This letter confirms that the following coverage is active under your policy [Policy Number]:

- Policy type: [type]
- Effective dates: [start] to [end]
- Coverage limits: [limits]
- Deductible: [amount]

Please review the details above. If you have questions or need to make changes, contact your agent.

Sincerely,
[Agent Name]
```

#### Escalation Notice (Internal)
```
Subject: Escalation Required — [Claim/Policy Number]

Hi [Manager/Underwriter Name],

I'm escalating the following case for your review:

- **Reference**: [number]
- **Policyholder**: [name]
- **Issue**: [brief description]
- **Reason for escalation**: [reason — e.g., coverage ambiguity, high-value claim, PEP flag]
- **Action needed**: [what you need from the recipient]

Please review by [date] so we can respond to the policyholder within our SLA.

Thanks,
[Your Name]
```

#### Information Request
```
Subject: Additional Documentation Needed — Claim [Claim Number]

Dear [Policyholder Name],

To continue processing your claim [Claim Number], we need the following documentation:

- [Item 1]
- [Item 2]
- [Item 3]

Please submit these documents by [date] to avoid delays. You can reply to this email with attachments or upload them through our portal.

Thank you for your prompt attention.

Sincerely,
[Agent Name]
```

### 3. Tone Guidelines

| Audience | Tone | Example greeting |
|----------|------|------------------|
| Policyholder | Formal, empathetic | "Dear [Name]," |
| Internal colleague | Professional-friendly | "Hi [Name]," |
| Agent / broker | Professional, concise | "Hi [Name]," |
| Compliance / legal | Formal, precise | "Dear [Name]," |

### 4. Best Practices

- **Subject line**: Include claim/policy number for traceability
- **Length**: 100-200 words unless the user requests otherwise
- **Always include**: Reference numbers (claim, policy), relevant dates, clear next steps
- **Never include**: Full policy numbers in subject lines to external recipients, sensitive PII beyond what's necessary
- **Call to action**: End with a clear next step and deadline if applicable

### 5. File Output

If the user wants the email saved as a file:
1. Use `code_interpreter` to write the email to `/tmp/email_draft.txt`
2. Reference the path so the user can download it

## Constraints

- Never fabricate claim numbers, policy numbers, or dates — use `[placeholder]` markers
- Never include real email addresses unless the user provides them
- Default sign-off name: `[Your Name]`
- Always mask sensitive policyholder data in examples
