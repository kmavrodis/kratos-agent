#!/usr/bin/env node
// servicenow-mcp-server — stdio MCP server that mocks ServiceNow ITSM
// against curated JSON fixtures. Covers incidents / requests / change,
// users (cross-referenced with workday-mcp-server EMP-* ids), KB articles,
// CMDB items, and assignment-group/agent metadata. Includes write tools
// for create_incident, update_ticket_status, add_work_note, and
// assign_ticket so multi-step ITSM workflows can be demonstrated with
// H-I-T-L confirmation.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "data");

// ── Types ─────────────────────────────────────────────────────────────────

type User = {
  id: string; employee_id: string; username: string; email: string;
  display_name: string; department: string;
  manager_id: string | null;
  groups: string[]; vip: boolean; active: boolean;
};
type Ticket = {
  id: string; number: string;
  type: "Incident" | "Request" | "Change";
  short_description: string; description: string;
  caller_id: string;
  assigned_to: string | null;
  assignment_group: string;
  category: string; subcategory: string;
  priority: "P1" | "P2" | "P3" | "P4";
  impact: "Low" | "Medium" | "High";
  urgency: "Low" | "Medium" | "High";
  state: "New" | "In Progress" | "On Hold" | "Resolved" | "Closed" | "Scheduled" | "Cancelled";
  opened_at: string; updated_at: string;
  resolved_at: string | null;
  sla_breach: boolean;
  ci_id: string | null;
  kb_article_ids: string[];
  tags: string[];
};
type WorkNote = {
  ticket_id: string;
  author_id: string;
  author_kind: "agent" | "user" | "system";
  at: string;
  visibility: "internal" | "public";
  text: string;
};
type KbArticle = {
  id: string; title: string; category: string; summary: string;
  tags: string[]; updated_at: string;
};
type CmdbItem = {
  id: string; name: string; type: string; environment: string;
  owner_group: string; status: string; depends_on: string[];
};
type Agent = {
  id: string; name: string; email: string; group: string; shift: string;
};

// ── Load fixtures into mutable in-memory store ────────────────────────────

const load = <T>(file: string): T =>
  JSON.parse(readFileSync(path.join(dataDir, file), "utf-8")) as T;

const users:     User[]      = load("users.json");
const tickets:   Ticket[]    = load("tickets.json");
const workNotes: WorkNote[]  = load("work_notes.json");
const kbArticles:KbArticle[] = load("kb_articles.json");
const cmdb:      CmdbItem[]  = load("cmdb.json");
const agents:    Agent[]     = load("agents.json");

let nextIncSeq = 9000;

// ── Helpers ───────────────────────────────────────────────────────────────

const text = (obj: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }],
});
const notFound = (kind: string, id: string) => ({
  content: [{ type: "text" as const, text: JSON.stringify({ error: "not_found", kind, id }) }],
  isError: true,
});

const now = () => new Date().toISOString();

// ── Server ────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "servicenow-mcp-server",
  version: "0.1.0",
});

// ── Users ─────────────────────────────────────────────────────────────────

