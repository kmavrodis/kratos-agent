---
name: code-interpreter
description: Sandboxed Python execution for computation, data analysis, and code generation
enabled: true
---

## Instructions

1. Accept a Python code block or computation request from the agent.
2. Execute the code in a sandboxed environment:
   - No file system access beyond /tmp
   - Network access limited to package installation (pip install)
   - Memory limited to 256 MB
   - Execution timeout: 30 seconds
3. Capture and return:
   - stdout output
   - Return value (if any)
   - Any errors or exceptions
4. Support common data analysis libraries: pandas, numpy, matplotlib.

### Insurance-Specific Uses

- Calculate premium estimates and compare deductible scenarios
- Analyze claims data volumes, loss ratios, and trends
- Build comparison tables for policy options
- Generate charts for claims frequency, severity, or geographic distribution
- Compute financial metrics: loss ratios, combined ratios, reserve adequacy

## Scripts

Run `scripts/execute.py` with the `code` parameter containing the Python code to execute.
