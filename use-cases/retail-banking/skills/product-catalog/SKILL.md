---
name: product-catalog
description: Browse and compare Olympus National Bank products — checking, savings, credit cards, loans, mortgages, and CDs
enabled: true
---

## Instructions

When a user asks about bank products, account types, rates, fees, or wants to compare options, use this skill to provide comprehensive product information.

### 1. Product Categories

#### Checking Accounts

| Product | Monthly Fee | Min Balance | APY | Features |
|---------|-------------|-------------|-----|----------|
| **Everyday Checking** | $0 (with $500 min balance) | $0 to open | 0.01% | Free debit card, mobile deposit, 1 free ATM network |
| **Premium Checking** | $25 (waived with $15K combined balance) | $100 | 0.05% | Unlimited ATM rebates, free checks, priority support |
| **Student Checking** | $0 | $0 | 0.01% | No minimum balance, ages 17-24, free peer transfers |
| **Business Checking** | $15 (waived with $5K min) | $100 | 0.02% | 500 free transactions/month, merchant services integration |

#### Savings Accounts

| Product | APY | Min Balance | Monthly Fee | Features |
|---------|-----|-------------|-------------|----------|
| **Standard Savings** | 0.50% | $100 | $5 (waived at $300) | 6 transfers/month, auto-save rules |
| **High-Yield Savings** | 4.25% | $1,000 | $0 | Unlimited transfers, rate guaranteed 6 months |
| **Kids Savings** | 2.00% | $0 | $0 | Ages 0-17, parental controls, financial literacy tools |
| **Money Market** | 3.75% | $10,000 | $0 | Check-writing privileges, tiered rates |

#### Certificates of Deposit (CDs)

| Term | APY | Minimum Deposit | Early Withdrawal Penalty |
|------|-----|-----------------|--------------------------|
| 3 months | 3.50% | $1,000 | 30 days interest |
| 6 months | 4.00% | $1,000 | 90 days interest |
| 12 months | 4.50% | $1,000 | 180 days interest |
| 24 months | 4.25% | $1,000 | 180 days interest |
| 60 months | 4.00% | $1,000 | 365 days interest |

#### Credit Cards

| Card | Annual Fee | APR | Rewards | Sign-up Bonus |
|------|-----------|-----|---------|---------------|
| **Olympus Cash Back** | $0 | 18.99%-25.99% | 1.5% unlimited cash back | $200 after $1K spend in 90 days |
| **Olympus Travel Rewards** | $95 | 17.49%-24.49% | 2x points on travel & dining, 1x all else | 50,000 points after $3K spend |
| **Olympus Platinum** | $250 | 16.99%-23.99% | 3x dining, 2x travel, 1x all else | 75,000 points + $300 travel credit |
| **Olympus Secured Card** | $0 | 22.99% | 1% cash back | Build credit with $200+ deposit |

#### Personal Loans

| Loan Type | APR Range | Amounts | Terms |
|-----------|-----------|---------|-------|
| **Personal Loan** | 6.99%-17.99% | $2,000-$50,000 | 12-60 months |
| **Debt Consolidation** | 5.99%-15.99% | $5,000-$100,000 | 24-84 months |
| **Auto Loan (New)** | 4.49%-9.99% | $5,000-$100,000 | 36-72 months |
| **Auto Loan (Used)** | 5.49%-11.99% | $3,000-$75,000 | 36-60 months |

#### Mortgages

| Product | Rate (as of today) | Points | Term | Features |
|---------|-------------------|--------|------|----------|
| **30-Year Fixed** | 6.625% | 0 | 30 years | Predictable payments |
| **15-Year Fixed** | 5.875% | 0 | 15 years | Lower total interest |
| **5/1 ARM** | 5.750% | 0 | 30 years | Lower initial rate, adjusts annually after 5 years |
| **FHA Loan** | 6.250% | 0 | 30 years | 3.5% min down payment, flexible credit |
| **Home Equity Line (HELOC)** | Prime + 0.50% | — | 10-year draw | Borrow against home equity |

### 2. Response Guidelines

- When a user asks "What accounts do you offer?" — provide a concise overview of all categories.
- When a user asks about a **specific product** — give full details including fees, rates, eligibility, and features.
- When a user wants to **compare** products — present a side-by-side comparison table.
- When a user asks "What's the best X for me?" — ask 2-3 clarifying questions (monthly balance, usage patterns, goals) then recommend.

### 3. Eligibility Notes

- Mortgage and loan rates are based on creditworthiness; quoted rates assume excellent credit (740+).
- Credit card approval subject to credit check.
- Student accounts require proof of enrollment.
- Business accounts require EIN or sole proprietor documentation.

### 4. Proactive Suggestions

After answering a product question:
- Suggest related products: "Since you're interested in our High-Yield Savings, you might also like our 12-month CD at 4.50% APY."
- Mention promotions: "We're currently offering a $300 bonus for new Premium Checking accounts funded with $10,000+."
- Offer next steps: "Would you like to start an application, or do you have more questions?"

### 5. Disclaimers

Always include when showing rates:
- "APY = Annual Percentage Yield. Rates effective as of [today's date] and subject to change."
- "APR = Annual Percentage Rate. Rates based on creditworthiness."
- "Loan approval subject to credit review and income verification."

## Chaining

- `loan-calculator` — calculate specific payments after browsing products
- `account-lookup` — check if user already has a similar product
- `web-search` — look up competitor rates for comparison
- `email-draft` — draft an application inquiry email

## Constraints

- Rates and products are illustrative (simulated) — not real bank offers
- Never guarantee loan approval or specific rates for a user
- Always note that rates are subject to change
