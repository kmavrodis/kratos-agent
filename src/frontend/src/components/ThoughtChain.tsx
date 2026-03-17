"use client";

import { ToolCallInfo, RunStats } from "@/types";
import { useState } from "react";

interface Props {
  thoughts: string[];
  toolCalls: ToolCallInfo[];
  isStreaming?: boolean;
  runStats?: RunStats | null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

/** Extract real skill name from a generic "skill" tool event */
function resolveSkillName(tc: ToolCallInfo): string {
  if (tc.skillName !== "skill") return tc.skillName;
  // Try parsing from output: Skill "email-draft" loaded successfully
  const outputMatch = tc.output?.match(/Skill ["']([^"']+)["']/);
  if (outputMatch) return outputMatch[1];
  // Try parsing from input: name='email-draft' or "name": "email-draft"
  const inputMatch = tc.input?.match(/['"]?name['"]?\s*[:=]\s*['"]([^'"]+)['"]/);
  if (inputMatch) return inputMatch[1];
  return tc.skillName;
}

/** Pretty-print tool name: web_search → Web Search */
function prettyToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Colour palette for tool status badges */
const STATUS_COLORS = {
  started: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-400" },
  completed: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-400" },
  failed: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-400" },
} as const;

function ToolPill({ tc }: { tc: ToolCallInfo }) {
  const colors = STATUS_COLORS[tc.status] || STATUS_COLORS.completed;
  const isRunning = tc.status === "started";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {isRunning ? (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${colors.dot}`} />
        </span>
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      )}
      {prettyToolName(tc.skillName)}
      {!isRunning && tc.durationMs !== undefined && tc.durationMs > 0 && (
        <span className="opacity-60 font-mono text-[10px]">{formatDuration(tc.durationMs)}</span>
      )}
    </span>
  );
}

function ToolDetail({ tc }: { tc: ToolCallInfo }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails =
    (tc.input && tc.input !== "None" && tc.input !== "") ||
    (tc.output && tc.output !== "None" && tc.output !== "");

  if (!hasDetails) return null;

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/50 overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-mono text-xs text-gray-600">{tc.skillName}</span>
        <svg
          className={`w-3 h-3 text-gray-400 ml-auto transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {expanded && (
        <div className="border-t border-gray-100 px-3 py-2 space-y-2">
          {tc.input && tc.input !== "None" && tc.input !== "" && (
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Input</div>
              <pre className="text-xs bg-white rounded-md p-2 whitespace-pre-wrap break-all text-gray-700 max-h-32 overflow-y-auto font-mono border border-gray-100">
                {tc.input}
              </pre>
            </div>
          )}
          {tc.output && tc.output !== "None" && tc.output !== "" && (
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Output</div>
              <pre className="text-xs bg-white rounded-md p-2 whitespace-pre-wrap break-all text-gray-700 max-h-32 overflow-y-auto font-mono border border-gray-100">
                {tc.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TokenBar({
  prompt,
  completion,
  reasoning,
  total,
}: {
  prompt: number;
  completion: number;
  reasoning: number;
  total: number;
}) {
  if (total === 0) return null;
  const promptPct = Math.round((prompt / total) * 100);
  // Reasoning is a subset of completion, but show it as a third segment
  const reasoningPct = Math.round((reasoning / total) * 100);
  const outputPct = Math.max(0, Math.round(((completion - reasoning) / total) * 100));
  const remainPct = Math.max(0, 100 - promptPct - reasoningPct - outputPct);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-gray-500">
        <span>Token usage</span>
        <span className="font-mono font-medium text-gray-700">{total.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
        <div className="bg-indigo-400 transition-all duration-500" style={{ width: `${promptPct}%` }} title={`Prompt: ${prompt.toLocaleString()}`} />
        {reasoning > 0 && (
          <div className="bg-amber-400 transition-all duration-500" style={{ width: `${reasoningPct}%` }} title={`Reasoning: ${reasoning.toLocaleString()}`} />
        )}
        <div className="bg-emerald-400 transition-all duration-500" style={{ width: `${outputPct + remainPct}%` }} title={`Output: ${(completion - reasoning).toLocaleString()}`} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
          Prompt <span className="font-mono text-gray-700">{prompt.toLocaleString()}</span>
        </span>
        {reasoning > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            Reasoning <span className="font-mono text-gray-700">{reasoning.toLocaleString()}</span>
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          Output <span className="font-mono text-gray-700">{(completion - reasoning).toLocaleString()}</span>
        </span>
      </div>
    </div>
  );
}

export function ThoughtChain({
  thoughts,
  toolCalls,
  isStreaming,
  runStats,
}: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const hasContent = thoughts.length > 0 || toolCalls.length > 0 || runStats;
  if (!hasContent) return null;

  // Deduplicate: keep only the latest event per resolved tool name (completed overrides started)
  const toolMap = new Map<string, ToolCallInfo>();
  for (const tc of toolCalls) {
    const resolvedName = resolveSkillName(tc);
    const resolved = { ...tc, skillName: resolvedName };
    const existing = toolMap.get(resolvedName);
    if (!existing || tc.status !== "started") {
      toolMap.set(resolvedName, resolved);
    }
  }
  const uniqueTools = Array.from(toolMap.values());

  const completedTools = uniqueTools.filter((t) => t.status === "completed").length;
  const totalTools = uniqueTools.length;

  // Detailed tool calls (keep all events including duplicates for the detail view)
  const completedOrFailedCalls = toolCalls
    .filter((t) => t.status !== "started")
    .map((tc) => ({ ...tc, skillName: resolveSkillName(tc) }));

  return (
    <div className="space-y-2">
      {/* Tool pills — always visible */}
      {uniqueTools.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {isStreaming && (
            <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin flex-shrink-0" />
          )}
          {uniqueTools.map((tc, i) => (
            <ToolPill key={`${tc.skillName}-${i}`} tc={tc} />
          ))}
          {totalTools > 0 && !isStreaming && (
            <span className="text-xs text-gray-400 ml-1">
              {completedTools}/{totalTools} tools
            </span>
          )}
        </div>
      )}

      {/* Expandable details section */}
      {(completedOrFailedCalls.length > 0 || thoughts.length > 0 || (runStats && !isStreaming)) && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden text-sm">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <svg
              className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-medium text-gray-600 text-xs">Execution details</span>
            <svg
              className={`w-3.5 h-3.5 text-gray-400 ml-auto transition-transform ${showDetails ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {showDetails && (
            <div className="px-4 py-3 space-y-3">
              {/* Token bar + metrics */}
              {runStats && !isStreaming && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <MetricCell label="Total time" value={formatDuration(runStats.totalDurationMs)} icon="clock" />
                    {runStats.timeToFirstTokenMs > 0 && (
                      <MetricCell label="First token" value={formatDuration(runStats.timeToFirstTokenMs)} icon="zap" />
                    )}
                    {runStats.modelLatencyMs > 0 && (
                      <MetricCell label="Model latency" value={formatDuration(runStats.modelLatencyMs)} icon="cpu" />
                    )}
                    {runStats.totalToolCalls > 0 && (
                      <MetricCell label="Tool calls" value={String(runStats.totalToolCalls)} icon="tool" />
                    )}
                  </div>

                  {runStats.totalTokens > 0 && (
                    <TokenBar
                      prompt={runStats.promptTokens}
                      completion={runStats.completionTokens}
                      reasoning={runStats.reasoningTokens}
                      total={runStats.totalTokens}
                    />
                  )}
                </div>
              )}

              {/* Execution flow timeline */}
              {thoughts.length > 0 && (
                <div className="space-y-0.5">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Execution flow</div>
                  <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
                    {thoughts.map((thought, i) => (
                      <span key={i} className="inline-flex items-center gap-1">
                        {i > 0 && <span className="text-gray-300">&rarr;</span>}
                        <span className="text-gray-600">{thought}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tool call I/O details */}
              {completedOrFailedCalls.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Tool details</div>
                  {completedOrFailedCalls.map((tc, i) => (
                    <ToolDetail key={i} tc={tc} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCell({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: "clock" | "zap" | "cpu" | "tool";
}) {
  const iconSvg = {
    clock: (
      <svg
        className="w-3.5 h-3.5 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    zap: (
      <svg
        className="w-3.5 h-3.5 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
    cpu: (
      <svg
        className="w-3.5 h-3.5 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
    tool: (
      <svg
        className="w-3.5 h-3.5 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  };

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2 flex items-center gap-2">
      {iconSvg[icon]}
      <div>
        <div className="text-[10px] text-gray-400 leading-tight">{label}</div>
        <div className="text-sm font-mono font-semibold text-gray-800 leading-tight">
          {value}
        </div>
      </div>
    </div>
  );
}
