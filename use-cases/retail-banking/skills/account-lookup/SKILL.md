---
name: account-lookup
description: Retrieve customer account details — balances, account type, status, and linked accounts using simulated banking data (Faker)
enabled: true
---

## Instructions

When the user asks about their account balance, account details, account status, or linked accounts, use this skill to retrieve the information.

### 1. Data Retrieval

This skill uses the **Faker MCP server** (configured in `.mcp.json`) to generate realistic banking data. Call the Faker MCP tools directly to produce customer and account data — no need to write inline Python with Faker.

**Faker MCP tools to use:**
- `faker_bothify` — generate a Customer ID pattern (e.g., `"CUST-####??"` → `CUST-4821AB`)
- `faker_numerify` — generate masked account numbers (e.g., `"****####"` → `****4821`)
- `faker_date_between` — generate account opened dates
- `faker_city` — generate branch names
- `faker_random_element` — pick account status, types, etc.
- `faker_pyfloat` — generate balances and interest rates

**Example flow:** Use the Faker MCP to generate individual fields, then assemble them into a structured account response. For complex assembly (combining multiple Faker outputs into a JSON structure), use `code_interpreter` with the Faker MCP outputs as inputs.

**Expected output structure:**
```json
{
  "customer_id": "CUST-4821AB",
  "accounts": [
    {
      "account_number": "****4821",
      "account_type": "Checking",
      "status": "Active",
      "balance": 12450.00,
      "available_balance": 12250.00,
      "currency": "USD",
      "opened_date": "2021-01-15",
      "interest_rate": 0.0,
      "branch": "Springfield Branch"
    }
  ]
}
```

### 2. Response Format

Present account information in a clean, readable format:

| Field | Checking (****4821) | Savings (****9173) |
|-------|--------------------|--------------------|
| Status | Active | Active |
| Balance | $12,450.00 | $43,200.75 |
| Available | $12,250.00 | $43,200.75 |
| Interest Rate | — | 3.25% APY |
| Opened | Jan 15, 2021 | Mar 8, 2019 |

### 3. Security Rules

- **Never show full account numbers** — always mask as ****XXXX
- **Never show SSN, full card numbers, or passwords**
- Include a timestamp: "Balances as of [date/time]"

### 4. Proactive Suggestions

After showing account details, consider suggesting:
- If checking balance is high: "You might benefit from moving some funds to a high-yield savings account."
- If savings rate is low: "Our new High-Yield Savings offers up to 4.25% APY."
- If account is dormant: "Your account has been inactive. Would you like to learn about reactivation?"

## Chaining

This skill works best when combined with:
- **Faker MCP** — generates realistic customer and account data
- `code_interpreter` — assembles Faker outputs into structured responses
- `transaction-history` — after viewing balances, users often want to see recent transactions
- `product-catalog` — suggest relevant products based on account state

## Constraints

- All data is simulated using Faker — include a disclaimer on first use
- Always mask sensitive fields
- Include "Balances as of" timestamp
