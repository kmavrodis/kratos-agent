---
name: portfolio-review
description: Analyze investment portfolios with performance metrics, risk assessment, and allocation breakdowns
enabled: true
---

## Instructions

When the user asks you to review, analyze, or assess an investment portfolio, follow this workflow:

### 1. Data Ingestion

Accept portfolio data in any format:
- CSV/Excel with holdings (ticker, shares, cost basis, current value)
- Inline text listing of positions
- JSON with portfolio structure

Use `code_interpreter` to load and normalize the data into a pandas DataFrame.

### 2. Performance Analysis

Calculate and present:
- **Total portfolio value** and **total gain/loss** (absolute and percentage)
- **Per-position P&L** with percentage returns
- **Time-weighted return** if historical data is available
- **Benchmark comparison** (e.g., S&P 500, relevant index)

### 3. Risk Metrics

Compute where data allows:
- **Asset allocation breakdown** (equities, fixed income, alternatives, cash)
- **Sector/geographic concentration** risks
- **Top holdings concentration** (top 5 as % of total)
- **Diversification score** based on number of holdings and correlation

### 4. Visualizations

Generate charts via `code_interpreter` with matplotlib:

```python
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Allocation pie chart
fig, ax = plt.subplots(figsize=(8, 8))
ax.pie(allocations, labels=labels, autopct='%1.1f%%', startangle=90)
ax.set_title("Portfolio Allocation")
plt.tight_layout()
plt.savefig("/tmp/portfolio_allocation.png", dpi=150)
plt.close()
```

Common charts to produce:
- **Pie chart**: Asset allocation / sector breakdown
- **Bar chart**: Top holdings by value, per-position P&L
- **Waterfall chart**: Contributors to portfolio return

### 5. Client-Ready Output

Structure the response as a professional portfolio review:
1. **Executive Summary**: 2-3 sentence overview of portfolio health
2. **Performance Table**: Holdings with key metrics
3. **Risk Assessment**: Concentration risks, diversification notes
4. **Visualizations**: Charts saved to `/tmp` for download
5. **Recommendations Framework**: Areas to investigate (not specific buy/sell advice)

### 6. Compliance Note

Always include: "This analysis is for informational purposes only and does not constitute investment advice. Past performance does not guarantee future results."

## Constraints

- Never provide specific buy/sell recommendations
- Always note when data may be stale or incomplete
- Use `code_interpreter` for all calculations — do not estimate mentally
- Save all charts and reports to `/tmp`
