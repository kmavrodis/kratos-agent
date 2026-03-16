---
name: data-analysis
description: Analyze data with pandas, generate visualizations with matplotlib, and return results as downloadable files
enabled: true
---

## Instructions

When the user provides data (inline, as a file, or asks you to generate sample data) and wants analysis, follow this workflow:

### 1. Data Ingestion

- If the user provides a CSV, JSON, or other structured data inline, write it to `/tmp` first using `code_interpreter`.
- If the user references a file already in `/tmp`, read it directly.
- If no data is available, offer to generate realistic sample data for demonstration.

### 2. Exploratory Analysis

Before diving into specific questions, give the user a quick overview:

```python
import pandas as pd

df = pd.read_csv("/tmp/data.csv")
print(f"Shape: {df.shape}")
print(f"\nColumns: {list(df.columns)}")
print(f"\nData types:\n{df.dtypes}")
print(f"\nFirst 5 rows:\n{df.head()}")
print(f"\nSummary statistics:\n{df.describe()}")
print(f"\nMissing values:\n{df.isnull().sum()}")
```

### 3. Analysis Patterns

Use the `code_interpreter` skill with pandas for:
- **Aggregations**: groupby, pivot tables, rolling windows
- **Filtering**: conditional selection, top-N, outlier detection
- **Transformations**: calculated columns, date parsing, normalization
- **Statistical tests**: correlation, distribution analysis

### 4. Visualizations

Generate charts with matplotlib and save to `/tmp`:

```python
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend — required
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(10, 6))
# ... plot logic ...
plt.tight_layout()
plt.savefig("/tmp/chart.png", dpi=150)
plt.close()
print("Chart saved: /tmp/chart.png")
```

Always:
- Use `matplotlib.use("Agg")` before importing pyplot (headless environment).
- Save to `/tmp/` with a descriptive name (e.g. `/tmp/sales_by_region.png`).
- Call `plt.close()` after saving to free memory.
- Include a `print()` with the file path so file-sharing can pick it up.

Common chart types:
- **Bar charts** for category comparisons
- **Line charts** for time series / trends
- **Scatter plots** for correlations
- **Histograms** for distributions
- **Heatmaps** for correlation matrices
- **Pie charts** only when there are ≤6 categories

### 5. Output

- Print key findings as text in `code_interpreter` stdout.
- Save any generated files (charts, processed CSVs) to `/tmp`.
- Reference file paths in your response so the user can download them via the file-sharing capability.
- If the analysis produces a transformed dataset, save it as `/tmp/<descriptive_name>.csv`.

### 6. Chaining

This skill works best when combined with:
- `code_interpreter` — runs the actual Python code
- `file-sharing` — delivers charts and processed files to the user
- `rag_search` — retrieves internal data or context before analysis

## Constraints

- Max execution time: 30 seconds per code block
- Available libraries: pandas, numpy, matplotlib (pre-installed in sandbox)
- Files must be written to `/tmp`
- Keep DataFrames under ~1M rows for responsive performance

## Example

User: "Analyze this sales data and show me a monthly trend chart"

Steps:
1. Use `code_interpreter` to load the data with pandas
2. Compute monthly aggregations
3. Generate a line chart with matplotlib, save to `/tmp/monthly_sales_trend.png`
4. Print summary statistics
5. Reply with findings and the chart file path
