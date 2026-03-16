---
name: code-interpreter
description: Sandboxed Python execution for computation, data analysis, and code generation
enabled: true
---

## Instructions

1. Accept a Python code block or computation request from the agent.
2. Execute the code in a sandboxed environment:
   - No file system access beyond /tmp
   - No network access
   - Memory limited to 256 MB
   - Execution timeout: 30 seconds
3. Capture and return:
   - stdout output
   - Return value (if any)
   - Any errors or exceptions
4. Support common data analysis libraries: pandas, numpy, matplotlib.

## Scripts

Run `scripts/execute.py` with the `code` parameter containing the Python code to execute.
