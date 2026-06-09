"""Render a single-account Kratos sales brief PDF via Playwright."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HTML_PATH = Path(__file__).resolve().parent.parent / "assets" / "account-brief.html"


def _fmt_money(n: float | int) -> str:
    try:
        return f"${int(round(float(n))):,}"
    except (TypeError, ValueError):
        return "—"


def _fmt_pct(p: float) -> str:
    try:
        return f"{int(round(float(p) * 100))}%"
    except (TypeError, ValueError):
        return "—"


def _fmt_date(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso).strftime("%-d %b %Y")
    except (TypeError, ValueError):
        return iso or "—"


def _health_badge(h: str) -> str:
    h = (h or "").lower()
    if h == "green":
        return "<span class='badge ok'>🟢 Green</span>"
    if h == "yellow":
        return "<span class='badge wip'>🟡 Yellow</span>"
    if h == "red":
        return "<span class='badge blocked'>🔴 Red</span>"
    return f"<span class='badge'>{h or '—'}</span>"


def _priority_badge(p: str) -> str:
    p = (p or "").upper()
    if p == "P1":
        return "<span class='badge blocked'>P1</span>"
    if p == "P2":
        return "<span class='badge wip'>P2</span>"
    return f"<span class='badge'>{p or '—'}</span>"


def _esc(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_html(args: argparse.Namespace, status: dict) -> str:
    template = HTML_PATH.read_text()
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    acct = status.get("account", {}) or {}

    pipeline_rows = "".join(
        f"<tr><td class='mono'>{_esc(o.get('id',''))}</td>"
        f"<td>{_esc(o.get('name',''))}</td>"
        f"<td>{_esc(o.get('stage',''))}</td>"
        f"<td class='right'>{_fmt_money(o.get('amount', 0))}</td>"
        f"<td class='right'>{_fmt_pct(o.get('probability', 0))}</td>"
        f"<td>{_fmt_date(o.get('close_date',''))}</td>"
        f"<td>{_esc(o.get('next_step','—'))}</td></tr>"
        for o in (status.get("pipeline") or [])
    ) or "<tr><td colspan='7' class='none'>No open opportunities.</td></tr>"

    contact_rows = "".join(
        f"<tr><td><strong>{_esc(c.get('name',''))}</strong>{' ⭐' if c.get('is_primary') else ''}</td>"
        f"<td>{_esc(c.get('title',''))}</td>"
        f"<td>{_esc(c.get('role','—'))}</td></tr>"
        for c in (status.get("contacts") or [])
    ) or "<tr><td colspan='3' class='none'>No contacts on file.</td></tr>"

    activity_rows = "".join(
        f"<tr><td>{_fmt_date(a.get('date',''))}</td>"
        f"<td>{_esc(a.get('type','—'))}</td>"
        f"<td><strong>{_esc(a.get('subject',''))}</strong><br><span class='muted'>{_esc(a.get('summary',''))}</span></td></tr>"
        for a in (status.get("activity") or [])
    ) or "<tr><td colspan='3' class='none'>No activity in the last quarter.</td></tr>"

    case_rows = "".join(
        f"<tr><td class='mono'>{_esc(c.get('id',''))}</td>"
        f"<td class='right'>{_priority_badge(c.get('priority',''))}</td>"
        f"<td>{_esc(c.get('status',''))}</td>"
        f"<td><strong>{_esc(c.get('subject',''))}</strong><br><span class='muted'>{_esc(c.get('summary',''))}</span></td></tr>"
        for c in (status.get("cases") or [])
    ) or "<tr><td colspan='4' class='none'>No open cases.</td></tr>"

    risks = (status.get("risks") or [])
    risks_html = "<ul>" + "".join(f"<li>{_esc(r)}</li>" for r in risks) + "</ul>" if risks else "<p class='none'>No open risks flagged.</p>"

    nexts = (status.get("next_steps") or [])
    nexts_html = "<ol>" + "".join(f"<li>{_esc(n)}</li>" for n in nexts) + "</ol>" if nexts else "<p class='none'>No next steps logged.</p>"

    return (
        template
        .replace("{{ACCOUNT_NAME}}", _esc(args.account_name))
        .replace("{{INDUSTRY}}", _esc(acct.get("industry", "—")))
        .replace("{{TIER}}", _esc(acct.get("tier", "—")))
        .replace("{{HEALTH_BADGE}}", _health_badge(acct.get("health", "")))
        .replace("{{ARR}}", _fmt_money(acct.get("arr", 0)))
        .replace("{{RENEWAL}}", _fmt_date(acct.get("renewal_date", "")))
        .replace("{{OWNER}}", _esc(acct.get("owner", "—")))
        .replace("{{CSM}}", _esc(acct.get("csm", "—")))
        .replace("{{SE}}", _esc(acct.get("se", "—")))
        .replace("{{DESCRIPTION}}", _esc(acct.get("description", "")))
        .replace("{{PIPELINE_ROWS}}", pipeline_rows)
        .replace("{{CONTACT_ROWS}}", contact_rows)
        .replace("{{ACTIVITY_ROWS}}", activity_rows)
        .replace("{{CASE_ROWS}}", case_rows)
        .replace("{{RISKS}}", risks_html)
        .replace("{{NEXT_STEPS}}", nexts_html)
        .replace("{{GENERATED_AT}}", generated_at)
    )


async def html_to_pdf(html: str, out_path: Path) -> None:
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()
        await page.set_content(html, wait_until="networkidle")
        await page.pdf(
            path=str(out_path),
            format="A4",
            margin={"top": "12mm", "bottom": "12mm", "left": "14mm", "right": "14mm"},
            print_background=True,
        )
        await browser.close()


def main() -> int:
    import asyncio

    p = argparse.ArgumentParser()
    p.add_argument("--account-name", required=True)
    p.add_argument("--status-json", required=True)
    p.add_argument("--out", required=True)
    args = p.parse_args()

    try:
        status = json.loads(args.status_json)
    except json.JSONDecodeError as e:
        print(f"error: --status-json invalid: {e}", file=sys.stderr)
        return 2
    if not isinstance(status, dict):
        print("error: --status-json must be a JSON object", file=sys.stderr)
        return 2

    html = render_html(args, status)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    try:
        asyncio.run(html_to_pdf(html, out))
    except Exception as e:
        print(f"error: playwright PDF render failed: {e}", file=sys.stderr)
        html_out = out.with_suffix(".html")
        html_out.write_text(html)
        print(f"HTML fallback: {html_out}")
        return 1

    print(f"PDF: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
