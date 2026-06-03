---
name: dispute-handling
description: Investigate a disputed transaction and raise a formal dispute with confirmation — including provisional credit and follow-up
enabled: true
---

## Instructions

Use this skill when the customer claims a transaction is unauthorised, fraudulent, or wrong (e.g. "I never made that charge", "This isn't my purchase", "Investigate this Southwest charge"). This is a **write workflow** with mandatory H-I-T-L confirmation.

### 1. Find the transaction in question

- If the user gave a `TXN-*` id → `banking_get_transaction`
- If they described it ("the $348 Southwest charge", "the Amazon one yesterday") → `banking_list_transactions(account_id)` filtered to the date range, then pick the match
- If they don't know which transaction → pull recent transactions on the relevant account and present them, ask which one

### 2. Investigate before raising

Before raising the dispute, briefly establish:

- **Customer**: `banking_get_customer` if not already in context — confirm KYC is Verified.
- **Existing disputes**: `banking_list_disputes(customer_id)` — flag if there's already an open dispute on this transaction or a high volume of recent disputes.
- **Merchant + amount + date**: read these straight from the transaction record so the dispute reason can quote them precisely.

### 3. Show the draft + ask for confirmation

```
I'll raise a dispute on this transaction:

- Transaction:    TXN-30005 — Delta Air Lines Seat Upgrade
- Date / amount:  27 May 2026 · $65.50
- Account:        Everyday Checking ****4821
- Customer:       Marc Whitaker (CUS-10001)
- Reason:         "Cardholder claims the seat-upgrade charge was unauthorised"
- Provisional credit:  $65.50 will be credited to the account today; expected resolution by 1 July 2026
- Agent of record: AGT-901

Confirm to open the dispute? (yes / adjust the reason / no provisional credit / no)
```

Use `ask_user` to pause. Wait.

### 4. Handle the response

- **yes** → call `banking_raise_dispute` with the shown values
- **adjust the reason** → gather the corrected wording, re-confirm
- **no provisional credit** → re-confirm with `with_provisional_credit: false`
- **no / cancel** → stop, acknowledge, ask if there's anything else

### 5. Report and follow up

After the write succeeds, summarise to the CSR (so they can relay to the customer):

```
Done. Dispute DSP-9001 is open.

- $65.50 has been provisionally credited to your Everyday Checking ****4821. New balance: $4,283.92.
- We'll investigate with the merchant; you'll hear back by 1 July 2026 (within 30 days).
- The original transaction is now marked Disputed on your statement.

Would you like me to:
- Block the linked card (CRD-50001) as a precaution?
- Look for other recent suspicious charges on the same account?
```

### Constraints

- Never call `banking_raise_dispute` without explicit confirmation in the same turn.
- If the transaction is already `Disputed`, surface the existing `DSP-*` id and stop — don't open a duplicate.
- Default to `with_provisional_credit: true` for unauthorised-charge disputes under $1,000; ask explicitly for larger amounts.
- The agent identifier (`AGT-*`) for the CSR should come from session context — if you don't have one, use `AGT-901` as a sensible default and note it to the user.
