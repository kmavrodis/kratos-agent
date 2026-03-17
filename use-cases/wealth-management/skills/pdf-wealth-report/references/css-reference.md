# CSS Reference — Wealth Report Theme

## Design Language
- **Primary:** Navy (#0B1F3A) — headings, table headers, cover bar
- **Accent:** Gold (#B8860B) — section underlines, footer border, highlights
- **Body text:** Georgia / Times New Roman (serif) for narrative, Segoe UI (sans-serif) for data
- **Tables & callouts:** Sans-serif for readability at small sizes

## Color Palette
| Token | Hex | Usage |
|-------|-----|-------|
| `--navy` | #0B1F3A | Headings, table headers, cover |
| `--gold` | #B8860B | Accents, borders, highlights |
| `--gold-lt` | #F5ECD7 | Highlighted rows |
| `--slate` | #3C4A5C | Subheadings |
| `--text` | #1E2A3A | Body text |
| `--muted` | #6B7B8D | Secondary text, disclaimers |
| `--green` | #1B6B3A | Positive values, opportunities |
| `--red` | #8B1A1A | Negative values, risks |
| `--amber` | #8B6914 | Warnings, moderate risk |

## Callout Boxes
```html
<div class="box box-insight">💡 Investment insight</div>
<div class="box box-risk">🚨 Risk warning</div>
<div class="box box-opportunity">📈 Opportunity</div>
<div class="box box-note">📝 Advisory note</div>
```

## Risk Badges
```html
<span class="risk-badge risk-low">Low</span>
<span class="risk-badge risk-moderate">Moderate</span>
<span class="risk-badge risk-high">High</span>
```

## Financial Data
```html
<td class="positive">+3.2%</td>   <!-- green, bold -->
<td class="negative">-1.4%</td>   <!-- red, bold -->
<td class="neutral">0.0%</td>     <!-- gray -->
<td class="currency">CHF 1,200,000</td>  <!-- tabular numerals -->
```

## KPI Cards (grid of 4)
```html
<div class="kpi-grid">
  <div class="kpi-card">
    <div class="label">Total AuM</div>
    <div class="value currency">CHF 12.4M</div>
    <div class="delta positive">▲ +3.2% QoQ</div>
  </div>
</div>
```

## Allocation Visualization
Use `generate-charts.js donut` instead of inline bars. Embed the SVG output directly in the HTML.

## Table Highlighting
```html
<tr class="highlight">...</tr>  <!-- gold background for emphasis -->
```

## Page Control
```html
<h2 class="page-break">New section on new page</h2>
```

## Cover Bar
```html
<div class="cover-bar">
  <h1>Report Title</h1>
  <p class="subtitle">Subtitle</p>
  <div class="cover-meta">
    <span>Client info</span>
    <span>Date · Advisor</span>
  </div>
  <div class="cover-meta">
    <span class="confidential">Strictly Private & Confidential</span>
  </div>
</div>
```

## Footer & Disclaimer
```html
<div class="footer">
  <p><strong>Prepared by:</strong> ...</p>
  <p class="disclaimer">Regulatory disclaimer text...</p>
</div>
```
