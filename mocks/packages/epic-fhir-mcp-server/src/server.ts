#!/usr/bin/env node
// epic-fhir-mcp-server — stdio MCP server that mocks an Epic-style EHR with
// FHIR R4-aligned resource names. Covers patients, practitioners, encounters,
// conditions, medications, observations (vitals + labs), and allergies. This
// server is intentionally read-only — write operations to a patient chart
// (e.g. ordering meds, signing notes) are out of scope for the visit-prep
// use-case and will live in a separate MCP / persona when needed.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "data");

type Patient = {
  id: string; mrn: string; first_name: string; last_name: string;
  date_of_birth: string; sex: "F" | "M" | "X";
  primary_care_physician_id: string;
  preferred_phone: string; preferred_language: string;
  address_city: string; address_state: string;
  insurer: string; active: boolean; deceased: boolean;
};
type Practitioner = {
  id: string; name: string; specialty: string; npi: string;
  department: string; email: string;
};
type Encounter = {
  id: string; patient_id: string; practitioner_id: string;
  type: string;
  status: "Planned" | "Arrived" | "In Progress" | "Finished" | "Cancelled" | "Booked";
  start: string; end: string;
  reason_text: string; location: string;
};
type Condition = {
  id: string; patient_id: string; code: string; display: string;
  clinical_status: "active" | "remission" | "resolved" | "inactive";
  onset_date: string;
  category: "problem-list-item" | "encounter-diagnosis";
};
type Medication = {
  id: string; patient_id: string; display: string; rxnorm: string;
  status: "active" | "completed" | "stopped" | "on-hold";
  start_date: string; end_date?: string;
  prescriber_id: string; indication: string;
};
type Observation = {
  id: string; patient_id: string; encounter_id: string | null;
  code: string; display: string; value: string; unit: string;
  interpretation: string; effective_at: string;
};
type Allergy = {
  id: string; patient_id: string; substance: string; reaction: string;
  severity: "mild" | "moderate" | "severe"; noted_date: string;
};

const load = <T>(file: string): T =>
  JSON.parse(readFileSync(path.join(dataDir, file), "utf-8")) as T;

const patients:      Patient[]      = load("patients.json");
const practitioners: Practitioner[] = load("practitioners.json");
const encounters:    Encounter[]    = load("encounters.json");
const conditions:    Condition[]    = load("conditions.json");
const medications:   Medication[]   = load("medications.json");
const observations:  Observation[]  = load("observations.json");
const allergies:     Allergy[]      = load("allergies.json");

const text = (obj: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }],
});
const notFound = (kind: string, id: string) => ({
  content: [{ type: "text" as const, text: JSON.stringify({ error: "not_found", kind, id }) }],
  isError: true,
});

const server = new McpServer({
  name: "epic-fhir-mcp-server",
  version: "0.1.0",
});

// ── Patients ──────────────────────────────────────────────────────────────

server.registerTool(
  "epic_search_patients_by_name",
  {
    title: "Search patients by name",
    description: "Case-insensitive substring match on first/last name + MRN.",
    inputSchema: { query: z.string().min(1).describe("Substring to match.") },
  },
  async ({ query }) => {
    const q = query.toLowerCase();
    const matches = patients.filter((p) =>
      p.first_name.toLowerCase().includes(q) ||
      p.last_name.toLowerCase().includes(q) ||
      p.mrn.toLowerCase().includes(q)
    );
    return text({ matches, total: matches.length });
  }
);

server.registerTool(
  "epic_get_patient",
  {
    title: "Get one patient",
    description:
      "Fetch a patient by id including MRN, primary care physician, insurer, and " +
      "preferred language. Use after a name search.",
    inputSchema: { patient_id: z.string().describe("Patient id, e.g. PAT-100001.") },
  },
  async ({ patient_id }) => {
    const p = patients.find((x) => x.id === patient_id);
    return p ? text(p) : notFound("patient", patient_id);
  }
);

// ── Practitioners ─────────────────────────────────────────────────────────

server.registerTool(
  "epic_get_practitioner",
  {
    title: "Get one practitioner",
    description: "Fetch a practitioner by id (e.g. for resolving a primary care physician).",
    inputSchema: { practitioner_id: z.string().describe("Practitioner id, e.g. PRA-9001.") },
  },
  async ({ practitioner_id }) => {
    const p = practitioners.find((x) => x.id === practitioner_id);
    return p ? text(p) : notFound("practitioner", practitioner_id);
  }
);

