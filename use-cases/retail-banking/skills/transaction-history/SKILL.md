---
name: transaction-history
description: Retrieve recent transaction history for a customer account with filtering, search, and export — uses Faker for simulated data
enabled: true
---

## Instructions

When the user asks to see recent transactions, account activity, statement, or spending history, use this skill.

### 1. Generate Transaction Data

This skill uses the **Faker MCP server** (configured in `.mcp.json`) to generate realistic transaction history. Call Faker MCP tools to produce individual data points, then assemble them into transactions.

**Faker MCP tools to use:**
- `faker_date_between` — generate transaction dates within the last 90 days
- `faker_random_element` — pick merchants, categories, and transaction statuses
- `faker_pyfloat` — generate transaction amounts
- `faker_bothify` — generate transaction reference numbers (e.g., `"TXN-########"`)

**Transaction categories and merchants:**

| Category | Example Merchants |
|----------|-------------------|
| Groceries | Whole Foods, Trader Joe's, Kroger, Safeway, Costco |
| Dining | Starbucks, Chipotle, McDonald's, Olive Garden, DoorDash |
| Transportation | Uber, Lyft, Shell Gas, BP, EZ-Pass |
| Shopping | Amazon, Target, Walmart, Best Buy, Nordstrom |
| Utilities | ConEdison, AT&T, Comcast, Water Authority, National Grid |
| Healthcare | CVS Pharmacy, Walgreens, Dr. Smith Office, LabCorp |
| Entertainment | Netflix, Spotify, AMC Theatres, Apple iTunes |
| Transfer | Zelle Transfer, Wire Transfer, ACH Transfer, Venmo |
| Income | Direct Deposit - Employer, ACH Credit, Interest Payment |
| Fees | Monthly Service Fee, ATM Fee, Overdraft Fee |

**Example flow:**
1. Use Faker MCP to generate dates, merchant names, and amounts
2. Use `code_interpreter` to assemble into a sorted transaction list and apply filters
3. Present as a formatted table

**Expected output per transaction:**
```json
{
  "date": "2026-03-18",
  "description": "Whole Foods",
  "category": "Groceries",
  "amount": -87.43,
  "type": "Debit",
  "status": "Posted",
  "reference": "TXN-48219753"
}
```

### 2. Response Format

Present transactions in a clean table:

| Date | Description | Category | Amount | Status |
|------|-------------|----------|--------|--------|
| 2026-03-18 | Whole Foods | Groceries | -$87.43 | Posted |
| 2026-03-18 | Direct Deposit | Income | +$3,250.00 | Posted |
| 2026-03-17 | Uber | Transportation | -$24.50 | Posted |
| 2026-03-16 | Netflix | Entertainment | -$15.99 | Pending |

### 3. Filtering & Search

Support user requests to filter transactions by:
- **Date range**: "Show me transactions from last week"
- **Category**: "Show me all dining expenses"
- **Amount range**: "Transactions over $100"
- **Merchant**: "Search for Amazon"
- **Type**: "Show only credits/deposits"

### 4. Spending Summary

If the user asks for a spending overview, aggregate by category:

```python
import pandas as pd

df = pd.DataFrame(transactions)
summary = df[df["amount"] < 0].groupby("category")["amount"].agg(["sum", "count"])
summary.columns = ["Total Spent", "# Transactions"]
summary = summary.sort_values("Total Spent")
print(summary)
```

### 5. Export

If the user wants a statement or export:
- Generate a CSV file to `/tmp/transactions_YYYYMMDD.csv`
- Reference the file path for download via file-sharing

## Chaining

- **Faker MCP** — generates realistic transaction data points
- `code_interpreter` — assembles data, performs aggregations, filtering
- `data-analysis` — deeper spending analytics and charts
- `file-sharing` — export transaction data as CSV
- `account-lookup` — user often checks balance before reviewing transactions

## Constraints

- Maximum 90 days of transaction history available. If the user requests transactions older than 90 days, inform them that only the last 90 days are available online and suggest they visit a branch or contact customer service at 1-800-OLYMPUS to request a paper statement.
- Always show most recent transactions first
- Mask account numbers in exports (show only last 4 digits)

## Constraints

- All transactions are simulated via Faker
- Always show most recent transactions first
- Maximum 90 days of history per request
- Mask account numbers in any exported files
