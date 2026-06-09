"""Render the Olympus IT Service Desk shift-handover pack PDF via Playwright.

Reads:
  --outgoing-shift          e.g. "Day (Aaron Cole, AGT-301)"
  --incoming-shift          e.g. "Night (Chen Wu, AGT-303)"
  --shift-date              ISO date "YYYY-MM-DD"
  --tickets-json            JSON object with 5 keys (see SKILL.md for shape)
  --notes-for-incoming      free text (may be empty)
  --out                     output PDF path
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HTML_PATH = Path(__file__).resolve().parent.parent / "assets" / "handover-pack.html"


def _row(cells: list[str]) -> str:
    return "<tr>" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>"


def _section_p1_p2(items: list[dict]) -> str:
    if not items:
        return "<p class='none'>None.</p>"
    rows = []
    for t in items:
        badge = "🔴 VIP " if t.get("caller_vip") else ""
        rows.append(_row([
            f"<strong>{t.get('id','?')}</strong><br><span class='meta'>{t.get('priority','?')} · {t.get('state','?')}</span>",
            f"{badge}{t.get('caller','?')}<br><span class='meta'>{t.get('short_description','')}</span>",
            f"{t.get('assigned_to','?')}",
            f"<span class='meta'>{t.get('last_note','') or '<em>no notes yet</em>'}</span>",
        ]))
    return ("<table><thead><tr>"
            "<th>Ticket</th><th>Caller · summary</th><th>Owner</th><th>Last note</th>"
            "</tr></thead><tbody>" + "".join(rows) + "</tbody></table>")


def _section_awaiting(items: list[dict]) -> str:
    if not items:
        return "<p class='none'>None.</p>"
    rows = []
    for t in items:
        rows.append(_row([
            f"<strong>{t.get('id','?')}</strong>",
            f"{t.get('caller','?')}<br><span class='meta'>{t.get('short_description','')}</span>",
            f"{t.get('assigned_to','?')}",
            f"<span class='meta'>{t.get('what_we_asked','') or '—'}</span>",
        ]))
    return ("<table><thead><tr>"
            "<th>Ticket</th><th>Caller · summary</th><th>Owner</th><th>What we asked</th>"
            "</tr></thead><tbody>" + "".join(rows) + "</tbody></table>")


def _section_escalations(items: list[dict]) -> str:
    if not items:
        return "<p class='none'>None.</p>"
    rows = []
    for t in items:
        rows.append(_row([
            f"<strong>{t.get('id','?')}</strong>",
            f"{t.get('escalated_to','?')}",
            f"{t.get('escalated_when','?')}",
            f"{t.get('why','')}",
        ]))
    return ("<table><thead><tr>"
            "<th>Ticket</th><th>Escalated to</th><th>When</th><th>Why</th>"
            "</tr></thead><tbody>" + "".join(rows) + "</tbody></table>")


def _section_vip(items: list[dict]) -> str:
    if not items:
        return "<p class='none'>None.</p>"
    rows = []
    for t in items:
        rows.append(_row([
            f"<strong>{t.get('id','?')}</strong>",
            f"🔴 {t.get('caller','?')}",
            f"{t.get('vip_rationale','?')}",
            f"{t.get('status','')}",
        ]))
    return ("<table><thead><tr>"
            "<th>Ticket</th><th>Caller</th><th>Rationale</th><th>Status</th>"
            "</tr></thead><tbody>" + "".join(rows) + "</tbody></table>")


def _section_change(items: list[dict]) -> str:
    if not items:
        return "<p class='none'>None.</p>"
    rows = []
    for t in items:
        rows.append(_row([
            f"<strong>{t.get('id','?')}</strong>",
            f"{t.get('type','?')}",
            f"{t.get('state','?')}",
            f"{t.get('summary','')}",
        ]))
    return ("<table><thead><tr>"
            "<th>Item</th><th>Type</th><th>State</th><th>Summary</th>"
            "</tr></thead><tbody>" + "".join(rows) + "</tbody></table>")


def render_html(args: argparse.Namespace, tickets: dict) -> str:
    template = HTML_PATH.read_text()
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    notes = (args.notes_for_incoming or "").strip()
    notes_html = f"<p>{notes}</p>" if notes else "<p class='none'>No additional notes.</p>"

    return (
        template
        .replace("{{SHIFT_DATE}}", args.shift_date)
        .replace("{{OUTGOING_SHIFT}}", args.outgoing_shift)
        .replace("{{INCOMING_SHIFT}}", args.incoming_shift)
        .replace("{{GENERATED_AT}}", generated_at)
        .replace("{{COUNT_P1P2}}", str(len(tickets.get("p1_p2_open", []))))
        .replace("{{COUNT_AWAITING}}", str(len(tickets.get("awaiting_user", []))))
        .replace("{{COUNT_ESCALATIONS}}", str(len(tickets.get("pending_escalations", []))))
        .replace("{{COUNT_VIP}}", str(len(tickets.get("vip_watchlist", []))))
        .replace("{{SECTION_P1P2}}", _section_p1_p2(tickets.get("p1_p2_open", [])))
        .replace("{{SECTION_AWAITING}}", _section_awaiting(tickets.get("awaiting_user", [])))
        .replace("{{SECTION_ESCALATIONS}}", _section_escalations(tickets.get("pending_escalations", [])))
        .replace("{{SECTION_VIP}}", _section_vip(tickets.get("vip_watchlist", [])))
        .replace("{{SECTION_CHANGE}}", _section_change(tickets.get("network_change_in_flight", [])))
        .replace("{{NOTES_FOR_INCOMING}}", notes_html)
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
    p.add_argument("--outgoing-shift", required=True)
    p.add_argument("--incoming-shift", required=True)
    p.add_argument("--shift-date", required=True)
    p.add_argument("--tickets-json", required=True)
    p.add_argument("--notes-for-incoming", default="")
    p.add_argument("--out", required=True)
    args = p.parse_args()

    try:
        tickets = json.loads(args.tickets_json)
    except json.JSONDecodeError as e:
        print(f"error: --tickets-json invalid: {e}", file=sys.stderr)
        return 2
    if not isinstance(tickets, dict):
        print("error: --tickets-json must be a JSON object", file=sys.stderr)
        return 2

    html = render_html(args, tickets)
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
