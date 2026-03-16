"""Code Interpreter MCP Skill — Sandboxed Python execution."""

import io
import json
import sys
import traceback
from contextlib import redirect_stdout, redirect_stderr


def execute(code: str) -> str:
    """Execute Python code in a sandboxed environment.

    Args:
        code: Python code to execute.

    Returns:
        JSON string with execution results.
    """
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()

    result = {
        "status": "success",
        "stdout": "",
        "stderr": "",
        "return_value": None,
        "error": None,
    }

    try:
        # Create a restricted globals dict
        restricted_globals = {
            "__builtins__": {
                "print": print,
                "range": range,
                "len": len,
                "int": int,
                "float": float,
                "str": str,
                "list": list,
                "dict": dict,
                "tuple": tuple,
                "set": set,
                "bool": bool,
                "sum": sum,
                "min": min,
                "max": max,
                "abs": abs,
                "round": round,
                "sorted": sorted,
                "enumerate": enumerate,
                "zip": zip,
                "map": map,
                "filter": filter,
                "isinstance": isinstance,
                "type": type,
                "True": True,
                "False": False,
                "None": None,
            }
        }

        with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
            exec(code, restricted_globals)  # noqa: S102
            # Note: exec is used here intentionally for code interpretation.
            # The restricted_globals dict limits available builtins for sandboxing.

        result["stdout"] = stdout_capture.getvalue()
        result["stderr"] = stderr_capture.getvalue()

    except Exception as e:
        result["status"] = "error"
        result["error"] = {
            "type": type(e).__name__,
            "message": str(e),
            "traceback": traceback.format_exc(),
        }

    return json.dumps(result)


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        code = sys.argv[1]
    else:
        code = "print('Hello from Code Interpreter')\nresult = 2 + 2\nprint(f'2 + 2 = {result}')"

    output = execute(code)
    print(output)
