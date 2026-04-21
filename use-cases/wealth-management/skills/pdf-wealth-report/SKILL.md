---
name: pdf-wealth-report
description: >
  Create polished PDF reports for private banking and wealth management — portfolio
  reviews, market outlooks, investment proposals, risk assessments, and CIO publications.
  Uses a navy-and-gold theme with serif typography, KPI cards, risk badges, and inline
  SVG charts (pie, donut, bar, line). Use when: (1) generating client portfolio reports
  or quarterly reviews; (2) writing market outlook or CIO publications; (3) creating
  investment proposals or recommendation memos; (4) producing risk assessment documents;
  (5) any wealth management or private banking PDF deliverable. Triggers on: "portfolio
  report", "client review", "market outlook PDF", "wealth management report", "investment
  proposal", "quarterly review", "CIO publication", "risk report".
enabled: true
---

# Wealth Report

Generate professional PDF reports for private banking and wealth management using
HTML templates with a navy-and-gold theme, then render via Playwright.

## Data Sources

Before building the report, gather the data you need:

- **From `portfolio-review` handoff**: If a portfolio analysis was already run, read `/tmp/portfolio_analysis.json` for pre-computed metrics (allocations, risk flags, performance). This avoids re-doing the analysis.
- **From CRM directly**: If no prior analysis exists, use `load_from_crm_by_client_fullname` / `get_client_portfolio` to get raw client and portfolio data, then compute the metrics yourself.
- **From `web_search`**: For market outlook reports, fetch current market data and news.
- **From `rag_search`**: For CIO views, house recommendations, and policy content.

**Key principle**: This skill handles **formatting and rendering** — not analysis. Get the numbers from `portfolio-review` or compute them via `code_interpreter` first, then focus on building the HTML and generating charts.

## Workflow

1. **Choose a template** from `assets/`:
   - `portfolio-review.html` — Client portfolio with KPIs, allocation, performance, risk, recs
   - `market-outlook.html` — CIO / market outlook with asset class views
2. **Copy and customize**: `cp assets/<template>.html <report-name>.html`
3. **Generate charts** (see below) and paste the SVG output into your HTML
4. **Replace placeholders** (ALL_CAPS) with real data
5. **Render**: `node scripts/generate-pdf.js <report-name>.html [output.pdf]`
6. **Verify**: Check output exists and size is reasonable

## generate-pdf.js

```
node scripts/generate-pdf.js <input.html> [output.pdf] [--format A4|Letter] [--landscape]
```

- Requires Playwright Chromium (`npx -y playwright install chromium`)
- For full-width cover bar: use `PDF_MARGIN_*=0` env vars (template handles its own padding)
- Default margins: 1.8cm top/bottom, 1.5cm sides

## Charts — generate-charts.js

Generate inline SVG charts to embed directly in report HTML. Zero external dependencies.

```bash
# Donut chart (recommended for allocation)
node scripts/generate-charts.js donut \
  --data "Equities:42,Fixed Income:28,Alternatives:15,Real Estate:10,Cash:5" \
  --title "Asset Allocation"

# Bar chart with benchmark comparison
node scripts/generate-charts.js bar \
  --data "Q1:3.2,Q2:4.1,Q3:2.8,Q4:1.9" \
  --benchmark "Q1:2.1,Q2:3.0,Q3:2.5,Q4:1.4" \
  --title "Quarterly Returns vs Benchmark"

# Line chart (portfolio value over time)
node scripts/generate-charts.js line \
  --data "Jan:100,Feb:103,Mar:101,Apr:107,May:110,Jun:108" \
  --title "Portfolio Value (Indexed)"

# Pie chart
node scripts/generate-charts.js pie \
  --data "CHF:55,EUR:25,USD:15,GBP:5" \
  --title "Currency Exposure"
```

**Options:** `--width 500 --height 300 --colors "#0B1F3A,#B8860B,..."` `--output chart.svg`