server.registerTool(
  "servicenow_search_users_by_name",
  {
    title: "Search ServiceNow users by name",
    description:
      "Case-insensitive substring match on display name, username, or email. " +
      "Use to resolve a person before pulling their tickets or asking for their access.",
    inputSchema: { query: z.string().min(1).describe("Substring to match.") },
  },
  async ({ query }) => {
    const q = query.toLowerCase();
    const matches = users.filter((u) =>
      u.display_name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
    return text({ matches, total: matches.length });
  }
);

server.registerTool(
  "servicenow_get_user",
  {
    title: "Get one ServiceNow user",
    description:
      "Fetch a user by id including their employee_id (cross-references workday-mcp-server), " +
      "department, manager, and AAD/Entra groups. Surfaces the vip flag.",
    inputSchema: { user_id: z.string().describe("User id, e.g. USR-2001.") },
  },
  async ({ user_id }) => {
    const u = users.find((x) => x.id === user_id);
    return u ? text(u) : notFound("user", user_id);
  }
);

// ── Tickets — read ────────────────────────────────────────────────────────

server.registerTool(
  "servicenow_list_tickets",
  {
    title: "List tickets with filters",
    description:
      "List incidents, requests, or changes. Combine filters to scope: by caller (the user who " +
      "raised it), assignee (the agent it's on), assignment_group (the queue), state, priority, " +
      "or VIP-only. Returns up to `limit` records (default 25).",
    inputSchema: {
      type: z.enum(["Incident", "Request", "Change"]).optional(),
      caller_id: z.string().optional().describe("USR-* id."),
      assigned_to: z.string().optional().describe("AGT-* id."),
      assignment_group: z.string().optional().describe("e.g. 'Identity & Access', 'Network'."),
      state: z.enum(["New", "In Progress", "On Hold", "Resolved", "Closed", "Scheduled", "Cancelled"]).optional(),
      priority: z.enum(["P1", "P2", "P3", "P4"]).optional(),
      vip_only: z.boolean().optional().describe("If true, only tickets raised by VIP callers."),
      limit: z.number().int().min(1).max(100).optional(),
    },
  },
  async ({ type, caller_id, assigned_to, assignment_group, state, priority, vip_only, limit }) => {
    let pool = tickets;
    if (type) pool = pool.filter((t) => t.type === type);
    if (caller_id) pool = pool.filter((t) => t.caller_id === caller_id);
    if (assigned_to) pool = pool.filter((t) => t.assigned_to === assigned_to);
    if (assignment_group) pool = pool.filter((t) => t.assignment_group === assignment_group);
    if (state) pool = pool.filter((t) => t.state === state);
    if (priority) pool = pool.filter((t) => t.priority === priority);
    if (vip_only) {
      const vipIds = new Set(users.filter((u) => u.vip).map((u) => u.id));
      pool = pool.filter((t) => vipIds.has(t.caller_id));
    }
    // Newest first
    pool = [...pool].sort((a, b) => b.opened_at.localeCompare(a.opened_at));
    return text({ tickets: pool.slice(0, limit ?? 25), total: pool.length });
  }
);

server.registerTool(
  "servicenow_get_ticket",
  {
    title: "Get one ticket",
    description:
      "Fetch a ticket by id including all metadata (description, CI, KB links, SLA breach flag). " +
      "Use `servicenow_list_work_notes` to get the conversation history.",
    inputSchema: { ticket_id: z.string().describe("Ticket id, e.g. INC-7001 or REQ-8002.") },
  },
  async ({ ticket_id }) => {
    const t = tickets.find((x) => x.id === ticket_id);
    return t ? text(t) : notFound("ticket", ticket_id);
  }
);

server.registerTool(
  "servicenow_list_work_notes",
  {
    title: "List work notes for a ticket",
    description:
      "Return the chronological work-note history (agent + user comments) for a ticket. " +
      "Includes both internal notes and public-facing comments.",
    inputSchema: {
      ticket_id: z.string(),
      include_internal: z.boolean().optional().describe("Default true."),
    },
  },
  async ({ ticket_id, include_internal }) => {
    const includeInt = include_internal ?? true;
    let notes = workNotes.filter((n) => n.ticket_id === ticket_id);
    if (!includeInt) notes = notes.filter((n) => n.visibility !== "internal");
    notes = [...notes].sort((a, b) => a.at.localeCompare(b.at));
    return text({ notes, total: notes.length });
  }
);

// ── Tickets — write ───────────────────────────────────────────────────────

server.registerTool(
  "servicenow_create_incident",
  {
    title: "Create a new incident",
    description:
      "Create a new incident ticket. Returns the seeded INC-* id. The agent should " +
      "ALWAYS show the user the draft + confirm via ask_user before calling this tool.",
    inputSchema: {
      caller_id: z.string().describe("USR-* id of the user reporting the issue."),
      short_description: z.string().min(3).max(200),
      description: z.string().min(3),
      category: z.string().describe("e.g. 'Access', 'Network', 'Hardware', 'Email'."),
      subcategory: z.string(),
      priority: z.enum(["P1", "P2", "P3", "P4"]).default("P3"),
      impact: z.enum(["Low", "Medium", "High"]).default("Medium"),
      urgency: z.enum(["Low", "Medium", "High"]).default("Medium"),
      assignment_group: z.string().describe("Queue name, e.g. 'Identity & Access', 'Endpoint'."),
      ci_id: z.string().optional().describe("CMDB CI id, if known."),
    },
  },
  async (args) => {
    const caller = users.find((u) => u.id === args.caller_id);
    if (!caller) return notFound("caller", args.caller_id);
    const seq = ++nextIncSeq;
    const ticket: Ticket = {
      id: `INC-${seq}`,
      number: `INC${String(seq).padStart(7, "0")}`,
      type: "Incident",
      short_description: args.short_description,
      description: args.description,
      caller_id: args.caller_id,
      assigned_to: null,
      assignment_group: args.assignment_group,
      category: args.category,
      subcategory: args.subcategory,
      priority: args.priority,
      impact: args.impact,
      urgency: args.urgency,
      state: "New",
      opened_at: now(),
      updated_at: now(),
      resolved_at: null,
      sla_breach: false,
      ci_id: args.ci_id ?? null,
      kb_article_ids: [],
      tags: [],
    };
    tickets.push(ticket);
    return text({ ok: true, created: ticket });
  }
);

server.registerTool(
  "servicenow_update_ticket_state",
  {
    title: "Update a ticket's state",
    description:
      "Transition a ticket between states (e.g. New → In Progress, In Progress → Resolved). " +
      "If transitioning to Resolved, sets resolved_at. The agent should confirm with the user " +
      "before calling this tool.",
    inputSchema: {
      ticket_id: z.string(),
      new_state: z.enum(["New", "In Progress", "On Hold", "Resolved", "Closed", "Scheduled", "Cancelled"]),
      reason: z.string().optional().describe("Note shown to the user when state changes."),
    },
  },
  async ({ ticket_id, new_state, reason }) => {
    const t = tickets.find((x) => x.id === ticket_id);
    if (!t) return notFound("ticket", ticket_id);
    const previous = t.state;
    t.state = new_state;
    t.updated_at = now();
    if (new_state === "Resolved" || new_state === "Closed") {
      t.resolved_at = now();
    }
    if (reason) {
      workNotes.push({
        ticket_id, author_id: "AGT-AUTO", author_kind: "system", at: now(),
        visibility: "internal", text: `State change ${previous} → ${new_state}: ${reason}`,
      });
    }
    return text({ ok: true, ticket: t });
  }
);

server.registerTool(
  "servicenow_assign_ticket",
  {
    title: "Assign a ticket to an agent",
    description: "Assign a ticket to a specific agent (AGT-* id) and optionally change the assignment group.",
    inputSchema: {
      ticket_id: z.string(),
      agent_id: z.string().describe("AGT-* id of the agent to assign to."),
      assignment_group: z.string().optional().describe("Optional override of the group."),
    },
  },
  async ({ ticket_id, agent_id, assignment_group }) => {
    const t = tickets.find((x) => x.id === ticket_id);
    if (!t) return notFound("ticket", ticket_id);
    const a = agents.find((x) => x.id === agent_id);
    if (!a) return notFound("agent", agent_id);
    t.assigned_to = agent_id;
    if (assignment_group) t.assignment_group = assignment_group;
    t.updated_at = now();
    return text({ ok: true, ticket: t });
  }
);

server.registerTool(
  "servicenow_add_work_note",
  {
    title: "Add a work note to a ticket",
    description:
      "Append a work note to a ticket. Use `visibility: \"public\"` for notes the user will see, " +
      "`internal` for agent-only notes. Agent should confirm with the user before adding public notes.",
    inputSchema: {
      ticket_id: z.string(),
      text: z.string().min(1),
      visibility: z.enum(["internal", "public"]).default("internal"),
      author_id: z.string().describe("AGT-* or USR-* id of the author."),
    },
  },
  async ({ ticket_id, text: noteText, visibility, author_id }) => {
    const t = tickets.find((x) => x.id === ticket_id);
    if (!t) return notFound("ticket", ticket_id);
    const note: WorkNote = {
      ticket_id, author_id,
      author_kind: author_id.startsWith("AGT-") ? "agent" : author_id.startsWith("USR-") ? "user" : "system",
      at: now(), visibility, text: noteText,
    };
    workNotes.push(note);
    t.updated_at = now();
    return text({ ok: true, note });
  }
);

// ── KB ────────────────────────────────────────────────────────────────────

server.registerTool(
  "servicenow_search_kb",
  {
    title: "Search the knowledge base",
    description:
      "Substring + tag search across KB articles. Use to find a fix or playbook before improvising. " +
      "Returns title + summary; pull the full article via `servicenow_get_kb_article`.",
    inputSchema: {
      query: z.string().describe("Substring to match against title, summary, and tags."),
      category: z.string().optional().describe("e.g. 'Access', 'Endpoint', 'Process'."),
    },
  },
  async ({ query, category }) => {
    const q = query.toLowerCase();
    let pool = kbArticles;
    if (category) pool = pool.filter((a) => a.category === category);
    const matches = pool.filter((a) =>
      a.title.toLowerCase().includes(q) ||
      a.summary.toLowerCase().includes(q) ||
      a.tags.some((t) => t.toLowerCase().includes(q))
    );
    return text({
      matches: matches.map((a) => ({ id: a.id, title: a.title, category: a.category, summary: a.summary, tags: a.tags })),
      total: matches.length,
    });
  }
);

server.registerTool(
  "servicenow_get_kb_article",
  {
    title: "Get one KB article",
    description: "Fetch a KB article by id with the full summary and metadata.",
    inputSchema: { article_id: z.string().describe("KB id, e.g. KB-200.") },
  },
  async ({ article_id }) => {
    const a = kbArticles.find((x) => x.id === article_id);
    return a ? text(a) : notFound("kb_article", article_id);
  }
);

// ── CMDB ──────────────────────────────────────────────────────────────────

server.registerTool(
  "servicenow_get_ci",
  {
    title: "Get one CMDB item",
    description:
      "Fetch a CI by id with its dependencies and current status. Use to understand impact when " +
      "a ticket references a CI (e.g. is the application degraded? what depends on it?).",
    inputSchema: { ci_id: z.string().describe("CI id, e.g. CI-WAP-CLE-03.") },
  },
  async ({ ci_id }) => {
    const c = cmdb.find((x) => x.id === ci_id);
    return c ? text(c) : notFound("ci", ci_id);
  }
);

// ── Boot ──────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
