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

function TokenBar({
  prompt,
  completion,
  total,
}: {
  prompt: number;
  completion: number;
  total: number;
}) {
  if (total === 0) return null;
  const promptPct = Math.round((prompt / total) * 100);
  const completionPct = 100 - promptPct;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-gray-500">
        <span>Token usage</span>
        <span className="font-mono font-medium text-gray-700">
          {total.toLocaleString()}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
        <div
          className="bg-indigo-400 transition-all duration-500"
          style={{ width: `${promptPct}%` }}
          title={`Prompt: ${prompt.toLocaleString()}`}
        />
        <div
          className="bg-emerald-400 transition-all duration-500"
          style={{ width: `${completionPct}%` }}
          title={`Completion: ${completion.toLocaleString()}`}
        />
      </div>
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
          Prompt{" "}
          <span className="font-mono text-gray-700">
            {prompt.toLocaleString()}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          Completion{" "}
          <span className="font-mono text-gray-700">
            {completion.toLocaleString()}
          </span>
        </span>
      </div>
    </div>
  );
}

function ToolCard({ tc }: { tc: ToolCallInfo }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails =
    (tc.input && tc.input !== "None" && tc.input !== "") ||
    (tc.output && tc.output !== "None" && tc.output !== "");
  const isRunning = tc.status === "started";
  const isFailed = tc.status === "failed";

  return (
    <div
      className={`rounded-lg border transition-all ${
        isRunning
          ? "border-blue-200 bg-blue-50/50"
          : isFailed
          ? "border-red-200 bg-red-50/30"
          : "border-gray-200 bg-white"
      }`}
    >
      <div
        className={`flex items-center gap-2.5 px-3 py-2 ${
          hasDetails ? "cursor-pointer" : ""
        }`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {/* Status icon */}
        {isRunning ? (
          <div className="relative flex-shrink-0">
            <div className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
          </div>
        ) : isFailed ? (
          <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-3 h-3 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-3 h-3 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}

        {/* Tool name */}
        <span className="font-mono text-xs font-semibold text-gray-800 tracking-tight">
          {tc.skillName}
        </span>

        {/* Duration badge */}
        {!isRunning && tc.durationMs !== undefined && tc.durationMs > 0 && (
          <span className="ml-auto text-xs font-mono text-gray-400">
            {formatDuration(tc.durationMs)}
          </span>
        )}

        {/* Running indicator */}
        {isRunning && (
          <span className="ml-auto text-xs text-blue-500 font-medium animate-pulse">
            running
          </span>
        )}

        {/* Expand chevron */}
        {hasDetails && !isRunning && (
          <svg
            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-3 py-2 space-y-2">
          {tc.input && tc.input !== "None" && tc.input !== "" && (
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
                Input
              </div>
              <pre className="text-xs bg-gray-50 rounded-md p-2 whitespace-pre-wrap break-all text-gray-700 max-h-32 overflow-y-auto font-mono">
                {tc.input}
              </pre>
            </div>
          )}
          {tc.output && tc.output !== "None" && tc.output !== "" && (
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
                Output
              </div>
              <pre className="text-xs bg-gray-50 rounded-md p-2 whitespace-pre-wrap break-all text-gray-700 max-h-32 overflow-y-auto font-mono">
                {tc.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ThoughtChain({
  thoughts,
  toolCalls,
  isStreaming,
  runStats,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const hasContent = thoughts.length > 0 || toolCalls.length > 0 || runStats;
  if (!hasContent) return null;

  const completedTools = toolCalls.filter((t) => t.status === "completed").length;
  const totalTools = toolCalls.length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden text-sm">
      {/* Header bar */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
      >
        {isStreaming ? (
          <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin flex-shrink-0" />
        ) : (
          <svg
            className="w-4 h-4 text-indigo-500 flex-shrink-0"
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
        )}
        <span className="font-medium text-gray-700 text-xs">
          {isStreaming ? "Agent executing…" : "Execution details"}
        </span>

        {/* Summary badges in header */}
        <div className="ml-auto flex items-center gap-2">
          {totalTools > 0 && (
            <span className="text-xs text-gray-400 font-mono">
              {completedTools}/{totalTools} tools
            </span>
          )}
          {runStats && !isStreaming && (
            <span className="text-xs text-gray-400 font-mono">
              {formatDuration(runStats.totalDurationMs)}
            </span>
          )}
          {runStats && !isStreaming && runStats.totalTokens > 0 && (
            <span className="text-xs text-gray-400 font-mono">
              {runStats.totalTokens.toLocaleString()} tok
            </span>
          )}
          <svg
            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
              collapsed ? "" : "rotate-90"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 py-3 space-y-3">
          {/* Agent reasoning */}
          {thoughts.length > 0 && (
            <div className="space-y-1">
              {thoughts.map((thought, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs text-gray-600"
                >
                  <span className="text-indigo-400 mt-px flex-shrink-0">
                    &rsaquo;
                  </span>
                  <span>{thought}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tool calls timeline */}
          {toolCalls.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Tools
              </div>
              {toolCalls.map((tc, i) => (
                <ToolCard key={i} tc={tc} />
              ))}
            </div>
          )}

          {/* Performance metrics */}
          {runStats && !isStreaming && (
            <div className="space-y-3 border-t border-gray-100 pt-3">
              {/* Timing grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <MetricCell
                  label="Total time"
                  value={formatDuration(runStats.totalDurationMs)}
                  icon="clock"
                />
                {runStats.timeToFirstTokenMs > 0 && (
                  <MetricCell
                    label="First token"
                    value={formatDuration(runStats.timeToFirstTokenMs)}
                    icon="zap"
                  />
                )}
                {runStats.modelLatencyMs > 0 && (
                  <MetricCell
                    label="Model latency"
                    value={formatDuration(runStats.modelLatencyMs)}
                    icon="cpu"
                  />
                )}
                {runStats.totalToolCalls > 0 && (
                  <MetricCell
                    label="Tool calls"
                    value={String(runStats.totalToolCalls)}
                    icon="tool"
                  />
                )}
              </div>

              {/* Token usage bar */}
              {runStats.totalTokens > 0 && (
                <TokenBar
                  prompt={runStats.promptTokens}
                  completion={runStats.completionTokens}
                  total={runStats.totalTokens}
                />
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
