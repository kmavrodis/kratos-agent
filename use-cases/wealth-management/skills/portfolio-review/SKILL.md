---
name: portfolio-review
description: Analyze investment portfolios with performance metrics, risk assessment, and allocation breakdowns — integrates with CRM client data
enabled: true
---

## Instructions

When the user asks you to review, analyze, or assess an investment portfolio, follow this workflow:

### 1. Data Ingestion

Determine the data source based on the user's request:

- **User references a client** (by name or ID) → use the **CRM path** (a)
- **User provides their own data** (CSV, inline text, JSON, file) → use the **generic path** (b)

#### a) From the CRM (when the user references a client)

When the user mentions a client by name or ID, retrieve the portfolio from the CRM system:

1. Use `load_from_crm_by_client_fullname` or `load_from_crm_by_client_id` to find the client
2. Use `get_client_portfolio` with the client ID to retrieve full portfolio data

The CRM portfolio JSON has this structure:

```json
{
  "strategy": "Description of the portfolio strategy...",
  "riskProfile": "Growth | Balanced | Conservative",
  "performanceYTD": "12.3%",
  "performanceSinceInception": "22.3%",
  "inceptionDate": "12/07/2015",
  "positions": [
    {
      "ticker": "MSFT",
      "companyName": "Microsoft Corp",
      "sector": "Technology",
      "industry": "Software",
      "currency": "USD",
      "assetClass": "Equity",
      "type": "Common Stock",
      "average_cost": "350",
      "units": "200"
    }
  ]
}
```

**Key fields per position**: `ticker`, `companyName`, `sector`, `industry`, `currency`, `assetClass` (Equity / Fixed Income), `type` (Common Stock / ETF), `average_cost`, `units`.

#### b) From user-provided data (generic)

When the user provides their own portfolio data directly, accept any format:
- CSV/Excel with holdings (ticker, shares, cost basis, current value)
- Inline text listing of positions
- JSON with portfolio structure

Use `code_interpreter` to load and normalize data into a pandas DataFrame. Do **not** call CRM functions in this path.

### 2. Normalize Data for Analysis

#### CRM path

When working with CRM portfolio data, normalize the positions into a DataFrame:

```python
import pandas as pd
import json

# portfolio_json comes from get_client_portfolio
portfolio = json.loads(portfolio_json)
positions = portfolio["portfolio"]["positions"]

df = pd.DataFrame(positions)
df["average_cost"] = df["average_cost"].astype(float)
df["units"] = df["units"].astype(float)
df["cost_basis"] = df["average_cost"] * df["units"]

print(f"Client: {portfolio['fullName']}")
print(f"Strategy: {portfolio['portfolio']['riskProfile']}")
print(f"Performance YTD: {portfolio['portfolio']['performanceYTD']}")
print(f"Performance since inception: {portfolio['portfolio']['performanceSinceInception']}")
print(f"Inception: {portfolio['portfolio']['inceptionDate']}")
print(f"\nPositions ({len(df)}):")
print(df[["ticker", "companyName", "sector", "assetClass", "average_cost", "units", "cost_basis"]].to_string(index=False))
```

#### Generic path

When working with user-provided data, normalize into a DataFrame with at least these columns: `ticker` (or symbol), `units` (or shares/quantity), and `cost_basis` (or value/amount). Use `code_interpreter` to parse the input format (CSV, JSON, inline text) and compute derived columns as needed.

### 3. Performance Analysis

**IMPORTANT — Current Market Prices**: The CRM provides `average_cost` (cost basis) but NOT current market prices. To compute current portfolio value, unrealized P&L, and accurate returns:
1. Use `web_search` to fetch current prices for each ticker in the portfolio
2. Join the current prices with the CRM cost-basis data
3. Calculate: current_value = current_price × units, unrealized_pnl = current_value - cost_basis

This is a **mandatory step** for any meaningful portfolio review — do not skip it.

Calculate and present:
- **Total cost basis** from cost per position (for CRM: `average_cost × units`; for generic: from the provided data)
- **Cost-basis allocation** — each position as % of total cost basis
- **Per-position cost exposure** in absolute dollars
- **Performance YTD** and **since inception** — from CRM portfolio metadata when available; otherwise compute from user-provided current values vs cost basis
- **Benchmark comparison** (e.g., S&P 500, relevant index) — use `web_search` if current benchmark data is needed

### 4. Risk Metrics

Compute where data allows:
- **Asset class breakdown** — group by `assetClass` (Equity vs Fixed Income vs other); for generic data, infer from security type if provided
- **Sector concentration** — group by `sector` (Technology, Financials, Health Care, etc.)
- **Industry granularity** — drill into `industry` for finer-grained analysis (CRM data includes this)
- **Top holdings concentration** — top 5 positions as % of total cost basis
- **Currency exposure** — group by `currency` to identify FX risk (if available)
- **Security type mix** — group by `type` (Common Stock vs ETF vs other)
- **Diversification score** based on number of holdings, sectors, and asset classes

