---
name: email-draft
description: Compose professional emails from brief instructions, bullet points, or context
enabled: true
---

## Instructions

When the user asks you to write, draft, or compose an email, follow these guidelines:

### 1. Gather Context

Before drafting, identify:
- **Recipient**: Who is this email for? (colleague, client, executive, external partner)
- **Purpose**: What is the desired outcome? (inform, request, follow-up, escalate, thank)
- **Tone**: What register is appropriate? (formal, professional-friendly, casual)
- **Key points**: What must be included?

If the user provides bullet points or rough notes, expand them into polished prose. If context is vague, ask one clarifying question — do not over-ask.

### 2. Email Structure

Always produce a complete email with:

```
Subject: <concise, actionable subject line>

<Greeting>,

<Opening — context or purpose in 1-2 sentences>

<Body — organized paragraphs or bullet list covering all key points>

<Closing — clear next step or call to action>

<Sign-off>,
<Name placeholder>
```

### 3. Tone Guidelines

| Audience | Tone | Example greeting |
|----------|------|------------------|
| Executive / C-suite | Formal, concise, results-focused | "Dear [Name]," |
| Colleague / team | Professional-friendly | "Hi [Name]," |
| External client | Warm but professional | "Dear [Name]," |
| Support / vendor | Direct and clear | "Hello [Team]," |

### 4. Best Practices

- **Subject line**: 5-10 words, specific and actionable (e.g. "Q3 Budget Review — Action Required by Friday")
- **Length**: Aim for 100-200 words unless the user requests otherwise
- **Paragraphs**: Keep to 2-4 sentences each
- **Bullet points**: Use for lists of 3+ items
- **Call to action**: End with a clear, specific next step and deadline if applicable
- **Avoid**: Jargon the recipient wouldn't know, excessive hedging, walls of text

### 5. Variations

If the user asks for multiple options, provide 2-3 versions with different tones (e.g. formal vs. friendly) and let them pick.

### 6. Follow-ups

If the user asks to revise, adjust tone, shorten, or expand — iterate on the previous draft rather than starting from scratch.

### 7. File Output

If the user wants the email saved as a file:
1. Use `code_interpreter` to write the email to `/tmp/email_draft.txt` (or `.md`)
2. Reference the path so the user can download it via file-sharing

## Constraints

- Never fabricate specific dates, numbers, or facts the user hasn't provided — use `[placeholder]` markers
- Never include real email addresses unless the user provides them
- Default sign-off name: `[Your Name]`

## Examples

**User**: "Write an email to my manager asking for time off next week"

**Output**:
```
Subject: PTO Request — [Date Range]

Hi [Manager Name],

I'd like to request paid time off from [Start Date] through [End Date]. I've ensured my current deliverables are on track and will hand off any pending items to [Colleague Name] before I leave.

Please let me know if you need any additional details or if this timing works for the team.

Thanks,
[Your Name]
```

**User**: "Draft a client follow-up after our demo yesterday, mention the pricing proposal"

**Output**:
```
Subject: Great Connecting Yesterday — Next Steps on Pricing

Dear [Client Name],

Thank you for taking the time to join yesterday's demo. It was great to walk through the platform with your team, and I appreciated the thoughtful questions.

As discussed, I've attached our pricing proposal for your review. Here's a quick summary:
- **Starter tier**: [details]
- **Enterprise tier**: [details]
- **Custom options**: Available based on your team's requirements

I'd love to schedule a follow-up call next week to discuss any questions. Would [Day] at [Time] work for you?

Looking forward to hearing from you.

Best regards,
[Your Name]
```
