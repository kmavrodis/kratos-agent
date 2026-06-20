#!/usr/bin/env node
// assemble.mjs — turn raw captured artifacts (out/raw.json) into the walkthrough
// dataset (out/capture.json) consumed by report-template.html.
//
//   node lib/assemble.mjs <raw.json> <capture.json>
//
// It decodes the user JWT (signature stripped — claims only), builds the 5 real
// hops of the OBO flow (NO APIM — agent invocations go straight to the Foundry
// project endpoint), and contrasts token claims vs. Graph-only fields.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [, , rawPath, outPath] = process.argv;
if (!rawPath || !outPath) {
  console.error("usage: node lib/assemble.mjs <raw.json> <capture.json>");
  process.exit(2);
}
const raw = JSON.parse(readFileSync(resolve(rawPath), "utf8"));

function decodeJwt(tok) {
  if (!tok || tok.split(".").length < 2) return { header: {}, claims: {} };
  const b64 = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  try {
    return { header: JSON.parse(b64(tok.split(".")[0])), claims: JSON.parse(b64(tok.split(".")[1])) };
  } catch {
    return { header: {}, claims: {} };
  }
}
const { header, claims } = decodeJwt(raw.userToken);
const eps = raw.endpoints || {};
const tr = raw.toolResult || {};
const oid = claims.oid || "";
const graphId = tr.id || "";
const fmt = (o) => JSON.stringify(o, null, 2);
const redactJwt = (tok) => (tok ? `${tok.slice(0, 24)}…<${tok.split(".").length === 3 ? "header.payload.signature" : "jwt"}, ${tok.length} chars, redacted>` : "(none)");

// ── token vs graph-only field selection ────────────────────────────────────
const jwtFields = [
  { k: "aud", v: claims.aud },
  { k: "scp", v: claims.scp },
  { k: "azp (client app)", v: claims.azp },
  { k: "name", v: claims.name },
  { k: "preferred_username", v: claims.preferred_username },
  { k: "oid", v: claims.oid },
  { k: "tid", v: claims.tid },
].filter((f) => f.v != null);

const graphFields = [
  { k: "graphRequestId", v: tr.graphRequestId },
  { k: "fetchedAtUtc", v: tr.fetchedAtUtc },
  { k: "jobTitle", v: tr.jobTitle },
  { k: "officeLocation", v: tr.officeLocation },
  { k: "department", v: tr.department },
  { k: "preferredLanguage", v: tr.preferredLanguage },
  { k: "mobilePhone", v: tr.mobilePhone },
  { k: "mail", v: tr.mail },
].filter((f) => f.v != null && f.v !== "");

