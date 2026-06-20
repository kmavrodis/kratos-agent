/**
 * Shared helpers for the OBO identity-proof skill.
 *
 * These prove that when the kratos agent calls the `graph-obo` MCP server, the
 * call runs **as the signed-in user** (delegated / On-Behalf-Of) and NOT as the
 * agent's own managed identity. The centrepiece is *identity binding*: the
 * Entra object id (`oid`) inside the user's access token must equal the `id`
 * that Microsoft Graph `/me` returns through the tool.
 */
import { execFileSync } from "node:child_process";

export const BACKEND_URL =
  process.env.KRATOS_BACKEND_URL || process.env.OBO_BACKEND_URL || "";
export const FRONTEND_URL =
  process.env.KRATOS_FRONTEND_URL || process.env.OBO_FRONTEND_URL || "";

/** MCP server name the backend/hosted-agent key the token by (see azure.yaml). */
export const MCP_SERVER_NAME = process.env.OBO_MCP_SERVER_NAME || "graph-obo";
/** Direct MCP endpoint, e.g. https://<fqdn>/mcp — enables the server-level negative test. */
export const MCP_URL = process.env.OBO_MCP_URL || "";

/** A real SPA-issued user token for `api://<server>/access_as_user` (operator-supplied). */
export const USER_TOKEN = process.env.OBO_USER_TOKEN || "";

export const USE_CASE = process.env.OBO_USE_CASE || "generic";
export const CHAT_TIMEOUT_MS = Number(process.env.CHAT_TIMEOUT_MS || 90_000);

/** Decode a JWT payload (no signature check — we only read claims for assertions). */
export function decodeJwt(token: string): Record<string, any> {
  const parts = token.split(".");
  if (parts.length < 2) throw new Error("not a JWT");
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return JSON.parse(Buffer.from(b64 + pad, "base64").toString("utf8"));
}

/**
 * POST /api/agent/chat and aggregate the SSE stream. When `token` is provided,
 * it is attached the same way the frontend does — in the request BODY under
 * `mcpAccessTokens[MCP_SERVER_NAME]` — never as a header or prompt text.
 *
 * Returns the visible assistant `text` AND the `rawTranscript` (every SSE data
 * line concatenated) so callers can assert the raw token never leaked into the
 * stream the model/user can see.
 */
export async function chatWithToken(
  prompt: string,
  token?: string,
  useCase = USE_CASE,
  timeoutMs = CHAT_TIMEOUT_MS,
): Promise<{ text: string; rawTranscript: string; ok: boolean; status: number }> {
  const body: Record<string, any> = {
    message: prompt,
    useCase,
    conversationId: `obo-proof-${Date.now()}`,
  };
  if (token) body.mcpAccessTokens = { [MCP_SERVER_NAME]: token };

  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const resp = await fetch(`${BACKEND_URL}/api/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!resp.ok || !resp.body) {
      const t = resp.body ? await resp.text() : "";
      return { text: t, rawTranscript: t, ok: false, status: resp.status };
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let collected = "";
    let raw = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        raw += payload + "\n";
        try {
          const evt = JSON.parse(payload);
          const ev = evt.event ?? evt.type;
          if (ev === "content") collected += evt.data?.content ?? evt.content ?? "";
          else if (ev === "done") return { text: collected, rawTranscript: raw, ok: true, status: resp.status };
          else if (ev === "error")
            return {
              text: collected + `\n[error: ${evt.data?.message ?? evt.message ?? "unknown"}]`,
              rawTranscript: raw,
              ok: false,
              status: resp.status,
            };
        } catch {
          /* keepalive / non-JSON */
        }
      }
    }
    return { text: collected, rawTranscript: raw, ok: collected.length > 0, status: resp.status };
  } finally {
    clearTimeout(to);
  }
}

/** Best-effort: acquire an Azure-CLI-client token for a resource (used as a WRONG-client token). */
export function cliTokenForResource(resource: string): string | null {
  try {
    const out = execFileSync(
      "az",
      ["account", "get-access-token", "--scope", `${resource}/.default`, "--query", "accessToken", "-o", "tsv"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return out || null;
  } catch {
    return null; // Entra refused to issue (also a valid "wrong client is rejected" outcome)
  }
}

/**
 * Minimal MCP streamable-HTTP client: initialize -> notifications/initialized ->
 * tools/call. Returns the parsed JSON-RPC result of the tool call. Used for the
 * server-level negative test (call get_my_profile directly with a bad/no token).
 */
export async function mcpCallTool(
  url: string,
  toolName: string,
  bearer?: string,
): Promise<any> {
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (bearer) baseHeaders["Authorization"] = `Bearer ${bearer}`;

  const parseSse = (body: string): any => {
    for (const line of body.split("\n")) {
      const t = line.trim();
      if (t.startsWith("data:")) {
        try {
          return JSON.parse(t.slice(5).trim());
        } catch {
          /* keep scanning */
        }
      }
    }
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  };

  // 1) initialize
  const initResp = await fetch(url, {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "obo-identity-proof", version: "0.1.0" },
      },
    }),
  });
  const sessionId = initResp.headers.get("mcp-session-id") || "";
  const sessHeaders = sessionId ? { ...baseHeaders, "Mcp-Session-Id": sessionId } : baseHeaders;

  // 2) initialized notification (no response body expected)
  await fetch(url, {
    method: "POST",
    headers: sessHeaders,
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }),
  }).catch(() => undefined);

  // 3) tools/call
  const callResp = await fetch(url, {
    method: "POST",
    headers: sessHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: toolName, arguments: {} },
    }),
  });
  const parsed = parseSse(await callResp.text());
  return parsed?.result ?? parsed;
}

/** Pull the dict a FastMCP tool returned from a JSON-RPC tools/call result. */
export function toolResultObject(result: any): Record<string, any> | null {
  if (!result) return null;
  if (result.structuredContent && typeof result.structuredContent === "object") return result.structuredContent;
  const text = result.content?.[0]?.text;
  if (typeof text === "string") {
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }
  return null;
}
