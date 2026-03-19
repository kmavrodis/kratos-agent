---
name: card-services
description: Manage debit and credit cards — activation, blocking, limit changes, PIN resets, dispute filing, and card details
enabled: true
---

## Instructions

When the user asks about their cards, wants to activate/block a card, change spending limits, report a lost card, dispute a charge, or inquire about rewards, use this skill.

### 1. Retrieve Card Information

This skill uses the **Faker MCP server** (configured in `.mcp.json`) to generate card details. Call Faker MCP tools to produce individual data points, then assemble them.

**Faker MCP tools to use:**
- `faker_numerify` — generate masked card numbers (`"**** **** **** ####"`)
- `faker_date_between` — card issue dates, expiry dates, payment due dates
- `faker_random_element` — pick card status, network, product type
- `faker_pyfloat` / `faker_random_int` — generate credit limits, balances, rewards points

**Card types to generate:**

| Type | Network | Details |
|------|---------|--------|
| Debit Card | Visa | Linked to checking account, ATM/purchase limits |
| Olympus Cash Back | Mastercard | 1.5% cash back, credit limit, balance |
| Olympus Travel Rewards | Visa | 2x points travel/dining, rewards balance |

**Expected output per card:**
```json
{
  "card_number_masked": "**** **** **** 7293",
  "card_type": "Credit Card",
  "product_name": "Olympus Cash Back",
  "network": "Mastercard",
  "status": "Active",
  "expiry": "08/2028",
  "credit_limit": 15000,
  "available_credit": 11250,
  "current_balance": 3750,
  "min_payment_due": 75.00,
  "payment_due_date": "2026-04-05",
  "rewards_balance": 12750,
  "rewards_type": "Cash Back"
}
```

**Flow:** Call Faker MCP tools for each field, then optionally use `code_interpreter` to assemble the full card payload.

### 2. Card Operations

#### Activate a Card
- Confirm card last 4 digits
- Response: "Your card ending in **7293** has been activated. You can start using it immediately."

#### Block / Freeze a Card
- Confirm which card to block
- Response: "Your card ending in **7293** has been temporarily frozen. No transactions will be processed. To unfreeze, just let me know or call 1-800-OLYMPUS."
- If reported lost/stolen: "Your card ending in **7293** has been permanently blocked. A replacement card will be mailed to your address on file within 5-7 business days."

#### Change Spending Limits
- Show current limits
- Accept new limit request
- Response: "Your daily purchase limit has been updated from $5,000 to $10,000, effective immediately."
- Note: increases above $10,000 may require manager approval.

#### Request PIN Reset
- Cannot show or send PIN in chat
- Response: "A PIN reset link has been sent to your registered email. You can also reset your PIN at any Olympus ATM using your current card and registered phone number for OTP verification."

#### Report Unauthorized Transaction / Dispute
1. Ask for transaction details (date, amount, merchant)
2. Generate a dispute reference number
3. Response: "Dispute **DSP-2026031842** has been filed for the $149.99 charge from [Merchant] on 03/12/2026. You'll receive a provisional credit within 3-5 business days while we investigate. Investigation may take up to 45 days."

#### Rewards Inquiry
- Show current rewards balance
- Show redemption options:
  - Statement credit (1 point = $0.01 or 1% = $1 per $100)
  - Travel booking (1.25x value through Olympus Travel Portal)
  - Gift cards (select retailers)
  - Cash deposit to checking/savings

### 3. Response Format

Present card information clearly:

**Visa Debit Card (****4821)**
- Status: Active
- Linked to: Checking ****9173
- Expiry: 08/2027
- Daily ATM Limit: $1,000
- Daily Purchase Limit: $5,000
- Contactless: Enabled

**Mastercard Credit — Olympus Cash Back (****7293)**
- Status: Active
- Credit Limit: $15,000
- Available Credit: $11,250
- Current Balance: $3,750
- Min Payment Due: $75.00 by 2026-04-05
- Cash Back Balance: $127.50

### 4. Security Rules

- **Never display full card numbers** — always ****XXXX
- **Never display CVV/CVC**
- **Never display or transmit PINs**
- For permanent blocks (lost/stolen), recommend calling the hotline for fastest action

## Chaining

- **Faker MCP** — generates realistic card data
- `code_interpreter` — assembles card data, generates dispute references
- `transaction-history` — review recent charges for disputes
- `email-draft` — draft formal dispute letters
- `product-catalog` — explore card upgrade options

## Constraints

- All card data is simulated using Faker
- Card operations are acknowledged but not actually processed
- Always mask card numbers and never show CVV/PIN