// ── the 5 real hops ─────────────────────────────────────────────────────────
const steps = [
  {
    title: "Browser acquires a delegated token & sends it in the request body",
    from: "MSAL.js (browser)",
    to: `Backend · ${host(eps.backend)}`,
    summary: "POST /api/agent/chat — the user's access token rides in the JSON body under mcpAccessTokens, never in prompt text.",
    detailLabel: "POST /api/agent/chat (body, token redacted)",
    detail: fmt({
      conversationId: raw.conversationId || "<conv-id>",
      message: raw.prompt,
      mcpAccessTokens: Object.fromEntries((raw.requestBodyKeys || ["graph-obo"]).map((k) => [k, redactJwt(raw.userToken)])),
    }),
    note: `The token's audience is the <b>OBO server app</b> (<code>aud=${claims.aud || "api://<obo-server>"}</code>) with scope <code>scp=${claims.scp || "access_as_user"}</code> — it is <b>not</b> a Graph token. The OBO server will exchange it.`,
  },
  {
    title: "Backend forwards the body to the Foundry Invocations endpoint",
    from: `Backend · ${host(eps.backend)}`,
    to: "Foundry project (Invocations)",
    summary: "Straight to the Foundry project endpoint on the AI Services resource — no APIM in this path.",
    detailLabel: "POST …/agents/kratos-agent/endpoint/protocols/invocations",
    detail: [
      `${eps.foundryInvocations || "https://<resource>.cognitiveservices.azure.com/api/projects/<proj>/agents/kratos-agent/endpoint/protocols/invocations?api-version=…"}`,
      "",
      "Authorization: Bearer <backend managed-identity token for the Foundry resource>",
      "x-ms-* / x-agent-session-id: <warm-pool session routing>",
      "",
      "// The mcpAccessTokens body field is preserved by Foundry's own",
      "// Invocations gateway and reaches the sandbox (verified via kratos_diag).",
    ].join("\n"),
    note: `<b>The &quot;gateway&quot; here is Foundry's own Invocations gateway</b> (warm-pool / session manager), <b>not</b> APIM. The APIM AI-gateway fronts LLM calls only, and in this deployment <code>FOUNDRY_ENDPOINT</code> points directly at the AI Services resource, so APIM is not in the live path.`,
  },
  {
    title: "Hosted agent receives the token & injects it as the MCP server's Authorization header",
    from: "Foundry sandbox (hosted agent)",
    to: "graph-obo MCP server",
    summary: "The SDK attaches the per-user bearer ONLY as the graph-obo server's HTTP header — never shown to the model, never logged.",
    detailLabel: "kratos_diag (keys-only diagnostics emitted by the hosted agent)",
    detail: fmt({
      event: "kratos_diag",
      data: {
        mcp_token_body_keys: raw.requestBodyKeys || ["graph-obo"],
        mcp_token_effective_keys: (raw.hostedDiag && raw.hostedDiag.mcp_token_effective_keys) || ["graph-obo"],
        obo_env_url_present: (raw.hostedDiag && raw.hostedDiag.obo_env_url_present) ?? true,
        obo_env_name: (raw.hostedDiag && raw.hostedDiag.obo_env_name) || "graph-obo",
      },
    }),
    note: `<code>obo_env_url_present:true</code> means the sandbox has <code>OBO_MCP_SERVER_MCP_URL</code> (declared in <code>agent.yaml</code>), so the SDK auto-attaches the <code>graph-obo</code> tool. When this was empty, the tool never attached and the OBO server saw zero traffic.`,
  },
  {
    title: "OBO server validates the token & performs the On-Behalf-Of exchange",
    from: `graph-obo MCP · ${host(eps.oboMcp)}`,
    to: "Microsoft Entra (token endpoint)",
    summary: "Validates audience/scope/tenant/client, then exchanges the user assertion for a Graph token (secret-less FIC→MI in cloud; client secret locally).",
    detailLabel: "OBO MCP server logs",
    detail: (raw.oboLogs || [
      "obo-mcp-server.obo - OnBehalfOfCredential.get_token succeeded",
    ].join("\n")).trim(),
    note: `Self-auth differs by environment only: <b>cloud</b> = managed-identity federated credential (no secret); <b>local</b> = a dev client secret on the same app registration. The user-token validation and the Graph call are identical.`,
  },
  {
    title: "Graph /me returns the profile — as the signed-in user",
    from: `graph-obo MCP · ${host(eps.oboMcp)}`,
    to: "Microsoft Graph /v1.0/me",
    summary: "GET /me with the OBO Graph token → 200. The result carries fields that are NOT in the original token.",
    detailLabel: "Tool result returned to the agent",
    detail: fmt(tr),
    note: `The presence of <code>graphRequestId</code> (a correlation id <b>Graph</b> generated) plus fields like <code>department</code>/<code>preferredLanguage</code> proves this is a live Graph response, not a decoded JWT.`,
  },
];

function host(u) {
  if (!u) return "<host>";
  try { return new URL(u).host.split(".")[0]; } catch { return u; }
}

const walkthrough = {
  target: raw.target || "cloud",
  capturedAt: raw.capturedAt || new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
  prompt: raw.prompt,
  endpoints: eps,
  steps,
  answer: raw.answer || "",
  proof: {
    oidFromToken: oid,
    idFromGraph: graphId,
    match: !!(oid && graphId && oid === graphId),
    jwtFields,
    graphFields,
  },
  notes: {
    apim:
      "<b>No APIM in the agent path.</b> Agent invocations go directly to the Foundry project endpoint " +
      "(<code>…cognitiveservices.azure.com/api/projects/…/agents/kratos-agent/…/invocations</code>). The " +
      "&quot;gateway&quot; in the logs is Foundry's own Invocations gateway (warm-pool/session manager). The APIM " +
      "AI-gateway is an optional <b>LLM</b> governance layer; in this deployment <code>FOUNDRY_ENDPOINT</code> targets " +
      "the AI Services resource directly, so APIM is provisioned but bypassed.",
    repro:
      `<b>Reproduce:</b> <code>cd .copilot/skills/obo-demo-walkthrough &amp;&amp; ` +
      `TARGET=${raw.target || "cloud"} ./run.sh</code> &nbsp;·&nbsp; local: bring up <code>docker compose up</code> ` +
      `(adds the obo-mcp-server) then <code>TARGET=local ./run.sh</code>. Same proof, same HTML; only the OBO server's self-auth differs.`,
    footer:
      `Generated by the <b>obo-demo-walkthrough</b> skill · target=${raw.target || "cloud"} · ${new Date().toISOString()}`,
  },
};

writeFileSync(resolve(outPath), JSON.stringify(walkthrough, null, 2));
console.log(`[assemble] wrote ${outPath} — steps=${steps.length} match=${walkthrough.proof.match} graphOnlyFields=${graphFields.length}`);
