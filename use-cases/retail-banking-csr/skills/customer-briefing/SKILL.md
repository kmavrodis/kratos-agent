---
name: customer-briefing
description: Brief the CSR on a customer — profile, accounts, recent activity, open disputes, cards
enabled: true
---

## Instructions

Use this skill when the user (CSR) asks you to look up a customer, pull their record, brief them on someone, or "tell me about" a caller (e.g. "Pull up Marc Whitaker", "Brief me on Pris Okafor", "I have CUS-10003 on the line").

### 1. Resolve the customer

- If the user gave a name → `banking_search_customers_by_name` then `banking_get_customer`
- If multiple matches, list them and ask the user to disambiguate
- If the user gave an id directly → straight to `banking_get_customer`

### 2. Fan out (in parallel)

- `banking_list_accounts(customer_id)` — all accounts they hold
- `banking_list_cards(customer_id)` — all cards
- `banking_list_disputes(customer_id)` — any open or recent disputes
- For each Active account, optionally `banking_list_transactions(account_id, limit=5)` — last 5 transactions per account

### 3. Render

```markdown
# Marc Whitaker (CUS-10001) — Customer Brief

## Profile
- **Segment**: Mass Affluent · **KYC**: Verified
- **Customer since**: 22 March 2014 (12 years)
- **Preferred branch**: Cleveland Downtown
- **Marketing consent**: Yes

## Accounts (2)
| Account | Balance | Status |
|---|---|---|
| Everyday Checking ****4821 (ACC-20001) | $4,218.42 | Active |
| Rainy Day Fund ****1190 — Savings (ACC-20002) | $31,750.00 (4.25% APY) | Active |

> **Total deposits**: $35,968.42

## Cards (2)
| Card | Type | Status |
|---|---|---|
| Visa Debit **** **** **** 4821 (CRD-50001) | Debit, linked to Checking | Active |
| Visa Credit **** **** **** 9912 (CRD-50002) | $15,000 limit · $1,820.45 balance | Active |

## Open / recent disputes
- **DSP-40001** — $348.00 Southwest Airlines charge, opened 26 May 2026
  - Reason: *"Unauthorised charge — never travelled with Southwest"*
  - Status: **Open** · Provisional credit applied 27 May 2026
  - Expected resolution: 25 June 2026 · Agent AGT-901

## Recent activity (Everyday Checking, last 5)
| Date | Merchant | Amount | Category |
|---|---|---|---|
| 31 May | Whole Foods #142 Cleveland OH | -$82.40 | Groceries |
| 30 May | Olympus Industries Payroll | +$4,600.00 | Payroll |
| 29 May | City of Cleveland — Rent | -$1,450.00 | Rent |
| 28 May | Netflix.com | -$19.99 | Entertainment |
| 27 May | Delta Air Lines Seat Upgrade | -$65.50 | Travel |

## Watch-outs
- Open dispute DSP-40001 is 6 days old, expected resolution still 19 days away — let the customer know if they ask
- Savings rate is competitive at 4.25%; their Money Market eligibility is $10k+ so they could move idle Checking balance up

## Suggested next steps
1. Confirm the reason for the call.
2. If they ask about the Southwest dispute, you can quote the expected-resolution date directly.
```

### Targeted variants

- **"Just their accounts"** → skip cards / disputes / transactions, render only the accounts table
- **"Last transaction"** → skip everything except `banking_list_transactions(limit=1)` for the primary checking account
- **"Do they have any open disputes?"** → call only `banking_list_disputes` and answer directly

### Constraints

- Never display the customer's date of birth, full address, or phone unless the user asks.
- Currency: `$1,234.56`, masked accounts: `****4821`, masked cards: `**** **** **** 4821`.
- If `kyc_status` is not `Verified`, lead with a 🔴 KYC warning — the CSR shouldn't transact until that's resolved.
