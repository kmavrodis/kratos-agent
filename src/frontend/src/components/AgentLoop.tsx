"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/* ─── Step data ──────────────────────────────────────────────────── */

interface Step {
  id: number;
  label: string;
  title: string;
  source: string;
  description: string;
  detail: string;
  icon: React.ReactNode;
  layer: "you" | "kratos" | "sdk" | "azure";
  isLoop?: boolean;
  visualization: React.ReactNode;
}

/* Layer colors use theme-stable Tailwind hues for the 4-way differentiation
   plus the semantic `accent` token for the Kratos layer so it picks up the
   active theme. Chrome (modal, borders, text) uses semantic tokens. */
const LAYER_COLORS = {
  you: {
    dot:   "bg-cyan-500",
    badge: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    ring:  "ring-cyan-500/30",
    text:  "text-cyan-600 dark:text-cyan-400",
  },
  kratos: {
    dot:   "bg-accent",
    badge: "bg-accent-soft text-accent border-accent/20",
    ring:  "ring-accent/30",
    text:  "text-accent",
  },
  sdk: {
    dot:   "bg-violet-500",
    badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    ring:  "ring-violet-500/30",
    text:  "text-violet-600 dark:text-violet-400",
  },
  azure: {
    dot:   "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    ring:  "ring-emerald-500/30",
    text:  "text-emerald-600 dark:text-emerald-400",
  },
} as const;

const LAYER_LABELS: Record<string, string> = {
  you:    "You",
  kratos: "Kratos",
  sdk:    "Copilot SDK",
  azure:  "Azure",
};

/* Loop step indices (0-indexed): steps 7 (Plan), 8 (Act), 9 (Loop) */
const LOOP_START = 6;
const LOOP_END = 8;

/* ─── Visualizations ─────────────────────────────────────────────── */

function VizSdkStack() {
  return (
    <div className="rounded-xl bg-surface-2 border border-border-soft p-5" role="img" aria-label="SDK stack diagram">
      <div className="space-y-2">
        <div className="rounded-lg bg-surface border border-border px-4 py-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-0.5">Your app</div>
          <div className="text-sm font-semibold text-text-strong">Kratos</div>
          <div className="text-[11px] text-muted mt-0.5">Persona, skills, connectors, UI</div>
        </div>
        <div className="flex justify-center text-muted text-lg leading-none">↓</div>
        <div className="rounded-lg bg-violet-500/10 border border-violet-500/30 px-4 py-3 text-center ring-1 ring-violet-500/20">
          <div className="text-[10px] uppercase tracking-wider text-violet-600 dark:text-violet-400 font-semibold mb-0.5">The harness</div>
          <div className="text-sm font-semibold text-text-strong">GitHub Copilot SDK</div>
          <div className="text-[11px] text-muted mt-0.5">Sessions, tool calling, streaming, retries</div>
        </div>
        <div className="flex justify-center text-muted text-lg leading-none">↓</div>
        <div className="rounded-lg bg-surface border border-border px-4 py-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-0.5">Built into the SDK</div>
          <div className="text-sm font-semibold text-text-strong">Tool calls · Session memory · Streaming · Model routing</div>
        </div>
      </div>
    </div>
  );
}

