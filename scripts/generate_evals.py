#!/usr/bin/env python3
"""Generate eval scenarios for one (or all) use-cases via the running backend.

Usage:
    # Local backend (default http://localhost:8000):
    python scripts/generate_evals.py --use-case insurance --count 5

    # Deployed backend:
    BACKEND_URL=https://kratos-be.example.com python scripts/generate_evals.py --all

    # Save generated scenarios into the repo (not just echo to stdout):
    python scripts/generate_evals.py --use-case insurance --save

Requires the backend's ``EvalService`` to be reachable. Auth: set
ADMIN_TOKEN (passed as bearer) only if ``ADMIN_AUTH_ENABLED=true`` on the
backend; otherwise endpoints are open.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

import httpx

REPO_ROOT = Path(__file__).resolve().parent.parent
USE_CASES_DIR = REPO_ROOT / "use-cases"
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000").rstrip("/")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN")

ALL_USE_CASES = [
    "generic",
    "insurance",
    "retail-banking",
    "sales-account-review",
    "wealth-management",
]


def _headers() -> dict[str, str]:
    h = {"content-type": "application/json"}
    if ADMIN_TOKEN:
        h["authorization"] = f"Bearer {ADMIN_TOKEN}"
    return h


def generate_for(use_case: str, count: int, instructions: str) -> list[dict[str, Any]]:
    url = f"{BACKEND_URL}/api/use-cases/{use_case}/evals/scenarios/generate"
    payload = {"count": count, "instructions": instructions}
    with httpx.Client(timeout=300.0) as client:
        r = client.post(url, json=payload, headers=_headers())
    r.raise_for_status()
    return r.json().get("scenarios", [])


def save_scenarios(use_case: str, scenarios: list[dict[str, Any]]) -> None:
    target_dir = USE_CASES_DIR / use_case / "evals" / "scenarios"
    target_dir.mkdir(parents=True, exist_ok=True)
    for s in scenarios:
        name = s.get("name", "").strip()
        if not name:
            print(f"  ! skipping scenario without 'name': {s!r}", file=sys.stderr)
            continue
        path = target_dir / f"{name}.json"
        path.write_text(json.dumps(s, indent=2) + "\n", encoding="utf-8")
        print(f"  ✔ saved {path.relative_to(REPO_ROOT)}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--use-case", help="One of: " + ", ".join(ALL_USE_CASES))
    group.add_argument("--all", action="store_true", help="Run for every use-case")
    parser.add_argument("--count", type=int, default=5, help="Scenarios per use-case (default 5)")
    parser.add_argument("--instructions", default="", help="Extra LLM hints")
    parser.add_argument("--save", action="store_true", help="Persist into use-cases/<uc>/evals/scenarios/")
    args = parser.parse_args()

    targets = ALL_USE_CASES if args.all else [args.use_case]
    for uc in targets:
        if uc not in ALL_USE_CASES:
            print(f"Unknown use-case: {uc}", file=sys.stderr)
            return 2
        print(f"→ Generating {args.count} scenarios for '{uc}'…")
        try:
            scenarios = generate_for(uc, args.count, args.instructions)
        except httpx.HTTPStatusError as e:
            print(f"  ✗ HTTP {e.response.status_code}: {e.response.text[:400]}", file=sys.stderr)
            return 1
        except httpx.HTTPError as e:
            print(f"  ✗ {type(e).__name__}: {e}", file=sys.stderr)
            return 1
        print(f"  Got {len(scenarios)} scenarios.")
        if args.save:
            save_scenarios(uc, scenarios)
        else:
            print(json.dumps(scenarios, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
