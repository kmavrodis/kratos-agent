---
name: data-analysis
description: Analyze banking data — spending patterns, income vs expenses, savings projections, and financial health metrics
enabled: true
---

## Instructions

When the user asks for spending analysis, budget breakdown, savings projections, or financial insights, follow this workflow:

### 1. Data Ingestion

- If the user has transaction data from `transaction-history`, use that as input
- If the user provides CSV/JSON data inline, write it to `/tmp` first
- If no data is available, use the **Faker MCP server** to generate realistic sample banking data (transactions, balances, spending patterns)

### 2. Banking-Specific Analyses

#### Spending Breakdown
```python
import pandas as pd

df = pd.DataFrame(transactions)
spending = df[df["amount"] < 0].copy()
spending["amount"] = spending["amount"].abs()
breakdown = spending.groupby("category")["amount"].agg(["sum", "count", "mean"])
breakdown.columns = ["Total Spent", "# Transactions", "Avg Transaction"]
breakdown = breakdown.sort_values("Total Spent", ascending=False)
print(breakdown)
```

#### Income vs Expenses
```python
income = df[df["amount"] > 0]["amount"].sum()
expenses = df[df["amount"] < 0]["amount"].abs().sum()
net = income - expenses
savings_rate = (net / income * 100) if income > 0 else 0

print(f"Total Income:   ${income:,.2f}")
print(f"Total Expenses: ${expenses:,.2f}")
print(f"Net Cash Flow:  ${net:,.2f}")
print(f"Savings Rate:   {savings_rate:.1f}%")
```

#### Monthly Trend
```python
df["month"] = pd.to_datetime(df["date"]).dt.to_period("M")
monthly = df.groupby("month")["amount"].sum()
print(monthly)
```

#### Top Merchants
```python
top = spending.groupby("description")["amount"].sum().nlargest(10)
print("Top 10 Merchants by Spend:")
print(top)
```

### 3. Visualizations

Generate charts with matplotlib and save to `/tmp`:

```python
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Spending by category pie chart
fig, ax = plt.subplots(figsize=(10, 8))
breakdown["Total Spent"].plot(kind="pie", autopct="%1.1f%%", ax=ax)
ax.set_ylabel("")
ax.set_title("Spending by Category")
plt.tight_layout()
plt.savefig("/tmp/spending_breakdown.png", dpi=150)
plt.close()
print("Chart saved: /tmp/spending_breakdown.png")
```

Common banking charts:
- **Pie chart**: Spending by category
- **Bar chart**: Monthly income vs. expenses
- **Line chart**: Account balance trend over time
- **Stacked bar**: Category breakdown per month

### 4. Financial Health Indicators

Provide insights based on the data:
- **50/30/20 Rule Check**: Is the user spending ~50% on needs, 30% wants, 20% savings?
- **Recurring charges**: Identify subscriptions and recurring payments
- **Large/unusual transactions**: Flag transactions significantly above average
- **Savings potential**: "Reducing dining by 20% would save ~$X/month"

### 5. Output

- Print key findings as text
- Save charts to `/tmp` with descriptive names
- Reference file paths for download
- If analysis produces a transformed dataset, save as CSV to `/tmp`

## Chaining

- `code_interpreter` — runs the Python code
- `transaction-history` — provides source transaction data
- `file-sharing` — delivers charts and exports
- `account-lookup` — context on account balances

## Constraints

- Available libraries: pandas, numpy, matplotlib, faker
- Files must be written to `/tmp`
- Max execution time: 30 seconds per code block
