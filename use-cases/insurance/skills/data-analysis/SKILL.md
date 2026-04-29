---
name: data-analysis
description: Analyze insurance data — claims trends, loss ratios, premium comparisons, coverage utilization, and risk metrics
enabled: true
---

## Instructions

When the user asks for claims analysis, loss ratio calculations, premium comparisons, coverage utilization reports, or risk metrics, follow this workflow:

### 1. Data Ingestion

- If the user has data from the **crm** skill (customer/policy records), use that as input
- If the user provides CSV/JSON data inline, write it to `/tmp` first using `code_interpreter`
- If no data is available, offer to generate realistic sample insurance data for demonstration

### 2. Insurance-Specific Analyses

#### Claims Analysis
```python
import pandas as pd

df = pd.DataFrame(claims_data)
print(f"Total Claims: {len(df)}")
print(f"Open Claims: {len(df[df['status'] == 'Open'])}")
print(f"Average Claim Amount: ${df['amount'].mean():,.2f}")
print(f"Total Incurred: ${df['amount'].sum():,.2f}")
print(f"\nClaims by Status:\n{df['status'].value_counts()}")
print(f"\nClaims by Product Line:\n{df.groupby('product_type')['amount'].agg(['count', 'sum', 'mean'])}")
```

#### Loss Ratio Calculation
```python
def loss_ratio(incurred_losses, earned_premiums):
    """Loss ratio = Incurred Losses / Earned Premiums"""
    ratio = incurred_losses / earned_premiums * 100
    status = "Profitable" if ratio < 70 else "Borderline" if ratio < 100 else "Unprofitable"
    return round(ratio, 1), status

ratio, status = loss_ratio(incurred_losses=850000, earned_premiums=1200000)
print(f"Loss Ratio: {ratio}% — {status}")
```

#### Premium Comparison
```python
# Compare coverage options side by side
options = pd.DataFrame([
    {"Plan": "Basic", "Premium": 120, "Deductible": 2500, "Limit": 100000},
    {"Plan": "Standard", "Premium": 200, "Deductible": 1000, "Limit": 250000},
    {"Plan": "Premium", "Premium": 350, "Deductible": 500, "Limit": 500000},
])
print(options.to_string(index=False))
```

#### Coverage Utilization
- Claims frequency by policy type
- Average severity (claim amount) by product line
- Utilization rate (claims filed / policies in force)

### 3. Visualizations

Generate charts with matplotlib and save to `/tmp`:

```python
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Claims by product line
fig, ax = plt.subplots(figsize=(10, 6))
claims_by_type.plot(kind="bar", ax=ax)
ax.set_title("Claims by Product Line")
ax.set_ylabel("Number of Claims")
plt.tight_layout()
plt.savefig("/tmp/claims_by_product.png", dpi=150)
plt.close()
print("Chart saved: /tmp/claims_by_product.png")
```

Common insurance charts:
- **Bar chart**: Claims count/amount by product line or status
- **Line chart**: Monthly claims trend, loss ratio over time
- **Pie chart**: Claims distribution by category (≤6 categories)
- **Stacked bar**: Open vs closed claims by month
- **Heatmap**: Claims by region and product type

### 4. Risk Metrics

Provide insights based on the data:
- **Loss ratio trend**: Is it improving or deteriorating?
- **Claims frequency**: Number of claims per 1,000 policies
- **Average severity**: Mean claim amount by product line
- **Large loss identification**: Flag claims significantly above average
- **Concentration risk**: Are claims concentrated in specific regions, products, or time periods?

### 5. Output

- Print key findings as text
- Save charts to `/tmp` with descriptive names
- Reference file paths for download
- If analysis produces a transformed dataset, save as CSV to `/tmp`

## Chaining

- `code_interpreter` — runs the Python code
- `crm` — provides source customer and policy data
- `rag-search` — provides policy wording context for claims analysis
- `file-sharing` — delivers charts and exports

## Constraints

- Pre-installed libraries: pandas, numpy, matplotlib. Additional libraries can be installed at runtime via pip.
- Files must be written to `/tmp`
- Max execution time: 30 seconds per code block
- Always include appropriate caveats on actuarial estimates
