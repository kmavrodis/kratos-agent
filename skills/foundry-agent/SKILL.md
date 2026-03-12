---
name: foundry-agent
description: Delegate specialized tasks to Microsoft Foundry sub-agents for evaluation, guardrails, and model routing
---

## Instructions

1. Accept a task description and optional configuration from the agent.
2. Route the task to the appropriate Foundry capability:
   - **Evaluation**: Run agent quality assessment against a prompt/response pair
   - **Guardrails**: Check content safety, PII detection, prompt injection shields
   - **Model routing**: Select the optimal model for a given sub-task
3. Return structured results:
   - Evaluation scores and metrics
   - Safety assessment results
   - Recommended model and reasoning
4. All calls authenticated via Managed Identity.

## Scripts

Run `scripts/delegate.py` with the task specification.
