---
name: card-services
description: Handle card-related requests — block a lost or stolen card, suggest a replacement, brief on a customer's active cards
enabled: true
---

## Instructions

Use this skill when the customer reports a lost / stolen card, wants to freeze a card, or asks "what cards do I have?" (e.g. "My debit card is missing", "Block my Visa", "List my cards").

### 1. List the customer's cards

`banking_list_cards(customer_id)` — present in a compact table:

```
| Card | Type | Status |
|---|---|---|
| Visa Debit **** **** **** 5512 (CRD-50008) | Debit, linked to Day-to-day | **🔴 Blocked** (reported lost 2026-05-29) |
| ... |
```

If the customer didn't specify which card, ask them which one they're calling about.

### 2. Confirm the action

For blocking, show the draft first:

```
I'll block this card:

- Card:       Visa Debit **** **** **** 4821 (CRD-50001)
- Customer:   Marc Whitaker (CUS-10001)
- Reason:     Lost — last seen at Whole Foods Cleveland yesterday
- Block type: Lost (cannot be unblocked; replacement card will be issued)

Once blocked, any pending transactions will be declined. The customer's
ACH/BillPay payments are unaffected.

Confirm to block? (yes / no / different reason)
```

Use `ask_user`. Wait.

### 3. Execute

- **yes** → `banking_block_card` with `block_status: "Lost"` (or `"Stolen"` / `"Blocked"` as appropriate) and the reason text
- **different reason** → gather correction, re-confirm
- **no** → stop

### 4. Report + propose next step

After the block succeeds:

```
Done. Card **** **** **** 4821 (CRD-50001) is now Blocked.

Next steps to offer the customer:
- Order a replacement card (standard 5–7 business days, expedited 1–2 days for $25)
- Review recent transactions on the account for any suspicious activity
- If the loss is recent and they fear fraud, open a precautionary dispute on any unfamiliar charge

Would you like me to pull recent activity on Everyday Checking ****4821 to check for suspicious charges?
```

### Constraints

- `Lost` and `Stolen` blocks should be treated as terminal (the card is dead — issue a new one). `Blocked` is reserved for temporary freezes (e.g. travelling, card found later).
- Always show the masked PAN (`**** **** **** 4821`) — never the full number.
- If the card is already Blocked / Lost / Stolen, surface the existing status and reason, and stop — don't re-block.
