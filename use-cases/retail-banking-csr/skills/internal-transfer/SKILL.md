---
name: internal-transfer
description: Move funds between two of a customer's own accounts with explicit confirmation
enabled: true
---

## Instructions

Use this skill when the customer asks to move money between their own accounts (e.g. "Move $5,000 from my checking to my savings", "Top up my brokerage from premier checking"). This is a **write workflow** with mandatory H-I-T-L confirmation.

### 1. Identify both accounts

- The customer usually names the accounts by nickname or type ("my checking", "Rainy Day Fund").
- Call `banking_list_accounts(customer_id)` and match.
- If ambiguous (e.g. customer has two Checking accounts), ask which one.

### 2. Pre-flight checks

Before showing the draft, verify:

- **Same customer.** The `customer_id` on both accounts must match. (The tool will reject otherwise, but it's better to surface this before the customer expects success.)
- **Available funds.** Check `from.available_usd >= amount`. If not, flag the shortfall and ask if the customer wants to transfer a smaller amount instead.

### 3. Show the draft

```
I'll transfer funds between your accounts:

- From:    Premier Checking ****7704 (ACC-20003) — available $17,920.75
- To:      Long-term Portfolio ****9023 (ACC-20004) — balance $412,900.00
- Amount:  $5,000.00
- Memo:    "Monthly portfolio top-up"

After this transfer your Premier Checking available balance will be $12,920.75.
This is an internal transfer — funds are available immediately in your Brokerage.

Confirm to transfer? (yes / no / change amount)
```

Use `ask_user`. Wait.

### 4. Execute

- **yes** → `banking_transfer_between_accounts` with the shown values
- **change amount** → re-confirm with new value
- **no** → stop

### 5. Report the receipt

After the write succeeds:

```
Done. Transferred $5,000.00 from Premier Checking ****7704 to Long-term Portfolio ****9023.

- Source balance now: $12,920.75 (was $17,920.75)
- Destination balance now: $417,900.00 (was $412,900.00)
- Reference: debit TXN-39001 / credit TXN-39002

The funds are immediately available in your Brokerage account.
```

### Constraints

- Never call `banking_transfer_between_accounts` without explicit confirmation in the same turn.
- Currency: USD only in this skill. If the customer asks about a FX transfer, decline and route to the FX desk.
- Don't proactively offer transfers — only act on the customer's explicit instruction relayed via the CSR.
- If the customer says "transfer to my friend's account", redirect: that's an external transfer (wire / Zelle / ACH) — this tool is for internal-only moves.
