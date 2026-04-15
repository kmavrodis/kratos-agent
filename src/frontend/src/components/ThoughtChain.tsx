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
  const outputMatch = tc.output?.match(/Skill ["']([^"']+)["']/);
  if (outputMatch) return outputMatch[1];
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
  started: { bg: "bg-primary-50", text: "text-primary-600", border: "border-primary-200", dot: "bg-primary-400" },
  completed: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", dot: "bg-emerald-400" },
  failed: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", dot: "bg-red-400" },
} as const;

function ToolPill({ tc }: { tc: ToolCallInfo }) {
  const colors = STATUS_COLORS[tc.status] || STATUS_COLORS.completed;
  const isRunning = tc.status === "started";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${colors.bg} ${colors.text} ${colors.border} transition-all duration-200`}
    >
      {isRunning ? (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-60" />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${colors.dot}`} />
        </span>
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      )}
      {prettyToolName(tc.skillName)}
      {!isRunning && tc.durationMs !== undefined && tc.durationMs > 0 && (
        <span className="opacity-50 font-mono text-[10px]">{formatDuration(tc.durationMs)}</span>
      )}
    </span>
  );
}

/** Clean up raw Python SDK output/input strings for display.
 *  - Strips Result(...) wrappers and extracts content field
 *  - Pretty-prints valid JSON
 *  - Converts Python-style dicts to readable key: value lines
 */