**To embed:** Run without `--output` to get SVG on stdout. Paste it directly into the HTML
where the chart should appear. SVGs use the same navy/gold color palette as the theme.

### Chart Recommendations by Section

| Report Section | Chart Type | Data |
|---------------|-----------|------|
| Asset Allocation | `donut` | Asset class weights |
| Performance Review | `bar` with `--benchmark` | Period returns vs benchmark |
| Portfolio Value | `line` | Monthly/quarterly indexed values |
| Currency Exposure | `pie` | Currency breakdown |
| Sector Breakdown | `donut` | Sector weights |
| Risk Contribution | `bar` | Risk % by asset class |

## CSS Quick Reference

| Class | Effect |
|-------|--------|
| `.box.box-insight` | 💡 Navy insight callout |
| `.box.box-risk` | 🚨 Red risk warning |
| `.box.box-opportunity` | 📈 Green opportunity callout |
| `.box.box-note` | 📝 Amber advisory note |
| `.risk-badge.risk-low` | Green "Low" pill |
| `.risk-badge.risk-moderate` | Amber "Moderate" pill |
| `.risk-badge.risk-high` | Red "High" pill |
| `.positive` / `.negative` / `.neutral` | Green / red / gray for returns |
| `.currency` | Tabular-numeral formatting |
| `tr.highlight` | Gold-highlighted table row |
| `.kpi-grid` + `.kpi-card` | 4-column KPI dashboard |
| `.page-break` | Force new page before element |

For full CSS details: `references/css-reference.md`

## Cover Bar

The cover uses a gradient navy background with gold accents. Structure:

```html
<div class="cover-bar">
  <p class="firm-name">FIRM_NAME</p>
  <h1>REPORT_TITLE</h1>
  <p class="subtitle">REPORT_SUBTITLE</p>
  <div class="cover-divider"></div>
  <div class="cover-meta">
    <span>Prepared for <strong style="color:white">CLIENT_NAME</strong> · CLIENT_ID</span>
    <span>DATE · ADVISOR_NAME, ADVISOR_TITLE</span>
  </div>
  <div class="cover-meta">
    <span class="confidential">Strictly Private &amp; Confidential</span>
    <span>FIRM_LOCATION</span>
  </div>
</div>
```

For full-width rendering, set all Playwright margins to 0 — the `.content` wrapper provides
internal page margins for everything below the cover.

## Compliance

Every report **must** include a footer with disclaimer. See `references/compliance.md` for:
- Disclaimer templates by report type (client, CIO, research)
- Classification labels
- Regulatory references by jurisdiction (FINMA, FCA, MiFID II, MAS)
- Risk profile definitions

## Guidelines

### When to Use This Skill

- **Use for**: Formal client deliverables, quarterly portfolio reviews, market outlook publications, investment proposals, documented recommendations, and any content that needs to be a polished PDF.
- **Do NOT use for**: Quick verbal portfolio summaries, simple Q&A about a client, ad-hoc calculations, or informal internal discussions. For those, respond inline in chat using `portfolio-review` or `code_interpreter` instead.

### Report Standards

- **One HTML file per report** — fully self-contained (charts are inline SVG)
- **Serif for narrative** (Georgia), **sans-serif for data** (Segoe UI)
- **Include at least 2-3 charts** in any portfolio report — clients expect visual data
- **KPI cards**: Max 4 per row for executive summaries
- **Risk badges** on every recommendation and risk metric
- **Gold highlights** (`tr.highlight`) sparingly — totals or key rows only
- **Page breaks**: At minimum before Performance and Risk sections
- **Footer**: Always present with disclaimer, date, and preparer
- **Theme**: Navy (#0B1F3A) + Gold (#B8860B). Do not change primary colors.
- **Currency**: Always specify (CHF, EUR, USD). Use `.currency` class for alignment.
- **Positive/negative**: Always use `.positive`/`.negative` classes — never raw text.
