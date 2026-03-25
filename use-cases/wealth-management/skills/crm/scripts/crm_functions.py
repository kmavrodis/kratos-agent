"""CRM Skill — Search and retrieve wealth-management client data from JSON."""

import json
from pathlib import Path
from typing import Any, Callable

# Load client data once at import time
_DATA_FILE = Path(__file__).parent.parent / "data" / "customer-banking.json"
_clients: list[dict[str, Any]] = []

if _DATA_FILE.exists():
    with open(_DATA_FILE, encoding="utf-8") as f:
        _clients = json.load(f)


def _sanitize_client(client: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of the client dict safe for display (excludes raw portfolio positions for brevity)."""
    result = {}
    for key in (
        "clientID", "status", "fullName", "firstName", "lastName",
        "dateOfBirth", "nationality", "contactDetails", "address",
        "financialInformation", "investmentProfile", "pep_status",
        "documents_provided", "name_screening_result",
    ):
        if key in client:
            result[key] = client[key]
    # Include portfolio summary without full positions list
    if "portfolio" in client:
        p = client["portfolio"]
        result["portfolio"] = {
            "strategy": p.get("strategy", ""),
            "riskProfile": p.get("riskProfile", ""),
            "performanceYTD": p.get("performanceYTD", ""),
            "performanceSinceInception": p.get("performanceSinceInception", ""),
            "inceptionDate": p.get("inceptionDate", ""),
            "positionCount": len(p.get("positions", [])),
        }
    return result


def load_from_crm_by_client_fullname(client_fullname: str) -> str:
    """Search for clients by full name (case-insensitive partial match).

    Args:
        client_fullname: The full name or part of the name to search for.

    Returns:
        JSON string with matching client records or an error message.
    """
    if not client_fullname or not client_fullname.strip():
        return json.dumps({"status": "error", "message": "client_fullname is required"})

    query = client_fullname.strip().lower()
    matches = [
        _sanitize_client(c) for c in _clients
        if query in c.get("fullName", "").lower()
        or query in c.get("firstName", "").lower()
        or query in c.get("lastName", "").lower()
    ]

    if not matches:
        return json.dumps({
            "status": "not_found",
            "message": f"No clients found matching '{client_fullname}'",
        })

    return json.dumps({"status": "success", "count": len(matches), "clients": matches})


def load_from_crm_by_client_id(client_id: str) -> str:
    """Retrieve a client record by exact client ID.

    Args:
        client_id: The unique client identifier (e.g. '123456').

    Returns:
        JSON string with the client record or an error message.
    """
    if not client_id or not client_id.strip():
        return json.dumps({"status": "error", "message": "client_id is required"})

    client_id = client_id.strip()
    for c in _clients:
        if c.get("clientID") == client_id or c.get("id") == client_id:
            return json.dumps({"status": "success", "client": _sanitize_client(c)})

    return json.dumps({
        "status": "not_found",
        "message": f"No client found with ID '{client_id}'",
    })


def get_client_portfolio(client_id: str) -> str:
    """Retrieve the full portfolio (including all positions) for a client.

    Args:
        client_id: The unique client identifier.

    Returns:
        JSON string with full portfolio data or an error message.
    """
    if not client_id or not client_id.strip():
        return json.dumps({"status": "error", "message": "client_id is required"})

    client_id = client_id.strip()
    for c in _clients:
        if c.get("clientID") == client_id or c.get("id") == client_id:
            portfolio = c.get("portfolio", {})
            return json.dumps({
                "status": "success",
                "clientID": c.get("clientID"),
                "fullName": c.get("fullName"),
                "portfolio": portfolio,
            })

    return json.dumps({
        "status": "not_found",
        "message": f"No client found with ID '{client_id}'",
    })


def list_all_clients() -> str:
    """List all clients in the CRM with basic summary info.

    Returns:
        JSON string with a summary list of all clients.
    """
    summaries = []
    for c in _clients:
        summaries.append({
            "clientID": c.get("clientID"),
            "fullName": c.get("fullName"),
            "status": c.get("status"),
            "riskProfile": c.get("investmentProfile", {}).get("riskProfile", ""),
        })
    return json.dumps({"status": "success", "count": len(summaries), "clients": summaries})


# Exported list of callable functions for the skill registry
crm_functions: list[Callable[..., Any]] = [
    load_from_crm_by_client_fullname,
    load_from_crm_by_client_id,
    get_client_portfolio,
    list_all_clients,
]


if __name__ == "__main__":
    import sys

    # Function dispatch map — the SDK calls: python crm_functions.py <function_name> <args...>
    _DISPATCH = {
        "load_from_crm_by_client_fullname": lambda args: load_from_crm_by_client_fullname(" ".join(args)),
        "load_from_crm_by_client_id": lambda args: load_from_crm_by_client_id(args[0] if args else ""),
        "get_client_portfolio": lambda args: get_client_portfolio(args[0] if args else ""),
        "list_all_clients": lambda args: list_all_clients(),
    }

    if len(sys.argv) < 2:
        print(list_all_clients())
    elif sys.argv[1] in _DISPATCH:
        # SDK-style invocation: crm_functions.py <function_name> <arg1> <arg2> ...
        print(_DISPATCH[sys.argv[1]](sys.argv[2:]))
    elif sys.argv[1] == "--id" and len(sys.argv) > 2:
        print(load_from_crm_by_client_id(sys.argv[2]))
    elif sys.argv[1] == "--portfolio" and len(sys.argv) > 2:
        print(get_client_portfolio(sys.argv[2]))
    else:
        # Fallback: treat all args as a client name search
        print(load_from_crm_by_client_fullname(" ".join(sys.argv[1:])))