function VizPersonas() {
  const personas = [
    { name: "Wealth advisor", prompt: "Portfolio review, market data, email drafting", tint: "from-emerald-500/15 to-emerald-500/5", border: "border-emerald-500/30" },
    { name: "Retail banker",  prompt: "Customer lookup, account support, next best action", tint: "from-cyan-500/15 to-cyan-500/5",       border: "border-cyan-500/30" },
    { name: "Clinician",      prompt: "Patient context, FHIR data, visit preparation", tint: "from-violet-500/15 to-violet-500/5",   border: "border-violet-500/30" },
  ];
  return (
    <div className="rounded-xl bg-surface-2 border border-border-soft p-5" role="img" aria-label="Three personas converging on one engine">
      <div className="grid grid-cols-3 gap-2 mb-3">
        {personas.map((p) => (
          <div key={p.name} className={`rounded-lg bg-gradient-to-br ${p.tint} border ${p.border} px-2.5 py-2.5`}>
            <div className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1">Persona bundle</div>
            <div className="text-[12px] font-semibold text-text-strong mb-1.5">{p.name}</div>
            <div className="text-[10.5px] text-text leading-snug mb-2">{p.prompt}</div>
            <div className="flex flex-wrap gap-1">
              {['prompt', 'skills', 'MCP'].map((part) => (
                <span key={part} className="rounded bg-surface/70 border border-border-soft px-1.5 py-0.5 text-[9px] text-muted">
                  {part}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="relative h-6">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden>
          <path d="M 50 0 L 150 22" stroke="currentColor" className="text-border" strokeWidth="1" fill="none" />
          <path d="M 150 0 L 150 22" stroke="currentColor" className="text-border" strokeWidth="1" fill="none" />
          <path d="M 250 0 L 150 22" stroke="currentColor" className="text-border" strokeWidth="1" fill="none" />
        </svg>
      </div>
      <div className="flex justify-center">
        <div className="rounded-lg bg-accent-soft border border-accent/30 px-4 py-2">
          <div className="text-[10px] uppercase tracking-wider text-accent font-semibold">Kratos engine</div>
          <div className="text-[11px] text-text">One hosted agent switching personas</div>
        </div>
      </div>
    </div>
  );
}

function VizSkillsMenu() {
  const skills = [
    { name: "web-search",      desc: "search the web" },
    { name: "rag-search",      desc: "search company docs" },
    { name: "data-analysis",   desc: "run Python on data", active: true },
    { name: "email-draft",     desc: "draft an email" },
    { name: "portfolio-review", desc: "pull a client's holdings" },
    { name: "pdf-report",      desc: "generate a PDF" },
  ];
  return (
    <div className="rounded-xl bg-surface-2 border border-border-soft p-5" role="img" aria-label="Skills menu with one expanded">
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-2">The skill menu the model sees</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3">
        {skills.map((s) => (
          <div
            key={s.name}
            className={`rounded-lg border px-2 py-1.5 text-[11px] ${
              s.active
                ? "bg-accent-soft border-accent/40 text-accent ring-1 ring-accent/20"
                : "bg-surface border-border text-text"
            }`}
          >
            <div className="font-semibold">{s.name}</div>
            <div className="text-[10px] text-muted">{s.desc}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-surface border border-accent/40 p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-accent font-semibold">Loaded on demand</span>
          <span className="text-[10px] text-muted">data-analysis · SKILL.md</span>
        </div>
        <div className="text-[11px] text-text leading-relaxed font-mono">
          # Data analysis<br />
          Use this skill when the user wants you to compute<br />
          metrics over a spreadsheet or table.<br />
          <span className="text-muted">Inputs: file path, the question.</span><br />
          <span className="text-muted">Returns: numbers and a short summary.</span>
        </div>
      </div>
    </div>
  );
}

function VizConnectors() {
  const systems = ["Salesforce", "SAP S/4", "Epic", "ServiceNow", "Workday"];
  return (
    <div className="rounded-xl bg-surface-2 border border-border-soft p-5" role="img" aria-label="MCP connectors to enterprise systems">
      <div className="flex justify-center mb-2">
        <div className="rounded-lg bg-accent-soft border border-accent/30 px-3 py-1.5 text-center">
          <div className="text-[10px] uppercase tracking-wider text-accent font-semibold">A skill</div>
          <div className="text-[11px] text-text">portfolio-review</div>
        </div>
      </div>
      <div className="flex justify-center text-muted text-base leading-none mb-2">↓</div>
      <div className="rounded-lg bg-violet-500/10 border border-violet-500/30 px-3 py-2 mb-2 text-center">
        <div className="text-[10px] uppercase tracking-wider text-violet-600 dark:text-violet-400 font-semibold">Model Context Protocol</div>
        <div className="text-[11px] text-text">Open standard for connecting agents to systems</div>
      </div>
      <div className="flex justify-center text-muted text-base leading-none mb-2">↓</div>
      <div className="grid grid-cols-5 gap-1">
        {systems.map((s) => (
          <div key={s} className="rounded-lg bg-surface border border-border px-1.5 py-1.5 text-center">
            <div className="text-[10px] font-semibold text-text-strong truncate">{s}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[10px] text-muted text-center">Mocked for the demo · swap for real in production</div>
    </div>
  );
}

function VizAskInput() {
  return (
    <div className="rounded-xl bg-surface-2 border border-border-soft p-5" role="img" aria-label="Chat input with attachment">
      <div className="rounded-xl bg-surface border border-border p-3">
        <div className="text-[13px] text-text-strong mb-2">Review my client&rsquo;s Q4 portfolio and draft an email summarising it for them.</div>
        <div className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 border border-border-soft px-2 py-1 text-[11px] text-text">
          <svg className="w-3 h-3 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
          </svg>
          <span className="text-muted">portfolio_q4.xlsx</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse-slow" />
        <span>Streaming connection opens · stays open until the agent is done</span>
      </div>
    </div>
  );
}

function VizSession() {
  return (
    <div className="rounded-xl bg-surface-2 border border-border-soft p-5" role="img" aria-label="Session continuity across turns">
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-3">The same conversation, four turns apart</div>
      <div className="relative">
        <div className="absolute left-0 right-0 top-3 h-[2px] bg-border" />
        <div className="absolute left-0 top-3 h-[2px] bg-gradient-to-r from-violet-500 to-violet-400" style={{ width: "100%" }} />
        <div className="relative flex justify-between">
          {[
            { day: "Mon", label: "First turn" },
            { day: "Mon", label: "Reply" },
            { day: "Tue", label: "Reload page" },
            { day: "Tue", label: "Pick up here", active: true },
          ].map((t, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                t.active
                  ? "bg-violet-500 border-violet-500 text-white"
                  : "bg-surface border-violet-400 text-violet-500"
              }`}>
                {i + 1}
              </div>
              <div className="mt-1.5 text-[10px] text-text-strong font-semibold">{t.day}</div>
              <div className="text-[10px] text-muted">{t.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 text-[11px] text-text bg-surface border border-border rounded-lg px-3 py-2">
        Same context · no replay · no re-sending history
      </div>
    </div>
  );
}

function VizPlan() {
  return (
    <div className="rounded-xl bg-surface-2 border border-border-soft p-5" role="img" aria-label="Model planning which skill to use">
      <div className="flex items-center justify-center mb-3">
        <div className="rounded-lg bg-violet-500/10 border border-violet-500/30 px-3 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-violet-600 dark:text-violet-400 font-semibold">Plan</div>
          <div className="text-[11px] text-text">&ldquo;I&rsquo;ll need real portfolio data for this.&rdquo;</div>
        </div>
      </div>
      <div className="flex justify-center text-muted text-base leading-none mb-2">↓</div>
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { name: "web-search",       active: false },
          { name: "portfolio-review", active: true },
          { name: "email-draft",      active: false },
        ].map((s) => (
          <div
            key={s.name}
            className={`rounded-lg border px-2 py-1.5 text-center text-[11px] ${
              s.active
                ? "bg-accent-soft border-accent/40 text-accent ring-1 ring-accent/30 font-semibold"
                : "bg-surface border-border text-muted"
            }`}
          >
            {s.name}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-accent font-semibold">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Calling portfolio-review
      </div>
    </div>
  );
}

function VizAct() {
  return (
    <div className="rounded-xl bg-surface-2 border border-border-soft p-5" role="img" aria-label="Skill executing against real data">
      <div className="rounded-lg bg-surface border border-accent/40 p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-text-strong">portfolio-review</span>
          </div>
          <span className="text-[10px] text-muted">running</span>
        </div>
        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full" style={{ width: "100%" }} />
        </div>
        <div className="mt-2 text-[10.5px] text-muted">Fetching positions from the wealth platform…</div>
      </div>
      <div className="rounded-lg bg-surface border border-border p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-2">Returned</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] text-muted">Return</div>
            <div className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">+12.4%</div>
          </div>
          <div>
            <div className="text-[10px] text-muted">Sharpe</div>
            <div className="text-[13px] font-semibold text-text-strong">1.82</div>
          </div>
          <div>
            <div className="text-[10px] text-muted">Drawdown</div>
            <div className="text-[13px] font-semibold text-danger-500">−6.1%</div>
          </div>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-muted text-center">Real call · traced in Azure Monitor · 1.2s</div>
    </div>
  );
}

function VizLoop() {
  const iterations = [
    { n: 1, action: "portfolio-review",  result: "Got the positions" },
    { n: 2, action: "web-search",        result: "Got the benchmark" },
    { n: 3, action: "email-draft",       result: "Drafted the email" },
  ];
  return (
    <div className="rounded-xl bg-surface-2 border border-border-soft p-5" role="img" aria-label="The agent loop">
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-3 text-center">Three passes through the loop</div>
      <div className="space-y-2">
        {iterations.map((it, i) => (
          <div key={it.n} className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-[10px] font-bold text-violet-600 dark:text-violet-400">
              {it.n}
            </div>
            <div className="flex-1 grid grid-cols-3 gap-1.5 items-center">
              <div className="rounded-md bg-violet-500/10 border border-violet-500/30 px-2 py-1 text-[10.5px] text-center text-violet-600 dark:text-violet-400 font-semibold">Model thinks</div>
              <div className="rounded-md bg-accent-soft border border-accent/30 px-2 py-1 text-[10.5px] text-center text-accent font-semibold truncate">{it.action}</div>
              <div className="rounded-md bg-surface border border-border px-2 py-1 text-[10.5px] text-center text-text truncate">{it.result}</div>
            </div>
            {i < iterations.length - 1 ? (
              <svg className="w-4 h-4 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.012 4.356v4.992" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-[11px] text-text-strong text-center">
        Final answer ready · loop exits
      </div>
    </div>
  );
}

function VizAnswer() {
  return (
    <div className="rounded-xl bg-surface-2 border border-border-soft p-5" role="img" aria-label="Live event stream and answer">
      <div className="space-y-1.5 mb-3">
        {[
          { type: "thought",  text: "Checking the portfolio data…",       tone: "text-violet-600 dark:text-violet-400 bg-violet-500/5" },
          { type: "tool",     text: "portfolio-review · done in 1.2s",    tone: "text-accent bg-accent-soft" },
          { type: "thought",  text: "Comparing against the benchmark…",   tone: "text-violet-600 dark:text-violet-400 bg-violet-500/5" },
          { type: "tool",     text: "web-search · done in 0.8s",          tone: "text-accent bg-accent-soft" },
          { type: "content",  text: "Drafting the email now…",            tone: "text-cyan-600 dark:text-cyan-400 bg-cyan-500/5" },
        ].map((e, i) => (
          <div key={i} className={`flex items-center gap-2 rounded-md px-2 py-1 text-[10.5px] ${e.tone}`}>
            <span className="font-semibold uppercase tracking-wider text-[9px] min-w-[44px]">{e.type}</span>
            <span className="truncate">{e.text}</span>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-surface border border-border p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">The answer, rendering live</div>
        <div className="text-[12px] text-text-strong font-semibold mb-1">Q4 portfolio summary</div>
        <div className="text-[11.5px] text-text leading-relaxed">
          Your portfolio returned <span className="font-semibold text-emerald-600 dark:text-emerald-400">+12.4%</span> in Q4, beating the benchmark by 2.1 points…
        </div>
      </div>
    </div>
  );
}

function VizAudit() {
  return (
    <div className="rounded-xl bg-surface-2 border border-border-soft p-5" role="img" aria-label="Persistence, tracing, and cost recording">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-surface border border-border p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold mb-1">Cosmos DB</div>
          <div className="text-[11px] font-semibold text-text-strong">Every message saved</div>
          <div className="mt-2 inline-flex items-center gap-1 text-emerald-500 text-[10px]">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            before &amp; after every turn
          </div>
        </div>
        <div className="rounded-lg bg-surface border border-border p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold mb-1">Foundry traces</div>
          <div className="text-[11px] font-semibold text-text-strong">Every skill call logged</div>
          <div className="mt-2 inline-flex items-center gap-1 text-emerald-500 text-[10px]">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            inputs · outputs · timing
          </div>
        </div>
        <div className="rounded-lg bg-surface border border-border p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold mb-1">App Insights</div>
          <div className="text-[11px] font-semibold text-text-strong">Every token counted</div>
          <div className="mt-2 inline-flex items-center gap-1 text-emerald-500 text-[10px]">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            per turn · per conversation
          </div>
        </div>
      </div>
      <div className="mt-3 text-[11px] text-text text-center">
        Compliance can replay any conversation. Finance can itemise every run.
      </div>
    </div>
  );
}

/* ─── Icons ──────────────────────────────────────────────────────── */

const Icons = {
  sdk: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
    </svg>
  ),
  persona: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
  skills: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.34-3.08a.75.75 0 010-1.298l5.34-3.08a2.25 2.25 0 012.16 0l5.34 3.08a.75.75 0 010 1.298l-5.34 3.08a2.25 2.25 0 01-2.16 0zM4.5 14.25l7.5 4.33 7.5-4.33" />
    </svg>
  ),
  connect: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  ),
  ask: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.671 1.09-.086 2.17-.207 3.238-.364 1.584-.233 2.707-1.627 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  ),
  session: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  plan: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
    </svg>
  ),
  act: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
    </svg>
  ),
  loop: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.012 4.356v4.992" />
    </svg>
  ),
  answer: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
    </svg>
  ),
  audit: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

/* ─── Steps ──────────────────────────────────────────────────────── */

const STEPS: Step[] = [
  {
    id: 1,
    label: "SDK",
    title: "GitHub Copilot SDK",
    source: "The agent harness underneath Kratos",
    icon: Icons.sdk,
    layer: "sdk",
    visualization: <VizSdkStack />,
    description:
      "Kratos does not talk to the model directly. It runs on top of the GitHub Copilot SDK, the same harness that powers GitHub Copilot itself.",
    detail:
      "A harness is the boring but critical layer between an app and the model. It manages the conversation, lets the model call tools, streams the answer back token by token, retries when things fail, and keeps a session alive across turns. We could have written all of that ourselves. We have done it before. It is hundreds of pages of code that breaks every time a new model ships. Kratos hands the whole thing to the SDK and spends its engineering on what makes the agent useful: the persona, the skills, and the connectors into your real systems.",
  },
  {
    id: 2,
    label: "Persona",
    title: "One hosted agent, many personas",
    source: "Prompt, skills, and MCP connections per use-case",
    icon: Icons.persona,
    layer: "kratos",
    visualization: <VizPersonas />,
    description:
      "A persona is not only a system prompt. It is the prompt, the subset of skills, and the MCP connections that belong to a business role.",
    detail:
      "In this demo, all of those personas run on one hosted Kratos agent. Switch the persona and the agent gets a different prompt, a different skill menu, and different connectors to the systems that matter for that use case. For production, we would usually advise a separate Kratos agent per business use case, because ownership, security boundaries, release schedules, and compliance reviews are cleaner that way. The demo uses one host so you can see the pattern without deploying the same app eight times.",
  },
  {
    id: 3,
    label: "Skills",
    title: "Skills",
    source: "A library of things the agent can do",
    icon: Icons.skills,
    layer: "kratos",
    visualization: <VizSkillsMenu />,
    description:
      "A skill is a thing the agent knows how to do: search the web, run code, summarise a document, draft an email, look up a customer's portfolio.",
    detail:
      "Every skill is a small markdown file that describes when to use it, plus a backing function that does the work. The model never sees all of them at once. It sees a short menu of skill names and one-line descriptions and picks which one to load. Only the chosen skill's full instructions and code are pulled into the conversation. This matters for two reasons. The model stays focused, because it is not drowning in capabilities it does not need this turn. And the bill stays sensible, because you only pay for the context you actually use.",
  },
  {
    id: 4,
    label: "MCP",
    title: "MCP connectors",
    source: "MCP servers in front of Salesforce, SAP, Epic, ServiceNow, Workday",
    icon: Icons.connect,
    layer: "kratos",
    visualization: <VizConnectors />,
    description:
      "Skills can reach into the systems your business actually runs on: CRM, ERP, EHR, core banking, ticketing, HR.",
    detail:
      "The mechanism is MCP, the Model Context Protocol. It is an open standard for letting an agent talk to a backend system in a structured way. Kratos ships with mocks for the big ones (Salesforce, SAP S/4, Epic FHIR, ServiceNow, Workday, a core banking sample) so the demo runs without real credentials. In production you swap the mock for the real connector and the agent does not know the difference.",
  },
  {
    id: 5,
    label: "Ask",
    title: "You ask the agent",
    source: "The chat input in your browser",
    icon: Icons.ask,
    layer: "you",
    visualization: <VizAskInput />,
    description:
      "You type a question. You can attach a file: a spreadsheet, a PDF, an image.",
    detail:
      "Nothing magical at this step. The browser sends the message to Kratos over a streaming connection that stays open for the rest of the turn. Anything the agent does — thinking, calling skills, writing the answer — can flow back to your screen as it happens, instead of arriving in one block at the end.",
  },
  {
    id: 6,
    label: "Session",
    title: "The SDK picks up the conversation",
    source: "Copilot SDK session",
    icon: Icons.session,
    layer: "sdk",
    visualization: <VizSession />,
    description:
      "Kratos hands the message to the Copilot SDK, which resumes the existing conversation if there is one and loads the persona and skill menu for this use-case.",
    detail:
      "A session is the SDK's idea of an ongoing conversation. It remembers what the agent said three turns ago. It knows which skills are available. It tracks the running token cost. If you reload the browser tomorrow and pick up the same conversation, the session resumes from where you left off rather than starting over.",
  },
  {
    id: 7,
    label: "Plan",
    title: "The model plans the next action",
    source: "Copilot SDK",
    icon: Icons.plan,
    layer: "sdk",
    isLoop: true,
    visualization: <VizPlan />,
    description:
      "The model reads your question, scans the skill menu, and plans the next move: answer directly, call a skill, or ask for more information.",
    detail:
      "Ask \"what is a Sharpe ratio\" and the model can answer directly. Ask \"what is the Sharpe ratio of my Q4 portfolio\" and it cannot guess. It needs data. So it selects the skill that fits (portfolio-review, data-analysis, web-search, whichever is right for the task) and asks the SDK to run it. This is the moment where \"chat with an LLM\" turns into \"agent doing work\".",
  },
  {
    id: 8,
    label: "Act",
    title: "The skill runs against real data",
    source: "Kratos backend",
    icon: Icons.act,
    layer: "kratos",
    isLoop: true,
    visualization: <VizAct />,
    description:
      "The chosen skill executes: querying a system, running Python, retrieving a document, calling an API.",
    detail:
      "This is where Kratos does the real work. If the skill is portfolio-review, it pulls the customer's positions from the wealth platform. If it is code-interpreter, it runs Python in a sandbox. If it is web-search, it goes out to Bing. Every call is traced. We know which skill ran, how long it took, what it returned, whether it failed. That trace shows up in Azure Monitor and in the live thought stream you see on the left of the chat.",
  },
  {
    id: 9,
    label: "Loop",
    title: "The agent loop",
    source: "Copilot SDK",
    icon: Icons.loop,
    layer: "sdk",
    isLoop: true,
    visualization: <VizLoop />,
    description:
      "The model reads the skill's result, thinks again, and decides what to do next: call another skill, refine the query, or write the final answer.",
    detail:
      "This is the agent loop. It is what makes Kratos an agent rather than a chatbot. A chatbot answers in one shot. An agent keeps going. Pull the portfolio. Look at it. Notice it underperformed the benchmark. Pull the benchmark data to confirm. Draft an email explaining the gap. Each step uses the result of the previous one. The loop ends when the model decides it has enough and writes a final answer for you. Most turns take two or three iterations. Hard ones take more.",
  },
  {
    id: 10,
    label: "Answer",
    title: "The answer streams to your screen",
    source: "Kratos backend → your browser",
    icon: Icons.answer,
    layer: "you",
    visualization: <VizAnswer />,
    description:
      "You see the agent's reasoning, the skills it calls, and its final answer as they happen, not after the whole turn is done.",
    detail:
      "Every event from inside the loop flows down the same open connection to your browser: a thought (\"checking the portfolio data\"), a tool call (\"portfolio-review started\"), a result (\"done in 1.2 seconds\"), the words of the answer as they are written. The thought chain on the left of the chat is not a replay. It is the live trace of what the agent is doing right now. If a skill takes 4 seconds, you watch it take 4 seconds. There is nowhere for the agent to hide.",
  },
  {
    id: 11,
    label: "Audit",
    title: "Persisted, traced, costed",
    source: "Cosmos DB · Foundry · Application Insights",
    icon: Icons.audit,
    layer: "azure",
    visualization: <VizAudit />,
    description:
      "Every message, every skill call, and every token is recorded. The conversation survives reloads, the audit trail survives compliance reviews, and the bill is itemised.",
    detail:
      "The full conversation is saved before and after every turn, so a crash or a reload never loses anything. Every skill invocation is logged with its inputs, outputs, and timing. Token usage is reported per turn and per conversation, so you know what each agent run actually costs. None of this requires bolt-on work. It is built into the SDK and the surrounding Azure services. If your compliance team asks how the agent behaved on a specific case six months ago, you can pull the full trace.",
  },
];

/* ─── Component ──────────────────────────────────────────────────── */

export default function AgentLoop({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = STEPS[activeStep];
  const colors = LAYER_COLORS[step.layer];

  const goTo = useCallback((i: number) => {
    setActiveStep(i);
  }, []);

  const play = useCallback(() => {
    if (isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    setActiveStep(0);
    let i = 0;
    timerRef.current = setInterval(() => {
      i++;
      if (i >= STEPS.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsPlaying(false);
        return;
      }
      setActiveStep(i);
    }, 3500);
  }, [isPlaying]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  useEffect(() => {
    if (open) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeStep, open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (isPlaying) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setActiveStep((s) => Math.min(s + 1, STEPS.length - 1));
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveStep((s) => Math.max(s - 1, 0));
      }
      if (e.key === " ") {
        e.preventDefault();
        play();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose, isPlaying, play]);

  useEffect(() => {
    if (!open && timerRef.current) {
      clearInterval(timerRef.current);
      setIsPlaying(false);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setActiveStep(0);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="relative w-full max-w-6xl mx-4 my-6 md:my-10 rounded-2xl border border-border bg-surface shadow-card" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-xl border border-border bg-surface-2 text-muted hover:text-text-strong hover:bg-hover transition-all"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-4 sm:px-6 md:px-10 py-8 md:py-12">
          {/* ── Header ── */}
          <div className="mb-8 md:mb-12 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-soft border border-accent/20 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow" />
              <span className="text-xs font-semibold text-accent tracking-wide uppercase">How it works</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-text-strong tracking-tight mb-3">
              From a question to an answer
            </h2>
            <p className="text-text text-base md:text-lg leading-relaxed">
              What is actually happening when you talk to Kratos, and why we built it on top of the GitHub Copilot SDK instead of from scratch.
            </p>
          </div>

          {/* ── Play / step counter ── */}
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={play}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface-2 text-text hover:bg-hover hover:text-text-strong transition-all text-xs font-semibold"
            >
              {isPlaying ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                  Pause
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 4.5v15a.5.5 0 00.77.42l12-7.5a.5.5 0 000-.84l-12-7.5A.5.5 0 005 4.5z" />
                  </svg>
                  Play through
                </>
              )}
            </button>
            <div className="text-xs text-muted font-mono">
              {String(activeStep + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
            </div>
          </div>

          {/* ── Timeline ── */}
          <div className="relative mb-12 md:mb-16">
            <div className="absolute left-0 right-0 top-6 h-[2px] bg-border rounded-full" />
            <div
              className="absolute left-0 top-6 h-[2px] rounded-full bg-accent transition-all duration-500 ease-out"
              style={{ width: `${(activeStep / (STEPS.length - 1)) * 100}%` }}
            />

            <div className="relative flex justify-between">
              {STEPS.map((s, i) => {
                const isActive = i === activeStep;
                const isPast = i < activeStep;
                const lc = LAYER_COLORS[s.layer];
                const inLoop = i >= LOOP_START && i <= LOOP_END;
                const isLoopActive = activeStep >= LOOP_START && activeStep <= LOOP_END;

                return (
                  <button
                    key={s.id}
                    onClick={() => !isPlaying && goTo(i)}
                    disabled={isPlaying}
                    className="flex flex-col items-center group outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
                    aria-label={`Step ${s.id}: ${s.title}`}
                    aria-current={isActive ? "step" : undefined}
                  >
                    <div
                      className={`
                        relative w-12 h-12 rounded-xl flex items-center justify-center
                        transition-all duration-300 border
                        ${isActive
                          ? `bg-surface-2 border-border shadow-card ring-2 ${lc.ring} scale-105`
                          : isPast
                          ? `bg-surface-2 border-border ${lc.text}`
                          : "bg-surface border-border-soft text-muted group-hover:border-border group-hover:shadow-card"
                        }
                      `}
                    >
                      <span className={isActive ? lc.text : ""}>
                        {isActive ? s.icon : (
                          <span className="text-xs font-bold">{s.id}</span>
                        )}
                      </span>
                    </div>
                    <span
                      className={`
                        mt-1.5 text-[11px] font-medium transition-colors whitespace-nowrap
                        ${isActive ? lc.text : "text-muted group-hover:text-text"}
                      `}
                    >
                      {s.label}
                    </span>
                    {inLoop && (
                      <div className="flex flex-col items-center mt-1.5">
                        <div className={`w-[2px] h-2 rounded-full transition-colors duration-300 ${
                          isLoopActive ? "bg-accent" : "bg-border"
                        }`} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Loop bracket */}
            {(() => {
              const total = STEPS.length;
              const leftPct = (LOOP_START / (total - 1)) * 100;
              const rightPct = (LOOP_END / (total - 1)) * 100;
              const widthPct = rightPct - leftPct;
              const isLoopActive = activeStep >= LOOP_START && activeStep <= LOOP_END;
              return (
                <div
                  className="absolute hidden md:block pointer-events-none"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%`, top: "calc(100% - 6px)" }}
                >
                  <svg className="w-full" viewBox="0 0 200 28" preserveAspectRatio="none" fill="none" aria-hidden>
                    <path
                      d="M 4 0 L 4 14 Q 4 22 12 22 L 188 22 Q 196 22 196 14 L 196 0"
                      stroke="currentColor"
                      className={`transition-colors duration-300 ${isLoopActive ? "text-accent" : "text-border"}`}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <path
                      d="M 1 6 L 4 0 L 7 6"
                      stroke="currentColor"
                      className={`transition-colors duration-300 ${isLoopActive ? "text-accent" : "text-border"}`}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                  <div className="flex items-center justify-center gap-1.5 -mt-0.5">
                    <svg className={`w-3 h-3 transition-colors duration-300 ${isLoopActive ? "text-accent" : "text-muted"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.012 4.356v4.992" />
                    </svg>
                    <span className={`text-[10px] font-bold tracking-wider uppercase transition-colors duration-300 ${isLoopActive ? "text-accent" : "text-muted"}`}>
                      The agent loop
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Detail card ── */}
          <div
            ref={cardRef}
            className="rounded-2xl border border-border bg-surface-2 shadow-card overflow-hidden animate-fade-in"
            key={activeStep}
          >
            <div className="h-1 bg-accent" />
            <div className="p-6 md:p-8">
              <div className="flex flex-wrap items-start gap-3 mb-4">
                <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border text-sm font-bold ${colors.badge}`}>
                  {step.id}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl md:text-2xl font-bold text-text-strong tracking-tight">
                    {step.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${colors.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                      {LAYER_LABELS[step.layer]}
                    </span>
                    <span className="text-border">·</span>
                    <span className="text-[11px] text-muted truncate">{step.source}</span>
                  </div>
                </div>
                {step.isLoop && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-accent-soft text-accent border border-accent/20">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.012 4.356v4.992" />
                    </svg>
                    In the loop
                  </span>
                )}
              </div>

              <p className="text-text text-sm md:text-[15px] leading-relaxed mb-5">
                {step.description}
              </p>

              <div className="mb-5">
                {step.visualization}
              </div>

              <p className="text-text-strong text-[14px] md:text-[15px] leading-relaxed">
                {step.detail}
              </p>
            </div>
          </div>

          {/* ── Nav arrows ── */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setActiveStep((s) => Math.max(s - 1, 0))}
              disabled={activeStep === 0 || isPlaying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-text hover:bg-hover hover:text-text-strong disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-semibold"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
            <span className="text-[11px] text-muted hidden md:inline">Tip: use ← → keys, or space to play through</span>
            <button
              onClick={() => setActiveStep((s) => Math.min(s + 1, STEPS.length - 1))}
              disabled={activeStep === STEPS.length - 1 || isPlaying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-text hover:bg-hover hover:text-text-strong disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-semibold"
            >
              Next
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
