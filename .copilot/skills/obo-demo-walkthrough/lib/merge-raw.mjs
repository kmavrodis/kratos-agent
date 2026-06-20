#!/usr/bin/env node
// merge-raw.mjs — combine the browser/HTTP capture with the log-derived
// artifacts (backend kratos_diag, OBO server proof lines, tool result) into the
// single raw.json that lib/assemble.mjs consumes.
//
//   node lib/merge-raw.mjs <browser-capture.json> <raw.json>
//
// Log-derived inputs arrive via env: DIAG_LINE, OBO_PROOF, TOOL_RESULT_JSON,
// plus endpoint env (BACKEND_URL/FRONTEND_URL/OBO_MCP_URL/PROJECT_EP/TARGET).
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [, , capPath, outPath] = process.argv;
const cap = JSON.parse(readFileSync(resolve(capPath), "utf8"));

// Backend kratos_diag is logged as a python dict (single quotes / True/False).
function parsePyishDict(s) {
  if (!s) return null;
  const m = s.match(/\{.*\}/s);
  if (!m) return null;
  let j = m[0]
    .replace(/'/g, '"')
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null");
  try {
    const o = JSON.parse(j);
    return o.data || o;
  } catch {
    return null;
  }
}
function parseJson(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

const hostedDiag = parsePyishDict(process.env.DIAG_LINE || "") || {};
const toolResult = parseJson((process.env.TOOL_RESULT_JSON || "").trim()) || {};
const oboProof = (process.env.OBO_PROOF || "").trim();

const raw = {
  target: process.env.TARGET || cap.target || "cloud",
  capturedAt: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
  prompt: cap.prompt,
  conversationId: cap.conversationId,
  endpoints: {
    frontend: process.env.FRONTEND_URL || cap.frontend || "",
    backend: process.env.BACKEND_URL || "",
    oboMcp: process.env.OBO_MCP_URL || "",
    foundryInvocations: (process.env.PROJECT_EP || "") +
      (process.env.PROJECT_EP && !/invocations/.test(process.env.PROJECT_EP)
        ? "/agents/kratos-agent/endpoint/protocols/invocations"
        : ""),
  },
  userToken: cap.userToken || "",
  requestBodyKeys: cap.requestBodyKeys && cap.requestBodyKeys.length ? cap.requestBodyKeys : ["graph-obo"],
  hostedDiag,
  oboLogs: oboProof,
  toolResult,
  answer: cap.answer || "",
};
writeFileSync(resolve(outPath), JSON.stringify(raw, null, 2));
console.log(
  `[merge] token=${raw.userToken ? "yes" : "no"} diagKeys=${Object.keys(hostedDiag).length} toolFields=${Object.keys(toolResult).length} oboProofLines=${oboProof ? oboProof.split("\n").length : 0}`,
);
