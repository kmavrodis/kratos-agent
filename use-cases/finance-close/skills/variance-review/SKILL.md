---
name: variance-review
description: Run a YTD-vs-prior-year variance review and flag accounts that need investigation
enabled: true
---

## Instructions

Use this skill when the controller asks for a variance review, close-package summary, or "what's off this month?" (e.g. "Run my May variance review", "What's investigate-grade right now?", "How does T&E look vs prior year?").

### 1. Pull the variance

`sap_get_variance_analysis` with no `gl_code` returns variance for every GL account. Pass `threshold_watch_pct` and `threshold_investigate_pct` only if the user named specific thresholds; otherwise let the defaults (25 / 50%) stand.

### 2. Render

Group by `flag` — `investigate` first, then `watch`, then `normal` (collapsed to a count).

```markdown
# Variance Review — {period} vs Prior Year

## 🔴 Investigate (flag >= 50%)

| GL | Account | YTD Actual | Prior Year | Variance | % |
|---|---|---|---|---|---|
| 6200 | Travel & Entertainment | $1,640,000 | $880,000 | +$760,000 | **+86.4%** |
| 4000 | Revenue — Product | -$68,420,000 | -$52,180,000 | -$16,240,000 | **+31.1%** ✅ favourable |

## 🟡 Watch (flag 25–50%)
| GL | Account | YTD Actual | Prior Year | Variance | % |
|---|---|---|---|---|---|
| …

## ✅ Normal
8 accounts within ±25% of prior year.

## Suggested drill-downs
1. **GL 6200 T&E +86%** — pull JEs touching 6200 in this period; the single `JE-30099` manual entry of $480k on 27 May looks like a likely contributor. Worth reviewing.
2. **GL 4000 Revenue +31% favourable** — confirm with FP&A that this matches the topline forecast.
```

### Targeted patterns

- **"Anything to investigate?"** → render only the `investigate` table + a one-line summary
- **"How does {account} look?"** → call with `gl_code` set, render a single row
- **"Investigate top 3"** → take the three highest absolute variances regardless of flag

### Constraints

- Don't propose JEs from this skill — that's `journal-entry-proposal`. Suggest the next skill instead.
- Currency: `$1,640,000`, percentages signed with one decimal (`+86.4%`).
- Revenue accounts have credit normal balance — a *larger* (more negative) actual is *favourable*. Mark with ✅ when appropriate.
