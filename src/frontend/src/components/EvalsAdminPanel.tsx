"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listEvalScenarios,
  upsertEvalScenario,
  deleteEvalScenario,
  startEvalRun,
  listEvalRuns,
  getEvalRun,
} from "@/lib/api";
import type { EvalScenario, EvalRun, EvalRunStatus, ScenarioResult } from "@/types";
import { GenerateScenariosModal } from "./GenerateScenariosModal";

interface Props {
  useCase: string;
}

const ACTIVE_STATUSES: EvalRunStatus[] = ["pending", "invoking", "scoring"];
const ALL_EVALUATORS = ["task_adherence", "tool_selection", "response_quality", "safety"];
const FOUNDRY_PORTAL_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_FOUNDRY_PORTAL_URL) ||
  "https://ai.azure.com";

const categoryColors: Record<string, string> = {
  standard: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
  edge_case: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
  error_handling: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20",
  boundary: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20",
  compliance: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
};

const statusConfig: Record<EvalRunStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400" },
  invoking: { label: "Running", color: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400" },
  scoring: { label: "Scoring", color: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400" },
  completed: { label: "Completed", color: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" },
  failed: { label: "Failed", color: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400" },
};

function computeOverallScore(run: EvalRun): string {
  if (run.foundry?.per_testing_criteria_results && run.foundry.per_testing_criteria_results.length > 0) {
    const criteria = run.foundry.per_testing_criteria_results as Array<Record<string, unknown>>;
    const rates = criteria.map((c) => {
      const pass = typeof c.pass === "number" ? c.pass : 0;
      const total = (typeof c.pass === "number" ? c.pass : 0) + (typeof c.fail === "number" ? c.fail : 0);
      return total > 0 ? pass / total : 0;
    });
    if (rates.length > 0) {
      const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
      return `${Math.round(avg * 100)}%`;
    }
  }
  const total = run.results.length;
  const passed = run.results.filter((r) => r.status === "pass" || r.status === "passed").length;
  if (total === 0) return "—";
  return `${passed}/${total}`;
}

function ScenarioResultRow({ result }: { result: ScenarioResult }) {
  const [expanded, setExpanded] = useState(false);

  const scoreEntries = Object.entries(result.scores ?? {});

  return (
    <div className="border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100/80 dark:hover:bg-white/[0.04] transition-colors text-left"
      >
        <span className={`flex-shrink-0 w-2 h-2 rounded-full ${result.status === "pass" || result.status === "passed" ? "bg-emerald-500" : result.status === "fail" || result.status === "failed" ? "bg-red-400" : "bg-slate-400"}`} />
        <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{result.scenario}</span>
        {result.duration_ms > 0 && (
          <span className="text-xs text-slate-400 font-mono flex-shrink-0">{result.duration_ms}ms</span>
        )}
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 py-4 space-y-3 border-t border-slate-100 dark:border-white/[0.04]">
          {result.error && (
            <div className="px-3 py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs rounded-lg font-mono">{result.error}</div>
          )}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Query</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-white/[0.03] rounded-lg px-3 py-2">{result.query}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Response</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-white/[0.03] rounded-lg px-3 py-2 whitespace-pre-wrap max-h-40 overflow-y-auto">{result.response}</p>
          </div>
          {result.tool_calls.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tool Calls</p>
              <div className="space-y-1.5">
                {result.tool_calls.map((tc, i) => (
                  <div key={i} className="flex items-start gap-2 bg-slate-50 dark:bg-white/[0.03] rounded-lg px-3 py-2">
                    <span className="text-xs font-mono font-medium text-primary-600 dark:text-primary-400 flex-shrink-0">{tc.name}</span>
                    {tc.arguments && (
                      <span className="text-xs text-slate-500 font-mono truncate">{JSON.stringify(tc.arguments)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {scoreEntries.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Scores</p>
              <div className="grid grid-cols-2 gap-2">
                {scoreEntries.map(([criterion, score]) => {
                  const scoreObj = score as Record<string, unknown>;
                  const passed = scoreObj.passed ?? scoreObj.result ?? scoreObj.score;
                  return (
                    <div key={criterion} className="flex items-center justify-between bg-slate-50 dark:bg-white/[0.03] rounded-lg px-3 py-1.5">
                      <span className="text-xs text-slate-600 dark:text-slate-400">{criterion}</span>
                      <span className={`text-xs font-medium ${passed === true || passed === "pass" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                        {String(passed)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface EditScenarioModalProps {
  scenario: EvalScenario;
  onSave: (updated: EvalScenario) => void;
  onClose: () => void;
}

function EditScenarioModal({ scenario, onSave, onClose }: EditScenarioModalProps) {
  const [draft, setDraft] = useState<EvalScenario>({ ...scenario });

  const update = (patch: Partial<EvalScenario>) => setDraft((d) => ({ ...d, ...patch }));

  const toggleEvaluator = (ev: string) => {
    setDraft((d) => ({
      ...d,
      evaluators: d.evaluators.includes(ev)
        ? d.evaluators.filter((e) => e !== ev)
        : [...d.evaluators, ev],
    }));
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-navy-900 rounded-2xl shadow-glass-lg max-w-xl w-full border border-slate-200/50 dark:border-white/[0.08] animate-slide-up flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] flex-shrink-0">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Edit Scenario</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Name</label>
            <input type="text" value={draft.name} onChange={(e) => update({ name: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
            <select value={draft.category} onChange={(e) => update({ category: e.target.value as EvalScenario["category"] })} className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all">
              {["standard", "edge_case", "error_handling", "boundary", "compliance"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Input Message</label>
            <textarea value={draft.input_message} onChange={(e) => update({ input_message: e.target.value })} rows={3} className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Expected Behavior</label>
            <textarea value={draft.expected_behavior} onChange={(e) => update({ expected_behavior: e.target.value })} rows={3} className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Expected Tool Calls <span className="text-slate-400 font-normal text-xs">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={draft.expected_tool_calls.join(", ")}
              onChange={(e) => update({ expected_tool_calls: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              placeholder="search_documents, get_user_info"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Evaluators</label>
            <div className="flex flex-wrap gap-2">
              {ALL_EVALUATORS.map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => toggleEvaluator(ev)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    draft.evaluators.includes(ev)
                      ? "bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 border-primary-200 dark:border-primary-500/30"
                      : "bg-slate-50 dark:bg-white/[0.04] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/[0.08] hover:border-slate-300"
                  }`}
                >
                  {ev}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-white/[0.06] flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all font-medium">Cancel</button>
          <button onClick={() => onSave(draft)} className="px-4 py-2 text-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all shadow-sm font-medium">Save Changes</button>
        </div>
      </div>
    </div>
  );
}

export function EvalsAdminPanel({ useCase }: Props): JSX.Element {
  const [scenarios, setScenarios] = useState<EvalScenario[]>([]);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [latestRun, setLatestRun] = useState<EvalRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [runError, setRunError] = useState("");
  const [runningValidation, setRunningValidation] = useState(false);
  const [runningFoundry, setRunningFoundry] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [editingScenario, setEditingScenario] = useState<EvalScenario | null>(null);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [scenarioList, runList] = await Promise.all([
        listEvalScenarios(useCase),
        listEvalRuns(useCase),
      ]);
      setScenarios(scenarioList);
      setRuns(runList);
      if (runList.length > 0) {
        const latest = runList[0];
        setLatestRun(latest);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load eval data");
    } finally {
      setLoading(false);
    }
  }, [useCase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const startPolling = useCallback((runId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const run = await getEvalRun(useCase, runId);
        setLatestRun(run);
        setRuns((prev) => {
          const idx = prev.findIndex((r) => r.run_id === run.run_id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = run;
            return updated;
          }
          return [run, ...prev];
        });
        if (!ACTIVE_STATUSES.includes(run.status)) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        // ignore poll errors
      }
    }, 10000);
  }, [useCase]);

  useEffect(() => {
    if (latestRun && ACTIVE_STATUSES.includes(latestRun.status)) {
      startPolling(latestRun.run_id);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [latestRun?.run_id, latestRun?.status, startPolling]);

  const handleRunValidation = async () => {
    setRunningValidation(true);
    setRunError("");
    try {
      const run = await startEvalRun(useCase, { mode: "validation", scenarios: [] });
      setLatestRun(run);
      setRuns((prev) => [run, ...prev]);
      startPolling(run.run_id);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to start validation run");
    } finally {
      setRunningValidation(false);
    }
  };

  const handleRunFoundry = async () => {
    setRunningFoundry(true);
    setRunError("");
    try {
      const run = await startEvalRun(useCase, { mode: "foundry", scenarios: [] });
      setLatestRun(run);
      setRuns((prev) => [run, ...prev]);
      startPolling(run.run_id);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to start Foundry eval run");
    } finally {
      setRunningFoundry(false);
    }
  };

  const handleDeleteScenario = async (name: string) => {
    try {
      await deleteEvalScenario(useCase, name);
      setScenarios((prev) => prev.filter((s) => s.name !== name));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete scenario");
    }
  };

  const handleSaveScenario = async (updated: EvalScenario) => {
    try {
      const saved = await upsertEvalScenario(useCase, updated);
      setScenarios((prev) => {
        const idx = prev.findIndex((s) => s.name === saved.name);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });
      setEditingScenario(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save scenario");
    }
  };

  const foundryUrl = latestRun?.foundry?.report_url || FOUNDRY_PORTAL_URL;

  const criteriaResults = latestRun?.foundry?.per_testing_criteria_results as Array<Record<string, unknown>> | undefined;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all shadow-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          Generate Scenarios
        </button>

        <button
          onClick={handleRunValidation}
          disabled={runningValidation || runningFoundry}
          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {runningValidation ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400/30 border-t-slate-500" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
          )}
          Run Validation
        </button>

        <button
          onClick={handleRunFoundry}
          disabled={runningValidation || runningFoundry || scenarios.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          title={scenarios.length === 0 ? "Add scenarios first" : undefined}
        >
          {runningFoundry ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400/30 border-t-slate-500" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          )}
          Run AI Foundry Evals
        </button>

        <a
          href={foundryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          Open in Foundry
        </a>
      </div>

      {/* Error banners */}
      {error && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-500/20 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 transition-colors ml-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
      {runError && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-500/20 flex items-center justify-between">
          <span>{runError}</span>
          <button onClick={() => setRunError("")} className="text-red-400 hover:text-red-600 transition-colors ml-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-200 border-t-primary-600" />
        </div>
      )}

      {!loading && (
        <>
          {/* Scenarios section */}
          <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/[0.06]">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
                Scenarios
              </h3>
              <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-full">
                {scenarios.length}
              </span>
            </div>

            {scenarios.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500/10 to-cyan-500/10 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">No scenarios yet</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed mb-4">
                  Generate AI-powered eval scenarios to validate your agent&apos;s behavior against expected outcomes.
                </p>
                <button
                  onClick={() => setShowGenerateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all shadow-sm font-medium"
                >
                  Generate Scenarios
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {scenarios.map((scenario) => (
                  <div key={scenario.name} className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-800 dark:text-white truncate">{scenario.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${categoryColors[scenario.category] ?? categoryColors.standard}`}>
                          {scenario.category}
                        </span>
                      </div>
                      {scenario.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{scenario.description}</p>
                      )}
                      {scenario.expected_tool_calls.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {scenario.expected_tool_calls.map((tc) => (
                            <span key={tc} className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 rounded font-mono">
                              {tc}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setEditingScenario(scenario)}
                        className="p-1.5 text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-all"
                        title="Edit"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteScenario(scenario.name)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Latest run */}
          {latestRun && (
            <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Latest Run</h3>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusConfig[latestRun.status].color}`}>
                    {statusConfig[latestRun.status].label}
                    {ACTIVE_STATUSES.includes(latestRun.status) && (
                      <span className="ml-1 inline-block animate-spin">⟳</span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-full uppercase font-medium">{latestRun.mode}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{computeOverallScore(latestRun)}</span>
                  <span className="text-xs text-slate-400">{new Date(latestRun.created_at).toLocaleString()}</span>
                </div>
              </div>

              {latestRun.progress && (
                <div className="px-5 py-2 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-white/[0.04] bg-slate-50/50 dark:bg-white/[0.01]">
                  {latestRun.progress}
                </div>
              )}

              {latestRun.error && (
                <div className="px-5 py-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-b border-red-100 dark:border-red-500/20">
                  {latestRun.error}
                </div>
              )}

              {/* Per-criterion chart */}
              {criteriaResults && criteriaResults.length > 0 && (
                <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] space-y-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">By Criterion</h4>
                  {criteriaResults.map((c, idx) => {
                    const name = String(c.criterion ?? c.name ?? `Criterion ${idx + 1}`);
                    const pass = typeof c.pass === "number" ? c.pass : 0;
                    const fail = typeof c.fail === "number" ? c.fail : 0;
                    const total = pass + fail;
                    const rate = total > 0 ? pass / total : 0;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 dark:text-slate-400 font-medium">{name}</span>
                          <span className="text-slate-500 font-mono">{pass}/{total} ({Math.round(rate * 100)}%)</span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${rate * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Per-sample results */}
              {latestRun.results.length > 0 && (
                <div className="px-5 py-4 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Samples ({latestRun.results.length})
                  </h4>
                  {latestRun.results.map((result, idx) => (
                    <ScenarioResultRow key={`${result.scenario}-${idx}`} result={result} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recent runs */}
          {runs.length > 1 && (
            <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06]">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Recent Runs</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {runs.slice(1).map((run) => (
                  <button
                    key={run.run_id}
                    onClick={() => setLatestRun(run)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors text-left"
                  >
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig[run.status].color}`}>
                      {statusConfig[run.status].label}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-medium bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-full">{run.mode}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 flex-1 text-right">{new Date(run.created_at).toLocaleString()}</span>
                    <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Expanded result row fallback */}
          {expandedResult && <div className="hidden">{expandedResult}</div>}
        </>
      )}

      {/* Modals */}
      <GenerateScenariosModal
        useCase={useCase}
        open={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerated={(newScenarios) => {
          setScenarios((prev) => {
            const names = new Set(newScenarios.map((s) => s.name));
            return [...prev.filter((s) => !names.has(s.name)), ...newScenarios];
          });
        }}
      />

      {editingScenario && (
        <EditScenarioModal
          scenario={editingScenario}
          onSave={handleSaveScenario}
          onClose={() => setEditingScenario(null)}
        />
      )}
    </div>
  );
}
