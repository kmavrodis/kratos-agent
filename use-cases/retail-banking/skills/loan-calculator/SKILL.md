---
name: loan-calculator
description: Calculate loan payments, amortization schedules, and eligibility estimates for personal loans, auto loans, and mortgages
enabled: true
---

## Instructions

When the user asks about loan payments, how much they can borrow, monthly installments, amortization schedules, or mortgage estimates, use this skill.

### 1. Quick Payment Calculation

For a simple "What would my monthly payment be?" question, use `code_interpreter`:

```python
def monthly_payment(principal, annual_rate, term_months):
    """Calculate fixed monthly payment using standard amortization formula."""
    r = annual_rate / 100 / 12  # monthly interest rate
    if r == 0:
        return principal / term_months
    payment = principal * (r * (1 + r)**term_months) / ((1 + r)**term_months - 1)
    return round(payment, 2)

# Example: $250,000 mortgage at 6.625% for 30 years
p = monthly_payment(250000, 6.625, 360)
print(f"Monthly Payment: ${p:,.2f}")
print(f"Total Paid: ${p * 360:,.2f}")
print(f"Total Interest: ${p * 360 - 250000:,.2f}")
```

### 2. Full Amortization Schedule

When the user wants a detailed breakdown:

```python
import csv

def amortization_schedule(principal, annual_rate, term_months):
    r = annual_rate / 100 / 12
    payment = principal * (r * (1 + r)**term_months) / ((1 + r)**term_months - 1)
    balance = principal
    schedule = []

    for month in range(1, term_months + 1):
        interest = balance * r
        principal_paid = payment - interest
        balance -= principal_paid
        schedule.append({
            "month": month,
            "payment": round(payment, 2),
            "principal": round(principal_paid, 2),
            "interest": round(interest, 2),
            "balance": round(max(balance, 0), 2),
        })

    return schedule, round(payment, 2)

schedule, pmt = amortization_schedule(250000, 6.625, 360)

# Show first 12 months
print(f"Monthly Payment: ${pmt:,.2f}\n")
print(f"{'Month':>5} {'Payment':>10} {'Principal':>10} {'Interest':>10} {'Balance':>12}")
print("-" * 50)
for row in schedule[:12]:
    print(f"{row['month']:>5} ${row['payment']:>9,.2f} ${row['principal']:>9,.2f} ${row['interest']:>9,.2f} ${row['balance']:>11,.2f}")

# Save full schedule to CSV
with open("/tmp/amortization_schedule.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["month", "payment", "principal", "interest", "balance"])
    writer.writeheader()
    writer.writerows(schedule)

print(f"\nFull schedule saved: /tmp/amortization_schedule.csv")
```

### 3. Loan Comparison

When the user wants to compare options (e.g., 15-year vs 30-year):

```python
scenarios = [
    {"label": "30-Year Fixed @ 6.625%", "principal": 250000, "rate": 6.625, "months": 360},
    {"label": "15-Year Fixed @ 5.875%", "principal": 250000, "rate": 5.875, "months": 180},
    {"label": "5/1 ARM @ 5.750%", "principal": 250000, "rate": 5.750, "months": 360},
]

print(f"{'Scenario':<30} {'Monthly':>10} {'Total Paid':>12} {'Total Interest':>15}")
print("-" * 70)
for s in scenarios:
    pmt = monthly_payment(s["principal"], s["rate"], s["months"])
    total = pmt * s["months"]
    interest = total - s["principal"]
    print(f"{s['label']:<30} ${pmt:>9,.2f} ${total:>11,.2f} ${interest:>14,.2f}")
```

### 4. Affordability Estimator

When the user asks "How much can I borrow?":

```python
def max_loan(monthly_budget, annual_rate, term_months):
    """Calculate maximum loan principal given a monthly budget."""
    r = annual_rate / 100 / 12
    if r == 0:
        return monthly_budget * term_months
    return monthly_budget * ((1 + r)**term_months - 1) / (r * (1 + r)**term_months)

# Estimate: user can afford $2,000/month, 30-year mortgage at 6.625%
max_amount = max_loan(2000, 6.625, 360)
print(f"Maximum loan amount: ${max_amount:,.2f}")
```

### 5. Debt-to-Income Quick Check

For preliminary eligibility:

```python
def dti_check(monthly_income, existing_debts, proposed_payment):
    """Check debt-to-income ratio. Banks typically require DTI < 43%."""
    total_debt = existing_debts + proposed_payment
    dti = total_debt / monthly_income * 100
    status = "Likely Approved" if dti < 36 else "Borderline" if dti < 43 else "May Be Declined"
    return round(dti, 1), status

dti, status = dti_check(
    monthly_income=8000,
    existing_debts=500,   # car payment, student loans, etc.
    proposed_payment=1600  # new mortgage payment
)
print(f"DTI Ratio: {dti}% — {status}")
```

### 6. Loan Types Reference

| Loan Type | Typical APR | Terms | Max Amount |
|-----------|-------------|-------|------------|
| Personal Loan | 6.99%-17.99% | 12-60 months | $50,000 |
| Debt Consolidation | 5.99%-15.99% | 24-84 months | $100,000 |
| Auto Loan (New) | 4.49%-9.99% | 36-72 months | $100,000 |
| Auto Loan (Used) | 5.49%-11.99% | 36-60 months | $75,000 |
| 30-Year Fixed Mortgage | 6.625% | 360 months | Varies |
| 15-Year Fixed Mortgage | 5.875% | 180 months | Varies |
| Home Equity (HELOC) | Prime + 0.50% | 10-year draw | 80% of equity |

### 7. Response Format

Always present results clearly:
- **Headline**: Monthly payment amount, prominently displayed
- **Breakdown**: Principal vs. interest per payment
- **Totals**: Total amount paid and total interest over the life of the loan
- **Comparison**: If relevant, show alternative scenarios side by side
- **Next steps**: "Would you like to see the full amortization schedule?" or "Ready to start an application?"

### 8. Disclaimers

Always include:
> "These calculations are estimates for illustrative purposes only. Actual loan terms, rates, and approval are subject to credit review, income verification, and underwriting. Contact a loan officer for a personalized quote."

## Chaining

- `code_interpreter` — runs all financial calculations
- `product-catalog` — reference current loan product details and rates
- `file-sharing` — deliver amortization CSVs and comparison exports
- `data-analysis` — visualize amortization (principal vs interest over time)

## Constraints

- All rates are illustrative — not live market rates
- Never guarantee loan approval
- Never ask for or store SSN, income details, or credit scores in chat
- Always round monetary values to 2 decimal places
