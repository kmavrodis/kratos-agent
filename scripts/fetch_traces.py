#!/usr/bin/env python3
"""Fetch trace operations from the backend (App Insights waterfall).

Usage:
    python scripts/fetch_traces.py                                 # list recent ops
    python scripts/fetch_traces.py --use-case insurance --hours 24
    python scripts/fetch_traces.py --conversation-id abc123
    python scripts/fetch_traces.py --run-id 20260101T120000Z
    python scripts/fetch_traces.py --operation-id 9fe9...           # full waterfall
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import httpx

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000").rstrip("/")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN")


def _headers() -> dict[str, str]:
    h: dict[str, str] = {}
    if ADMIN_TOKEN:
        h["authorization"] = f"Bearer {ADMIN_TOKEN}"
    return h


def list_ops(**filters: str | int | None) -> dict:
    params = {k: v for k, v in filters.items() if v is not None}
    url = f"{BACKEND_URL}/api/traces/operations"
    with httpx.Client(timeout=60.0) as client:
        r = client.get(url, params=params, headers=_headers())
    r.raise_for_status()
    return r.json()


def get_op(operation_id: str, hours: int) -> dict:
    url = f"{BACKEND_URL}/api/traces/operations/{operation_id}"
    with httpx.Client(timeout=60.0) as client:
        r = client.get(url, params={"lookback_hours": hours}, headers=_headers())
    r.raise_for_status()
    return r.json()


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--use-case")
    p.add_argument("--conversation-id")
    p.add_argument("--run-id")
    p.add_argument("--operation-id", help="Fetch full waterfall for this op id")
    p.add_argument("--hours", type=int, default=24)
    p.add_argument("--limit", type=int, default=50)
    args = p.parse_args()

    try:
        if args.operation_id:
            data = get_op(args.operation_id, args.hours)
        else:
            data = list_ops(
                use_case=args.use_case,
                conversation_id=args.conversation_id,
                run_id=args.run_id,
                hours=args.hours,
                limit=args.limit,
            )
    except httpx.HTTPStatusError as e:
        print(f"✗ HTTP {e.response.status_code}: {e.response.text[:400]}", file=sys.stderr)
        return 1

    print(json.dumps(data, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
