#!/usr/bin/env node
// capture-local.mjs — TARGET=local capture. POST the demo prompt to the local
// docker-compose backend with a real SPA user token attached under
// mcpAccessTokens (exactly as the frontend would), aggregate the SSE answer, and
// write the same browser-capture.json shape run.sh expects.
//
//   BACKEND_URL=http://localhost:8000 OBO_USER_TOKEN=<jwt> \
//     CAPTURE_OUT=out/browser-capture.json node lib/capture-local.mjs
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const TOKEN = process.env.OBO_USER_TOKEN || "";
const KEY = process.env.OBO_MCP_SERVER_NAME || "graph-obo";
const OUT = process.env.CAPTURE_OUT || "out/browser-capture.json";
const PROMPT =
  process.env.DEMO_PROMPT ||
  "Use your Microsoft Graph profile tool to look me up. Strictly from the tool result, report " +
    "displayName, userPrincipalName, id, department, jobTitle, officeLocation, preferredLanguage, " +
    "graphRequestId and fetchedAtUtc as a simple list.";

if (!TOKEN) {
  console.error("[capture-local] set OBO_USER_TOKEN to a fresh SPA user token");
  process.exit(2);
}

const body = {
  message: PROMPT,
  useCase: process.env.OBO_USE_CASE || "generic",
  conversationId: `obo-demo-${Date.now()}`,
  mcpAccessTokens: { [KEY]: TOKEN },
};

const resp = await fetch(`${BACKEND_URL}/api/agent/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
  body: JSON.stringify(body),
});
let answer = "";
if (resp.ok && resp.body) {
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const p = t.slice(5).trim();
      if (!p || p === "[DONE]") continue;
      try {
        const evt = JSON.parse(p);
        const ev = evt.event ?? evt.type;
        if (ev === "content") answer += evt.data?.content ?? evt.content ?? "";
      } catch {
        /* keepalive */
      }
    }
  }
} else {
  answer = `[backend ${resp.status}] ${await resp.text().catch(() => "")}`;
}

const out = {
  target: "local",
  backend: BACKEND_URL,
  prompt: PROMPT,
  userToken: TOKEN,
  requestBodyKeys: [KEY],
  conversationId: body.conversationId,
  answer: answer.trim(),
};
writeFileSync(resolve(OUT), JSON.stringify(out, null, 2));
console.error(`[capture-local] answer=${answer.length}chars -> ${OUT}`);