**CRM path only** — compare the computed risk profile against the client's stated `riskProfile` and `investmentObjectives` from the CRM:
- **Aggressive / Growth**: High equity concentration is expected; flag if >30% in a single sector
- **Moderate / Balanced**: Expect a mix of equity and fixed income; flag if fixed income <20%
- **Conservative / Income & Preservation**: Expect heavy fixed income and dividend stocks; flag if equity >60%

**Generic path** — if the user states their risk tolerance or objectives, compare against those. Otherwise, assess risk purely from the data and note any concentration concerns.

### 5. Visualizations

Generate charts via `code_interpreter` with matplotlib:

```python
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Sector allocation pie chart from CRM data
sector_alloc = df.groupby("sector")["cost_basis"].sum()
fig, ax = plt.subplots(figsize=(8, 8))
ax.pie(sector_alloc.values, labels=sector_alloc.index, autopct='%1.1f%%', startangle=90)
ax.set_title("Portfolio Allocation by Sector")
plt.tight_layout()
plt.savefig("/tmp/portfolio_sector_allocation.png", dpi=150)
plt.close()
```

Common charts to produce:
- **Pie chart**: Sector breakdown, asset class allocation
- **Bar chart**: Top holdings by cost basis, position sizes
- **Stacked bar**: Asset class mix (Equity vs Fixed Income vs ETFs)
- **Horizontal bar**: Sector concentration ranked by weight

### 6. Client-Ready Output

Structure the response as a professional portfolio review:

#### CRM path (client-specific review)
1. **Client Context**: Name, risk profile, investment objectives, and portfolio strategy from the CRM
2. **Executive Summary**: 2-3 sentence overview of portfolio health, referencing YTD and since-inception performance
3. **Holdings Table**: All positions with ticker, company, sector, asset class, average cost, units, and cost basis
4. **Allocation Analysis**: Sector and asset class breakdowns with percentages
5. **Risk Assessment**: Concentration risks, alignment with stated risk profile, diversification notes
6. **Visualizations**: Charts saved to `/tmp` for download
7. **Recommendations Framework**: Areas to investigate (not specific buy/sell advice)

#### Generic path (user-provided data)
1. **Executive Summary**: 2-3 sentence overview of portfolio health
2. **Holdings Table**: All positions with available metrics
3. **Allocation Analysis**: Breakdowns by whatever dimensions the data supports (sector, asset class, geography)
4. **Risk Assessment**: Concentration risks, diversification notes
5. **Visualizations**: Charts saved to `/tmp` for download
6. **Recommendations Framework**: Areas to investigate (not specific buy/sell advice)

### 7. Compliance Note

Always include: "This analysis is for informational purposes only and does not constitute investment advice. Past performance does not guarantee future results."

### 8. Handoff to PDF Report

If the user wants a formal PDF (or you're chaining into `pdf-wealth-report`), **export structured data** that the PDF skill can consume. After completing the analysis, save a summary JSON to `/tmp`:

```python
import json

report_data = {
    "client_name": client_name,
    "client_id": client_id,
    "risk_profile": risk_profile,
    "performance_ytd": performance_ytd,
    "performance_inception": performance_inception,
    "total_cost_basis": total_cost_basis,
    "positions": df[["ticker", "companyName", "sector", "assetClass", "cost_basis", "units"]].to_dict(orient="records"),
    "sector_allocation": sector_alloc.to_dict(),  # {"Technology": 42.5, ...}
    "asset_class_allocation": asset_class_alloc.to_dict(),
    "top_holdings": top5.to_dict(),
    "risk_flags": risk_flags,  # list of strings
}

with open("/tmp/portfolio_analysis.json", "w") as f:
    json.dump(report_data, f, indent=2)
print("Analysis data saved: /tmp/portfolio_analysis.json")
```

**Important**: Do NOT re-generate charts for the PDF. The `pdf-wealth-report` skill has its own SVG chart pipeline (`generate-charts.js`) that produces theme-matched charts for the PDF layout. The matplotlib charts from this skill are for **inline chat display only**.

## Constraints

- Never provide specific buy/sell recommendations
- Always note when data may be stale or incomplete — CRM `average_cost` is the cost basis, not current market price
- Use `code_interpreter` for all calculations — do not estimate mentally
- Save all charts and reports to `/tmp`
- When comparing to current prices, use `web_search` to get live market data — do not guess
- Always confirm the correct client before running a full portfolio review
