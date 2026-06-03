---
name: product-comparison
description: Compare bank products (savings, checking, mortgage, brokerage) for a customer scenario
enabled: true
---

## Instructions

Use this skill when the customer asks about products, rates, or upgrades (e.g. "What savings options do you have?", "Compare your checking accounts", "What's your best rate on $30k?", "Tell me about the mortgage products").

### 1. Pull the catalog

`banking_list_products(type?)` — filter by type if the customer specified one, else return all.

### 2. Render a comparison

Table format keyed to the customer's question. If they mentioned a dollar amount, sort by relevance (e.g. for "$30k looking for best rate", lead with savings products where their amount meets the minimum balance).

```markdown
# Savings products — for $30,000

| Product | Rate | Min balance | Monthly fee | Notes |
|---|---|---|---|---|
| **High-Yield Savings** (PROD-SAV-HIGHYIELD) | **4.25% APY** | $100 | $0 | Tiered up to 4.50% at $50k+ |
| Money Market (PROD-SAV-MMA) | 4.75% APY | $10,000 | $10/mo | Cheque-writing; higher rate at $250k+ |

**Recommendation**: At $30k, **Money Market gives the highest net yield** even after the $10/mo fee — earns roughly $107/mo more than High-Yield Savings at that balance. Worth offering.

You could also mention the **Long-term Portfolio (PROD-INV-MANAGED)** as a parallel option if the customer has investment appetite (min $50k under management).
```

### 3. Be honest about eligibility

If the customer doesn't qualify (e.g. asking about Private Bank Checking but they're Mass segment), say so directly — don't recommend a product the customer can't have.

If the customer's current product is already the best fit, say that too:

> *"You're already on our best-rate Savings product at this balance — no upgrade beats it."*

### Constraints

- This is a **read-only** skill; no `banking_open_product` exists. If the customer wants to open a new account, the CSR has to route them to the right team — surface that as the next step.
- Currency: `$1,234.56`, rates: `4.25% APY` (annual percentage yield, always with "APY" suffix on savings).
- Don't make up rates that aren't in the catalog. If the customer asks about a product type we don't carry (e.g. crypto), say so.
