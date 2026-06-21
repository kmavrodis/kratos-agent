#!/usr/bin/env node
// fetch-llm-log.mjs — pull the REAL LLM request(s) + response(s) and token usage
// that APIM captured for the agent's chat-completions calls, from the GenAI
// gateway log (ApiManagementGatewayLlmLog) in Log Analytics.
//
//   WORKSPACE_ID=<customerId> SINCE_MIN=20 MAX_CALLS=2 node lib/fetch-llm-log.mjs out/llm.json
//
// APIM writes the request and the (possibly chunked, streamed) response as
// SEPARATE rows correlated by CorrelationId. We aggregate both per correlation
// and return the most-recent MAX_CALLS calls oldest-first ([0]=tool decision,
// [last]=final answer for the OBO flow).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = process.argv[2] || "out/llm.json";
const WS = process.env.WORKSPACE_ID || "";
const SINCE = Number(process.env.SINCE_MIN || 20);
const MAX = Number(process.env.MAX_CALLS || 2);
if (!WS) {
  console.error("[llm-log] set WORKSPACE_ID to the Log Analytics customerId");
  process.exit(2);
}

// Aggregate request + response message chunks per correlation, ordered so chunked
// messages reassemble. make_list preserves ingest order well enough for the demo;
// for strict ordering APIM also exposes SequenceNumber.
const kql = `
ApiManagementGatewayLlmLog
| where TimeGenerated > ago(${SINCE}m)
| extend corr = tostring(CorrelationId)
| where isnotempty(corr)
| summarize
    firstSeen = min(TimeGenerated),
    lastSeen = max(TimeGenerated),
    reqParts = make_list_if(RequestMessages, isnotempty(RequestMessages)),
    respParts = make_list_if(ResponseMessages, isnotempty(ResponseMessages)),
    promptTokens = sum(PromptTokens),
    completionTokens = sum(CompletionTokens),
    totalTokens = sum(TotalTokens),
    deploy = any(DeploymentName),
    model = any(ModelName)
  by corr
| where array_length(reqParts) > 0
| top ${MAX} by lastSeen desc
| sort by lastSeen asc
`.trim();

let rows;
try {
  const out = execFileSync(
    "az",
    ["monitor", "log-analytics", "query", "--workspace", WS, "--analytics-query", kql, "-o", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 128 * 1024 * 1024 },
  );
  rows = JSON.parse(out);
} catch (e) {
  console.error("[llm-log] query failed:", String(e.stderr || e).slice(0, 500));
  process.exit(1);
}
if (!rows || !rows.length) {
  console.error(`[llm-log] no ApiManagementGatewayLlmLog rows in the last ${SINCE}m (ingestion can lag 2-5 min)`);
  process.exit(3);
}

const asArr = (v) => (Array.isArray(v) ? v : typeof v === "string" ? JSON.parse(v || "[]") : []);
const parse = (s) => {
  if (s == null || s === "") return null;
  try {
    return typeof s === "string" ? JSON.parse(s) : s;
  } catch {
    return s;
  }
};
// Each part is itself a JSON array of messages; flatten + parse.
const flattenMessages = (parts) => {
  const out = [];
  for (const p of asArr(parts)) {
    const parsed = parse(p);
    if (Array.isArray(parsed)) out.push(...parsed);
    else if (parsed != null) out.push(parsed);
  }
  return out;
};

const calls = rows.map((r) => ({
  correlationId: r.corr,
  deployment: r.deploy || r.model || null,
  usage: {
    promptTokens: r.promptTokens != null ? Number(r.promptTokens) : null,
    completionTokens: r.completionTokens != null ? Number(r.completionTokens) : null,
    totalTokens: r.totalTokens != null ? Number(r.totalTokens) : null,
  },
  request: flattenMessages(r.reqParts),
  response: flattenMessages(r.respParts),
}));

writeFileSync(resolve(OUT), JSON.stringify({ source: "ApiManagementGatewayLlmLog (APIM GenAI gateway)", calls }, null, 2));
console.error(
  `[llm-log] captured ${calls.length} call(s): ${calls.map((c) => `${c.correlationId.slice(0, 8)}(req${c.request.length}/resp${c.response.length}/${c.usage.totalTokens}t)`).join(", ")} -> ${OUT}`,
);