function formatToolText(raw: string): string {
  let text = raw.trim();

  // Strip Python Result(...) wrapper — extract the content field
const resultMatch = text.match(/^Result\(content=['"]([\s\S]*?)['"],\s*contents=/);
  if (resultMatch) {
    text = resultMatch[1];
    // Unescape Python string escapes
    text = text.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\'/g, "'").replace(/\\"/g, '"');
  }

  // If the remaining text is empty or "None", try extracting detailed_content
  if (!text || text === "None" || text === "null") {
    const detailedMatch = raw.match(/detailed_content=['"]([^'"]*)['"]/)
    if (detailedMatch && detailedMatch[1] && detailedMatch[1] !== "None") {
      text = detailedMatch[1].replace(/\\n/g, "\n").replace(/\\t/g, "\t");
    } else {
      return text || raw;
    }
  }

  // Try to parse as JSON and pretty-print
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null) {
      // For objects with a "text" field (common in web_search etc.), show just the text
      if (typeof parsed.text === "string") {
        return parsed.text;
      }
      return JSON.stringify(parsed, null, 2);
    }
  } catch {
    // Not JSON — continue
  }

  // Try to parse Python dict-like strings: {'key': 'value', ...}
  if (text.startsWith("{") && text.includes("':")) {
    try {
      // Convert Python-style to JSON-style: single quotes to double, True/False/None
      const jsonLike = text
        .replace(/'/g, '"')
        .replace(/\bTrue\b/g, "true")
        .replace(/\bFalse\b/g, "false")
        .replace(/\bNone\b/g, "null");
      const parsed = JSON.parse(jsonLike);
      if (typeof parsed === "object") {
        return JSON.stringify(parsed, null, 2);
      }
    } catch {
      // Not convertible — return as-is
    }
  }

  return text;
}

function ToolDetail({ tc }: { tc: ToolCallInfo }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails =
    (tc.input && tc.input !== "None" && tc.input !== "") ||
    (tc.output && tc.output !== "None" && tc.output !== "");

  if (!hasDetails) return null;

  const formattedInput = tc.input && tc.input !== "None" && tc.input !== "" ? formatToolText(tc.input) : null;
  const formattedOutput = tc.output && tc.output !== "None" && tc.output !== "" ? formatToolText(tc.output) : null;

  return (
    <div className="rounded-xl border border-slate-100 dark:border-white/[0.06] bg-white dark:bg-navy-800 overflow-hidden shadow-sm dark:shadow-none">
      <button
        className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-mono text-xs text-slate-500">{tc.skillName}</span>
        {tc.durationMs !== undefined && tc.durationMs > 0 && (
          <span className="text-[10px] text-slate-400 font-mono">{formatDuration(tc.durationMs)}</span>
        )}
        <svg
          className={`w-3 h-3 text-slate-400 ml-auto transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {expanded && (
        <div className="border-t border-slate-100 dark:border-white/[0.06] px-3.5 py-2.5 space-y-2.5">
          {formattedInput && (
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Input</div>
              <pre className="text-xs bg-slate-50 dark:bg-white/[0.04] rounded-lg p-2.5 whitespace-pre-wrap break-all text-slate-600 dark:text-slate-300 max-h-32 overflow-y-auto font-mono border border-slate-100 dark:border-white/[0.06]">
                {formattedInput}
              </pre>
            </div>
          )}
          {formattedOutput && (
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Output</div>
              <pre className="text-xs bg-slate-50 dark:bg-white/[0.04] rounded-lg p-2.5 whitespace-pre-wrap break-all text-slate-600 dark:text-slate-300 max-h-32 overflow-y-auto font-mono border border-slate-100 dark:border-white/[0.06]">
                {formattedOutput}
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
  const reasoningPct = Math.round((reasoning / total) * 100);
  const outputPct = Math.max(0, Math.round(((completion - reasoning) / total) * 100));
  const remainPct = Math.max(0, 100 - promptPct - reasoningPct - outputPct);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-slate-500">
        <span className="font-medium">Token usage</span>
        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{total.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden flex">
        <div className="bg-primary-400 transition-all duration-500 ease-out" style={{ width: `${promptPct}%` }} title={`Prompt: ${prompt.toLocaleString()}`} />
        {reasoning > 0 && (
          <div className="bg-amber-400 transition-all duration-500 ease-out" style={{ width: `${reasoningPct}%` }} title={`Reasoning: ${reasoning.toLocaleString()}`} />
        )}
        <div className="bg-emerald-400 transition-all duration-500 ease-out" style={{ width: `${outputPct + remainPct}%` }} title={`Output: ${(completion - reasoning).toLocaleString()}`} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-primary-400 inline-block" />
            Prompt <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">{prompt.toLocaleString()}</span>
        </span>
        {reasoning > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" />
            Reasoning <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">{reasoning.toLocaleString()}</span>
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" />
            Output <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">{(completion - reasoning).toLocaleString()}</span>
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

  // Deduplicate: keep only the latest event per resolved tool name
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

  return (
    <div className="space-y-2 animate-fade-in">
      {/* Tool pills — always visible */}
      {uniqueTools.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {isStreaming && (
            <div className="w-4 h-4 rounded-full border-2 border-primary-500 border-t-transparent animate-spin flex-shrink-0" />
          )}
          {uniqueTools.map((tc, i) => (
            <ToolPill key={`${tc.skillName}-${i}`} tc={tc} />
          ))}
          {totalTools > 0 && !isStreaming && (
            <span className="text-[11px] text-slate-400 ml-1 font-medium">
              {completedTools}/{totalTools} tools
            </span>
          )}
        </div>
      )}

      {/* Expandable details section */}
      {(uniqueTools.length > 0 || thoughts.length > 0 || (runStats && !isStreaming)) && (
        <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-navy-800 shadow-card dark:shadow-none overflow-hidden text-sm">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <svg
              className="w-3.5 h-3.5 text-primary-500 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-medium text-slate-600 dark:text-slate-300 text-xs">Execution details</span>
            <svg
              className={`w-3.5 h-3.5 text-slate-400 ml-auto transition-transform duration-200 ${showDetails ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {showDetails && (
            <div className="px-4 py-3 space-y-4 border-t border-slate-100 dark:border-white/[0.06]">
              {/* Token bar + metrics */}
              {runStats && !isStreaming && (
                <div className="space-y-3">
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
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Execution flow</div>
                  <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    {thoughts.map((thought, i) => (
                      <span key={i} className="inline-flex items-center gap-1">
                        {i > 0 && <span className="text-slate-300 dark:text-slate-600">&rarr;</span>}
                        <span className="text-slate-600 dark:text-slate-300">{thought}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tool call I/O details */}
              {uniqueTools.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tool details</div>
                  {uniqueTools.map((tc, i) => (
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
      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    zap: (
      <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    cpu: (
      <svg className="w-3.5 h-3.5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3M21 8.25h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3M21 15.75h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    tool: (
      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.58 5.58a2.121 2.121 0 01-3-3l5.58-5.58m4.24-4.24l2.12-2.12a2.121 2.121 0 013 3l-2.12 2.12M10.06 12.06L12 12m-1.94.06l4.24 4.24" />
      </svg>
    ),
  };

  return (
    <div className="rounded-xl border border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.03] px-3 py-2.5 flex items-center gap-2.5">
      {iconSvg[icon]}
      <div>
        <div className="text-[10px] text-slate-400 leading-tight font-medium">{label}</div>
        <div className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 leading-tight">
          {value}
        </div>
      </div>
    </div>
  );
}