server.registerTool(
  "epic_list_practitioner_schedule",
  {
    title: "List a practitioner's appointments for a date range",
    description:
      "Return booked / planned / finished encounters for a practitioner across a date range. " +
      "Use to pull the day's clinic schedule.",
    inputSchema: {
      practitioner_id: z.string(),
      from_date: z.string().describe("ISO date inclusive."),
      to_date: z.string().describe("ISO date inclusive."),
      status: z.enum(["Planned", "Arrived", "In Progress", "Finished", "Cancelled", "Booked"]).optional(),
    },
  },
  async ({ practitioner_id, from_date, to_date, status }) => {
    let pool = encounters.filter((e) =>
      e.practitioner_id === practitioner_id &&
      e.start.slice(0, 10) >= from_date &&
      e.start.slice(0, 10) <= to_date
    );
    if (status) pool = pool.filter((e) => e.status === status);
    pool = [...pool].sort((a, b) => a.start.localeCompare(b.start));
    return text({ encounters: pool, total: pool.length });
  }
);

// ── Encounters ────────────────────────────────────────────────────────────

server.registerTool(
  "epic_list_encounters_for_patient",
  {
    title: "List a patient's encounters",
    description:
      "Return encounters for a patient, newest first. Default limit 10. " +
      "Use to show 'last seen' history before a new visit.",
    inputSchema: {
      patient_id: z.string(),
      status: z.enum(["Planned", "Arrived", "In Progress", "Finished", "Cancelled", "Booked"]).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
  },
  async ({ patient_id, status, limit }) => {
    let pool = encounters.filter((e) => e.patient_id === patient_id);
    if (status) pool = pool.filter((e) => e.status === status);
    pool = [...pool].sort((a, b) => b.start.localeCompare(a.start));
    return text({ encounters: pool.slice(0, limit ?? 10), total: pool.length });
  }
);

server.registerTool(
  "epic_get_encounter",
  {
    title: "Get one encounter",
    description: "Fetch one encounter by id including reason text, location, and timing.",
    inputSchema: { encounter_id: z.string().describe("Encounter id, e.g. ENC-200001.") },
  },
  async ({ encounter_id }) => {
    const e = encounters.find((x) => x.id === encounter_id);
    return e ? text(e) : notFound("encounter", encounter_id);
  }
);

// ── Conditions ────────────────────────────────────────────────────────────

server.registerTool(
  "epic_list_conditions",
  {
    title: "List a patient's conditions (problem list + diagnoses)",
    description:
      "Return conditions for a patient. Defaults to active problem-list items; pass " +
      "include_resolved=true or category='encounter-diagnosis' to widen.",
    inputSchema: {
      patient_id: z.string(),
      include_resolved: z.boolean().optional().describe("Include resolved/inactive conditions. Default false."),
      category: z.enum(["problem-list-item", "encounter-diagnosis"]).optional(),
    },
  },
  async ({ patient_id, include_resolved, category }) => {
    let pool = conditions.filter((c) => c.patient_id === patient_id);
    if (!include_resolved) pool = pool.filter((c) => c.clinical_status === "active" || c.clinical_status === "remission");
    if (category) pool = pool.filter((c) => c.category === category);
    return text({ conditions: pool, total: pool.length });
  }
);

// ── Medications ───────────────────────────────────────────────────────────

server.registerTool(
  "epic_list_medications",
  {
    title: "List a patient's medications",
    description:
      "Return medications for a patient. Defaults to active only; pass status='all' " +
      "to include completed/stopped/on-hold.",
    inputSchema: {
      patient_id: z.string(),
      status: z.enum(["active", "completed", "stopped", "on-hold", "all"]).optional().default("active"),
    },
  },
  async ({ patient_id, status }) => {
    let pool = medications.filter((m) => m.patient_id === patient_id);
    if (status !== "all") pool = pool.filter((m) => m.status === status);
    return text({ medications: pool, total: pool.length });
  }
);

// ── Observations (vitals + labs) ──────────────────────────────────────────

server.registerTool(
  "epic_list_observations",
  {
    title: "List a patient's observations (vitals + labs)",
    description:
      "Return observations for a patient, newest first. Filter by code (e.g. 'A1C', 'BP', 'EGFR') " +
      "or by encounter. Default limit 25.",
    inputSchema: {
      patient_id: z.string(),
      code: z.string().optional().describe("e.g. 'A1C', 'BP', 'LDL', 'EGFR'."),
      encounter_id: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
  },
  async ({ patient_id, code, encounter_id, limit }) => {
    let pool = observations.filter((o) => o.patient_id === patient_id);
    if (code) pool = pool.filter((o) => o.code === code);
    if (encounter_id) pool = pool.filter((o) => o.encounter_id === encounter_id);
    pool = [...pool].sort((a, b) => b.effective_at.localeCompare(a.effective_at));
    return text({ observations: pool.slice(0, limit ?? 25), total: pool.length });
  }
);

// ── Allergies ─────────────────────────────────────────────────────────────

server.registerTool(
  "epic_list_allergies",
  {
    title: "List a patient's allergies",
    description: "Return allergies and intolerances for a patient, with severity and reaction.",
    inputSchema: { patient_id: z.string() },
  },
  async ({ patient_id }) => {
    const pool = allergies.filter((a) => a.patient_id === patient_id);
    return text({ allergies: pool, total: pool.length });
  }
);

// ── Boot ──────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
