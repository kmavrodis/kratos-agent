"use client";

import { ToolCallInfo } from "@/types";

interface Props {
  thoughts: string[];
  toolCalls: ToolCallInfo[];
}

export function ThoughtChain({ thoughts, toolCalls }: Props) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <svg
          className="w-4 h-4 text-amber-600 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="font-medium text-amber-800">Agent thinking...</span>
      </div>

      {/* Thoughts */}
      {thoughts.length > 0 && (
        <ul className="space-y-1 mb-2">
          {thoughts.map((thought, i) => (
            <li key={i} className="text-amber-700 flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">→</span>
              {thought}
            </li>
          ))}
        </ul>
      )}

      {/* Tool calls */}
      {toolCalls.length > 0 && (
        <div className="space-y-1 border-t border-amber-200 pt-2 mt-2">
          {toolCalls.map((tc, i) => (
            <div key={i} className="flex items-center gap-2 text-amber-700">
              {tc.status === "started" ? (
                <svg
                  className="w-3 h-3 animate-spin text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : tc.status === "completed" ? (
                <svg
                  className="w-3 h-3 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-3 h-3 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
              <span className="font-mono text-xs">{tc.skillName}</span>
              {tc.status === "completed" && tc.durationMs !== undefined && (
                <span className="text-xs text-amber-500">
                  ({tc.durationMs}ms)
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
