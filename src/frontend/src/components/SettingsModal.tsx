"use client";

import { useState, useEffect } from "react";

import { getApiUrl } from "@/lib/config";

interface AIServiceStatus {
  configured: boolean;
  foundryEndpoint: string;
  foundryModelDeployment: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: Props) {
  const [endpoint, setEndpoint] = useState("");
  const [model, setModel] = useState("gpt-52");
  const [status, setStatus] = useState<AIServiceStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Load current settings on open
  useEffect(() => {
    if (!open) return;
    fetch(`${getApiUrl()}/api/settings`)
      .then((res) => res.json())
      .then((data: AIServiceStatus) => {
        setStatus(data);
        setEndpoint(data.foundryEndpoint || "");
        setModel(data.foundryModelDeployment || "gpt-52");
      })
      .catch(() => {
        setStatus(null);
      });
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`${getApiUrl()}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foundryEndpoint: endpoint,
          foundryModelDeployment: model,
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data: AIServiceStatus = await res.json();
      setStatus(data);
      setMessage("Settings saved successfully!");
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-glass-lg max-w-lg w-full border border-slate-200/50 dark:border-white/[0.08] animate-slide-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-white/[0.08] dark:to-white/[0.04] flex items-center justify-center border border-slate-200 dark:border-white/[0.08]">
              <svg className="w-4.5 h-4.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">AI Service Configuration</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">Bring your own keys &amp; endpoints</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Configure the Microsoft Foundry endpoint and model deployment. Authentication uses Managed Identity — no API keys needed.
          </p>

          {/* Status indicator */}
          {status && (
            <div className={`flex items-center gap-2.5 text-sm px-4 py-2.5 rounded-xl ${
              status.configured
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-amber-50 text-amber-700 border border-amber-100"
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${
                status.configured ? "bg-emerald-500" : "bg-amber-500"
              }`} />
              <span className="font-medium">{status.configured ? "Endpoint configured" : "No endpoint configured"}</span>
            </div>
          )}

          {/* Foundry Endpoint */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Foundry Endpoint
            </label>
            <input
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://your-resource.services.ai.azure.com"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Model Deployment */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Model Deployment
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-52"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Message */}
          {message && (
            <div className={`text-sm px-4 py-2.5 rounded-xl ${message.startsWith("Error") ? "text-red-600 bg-red-50 border border-red-100" : "text-emerald-600 bg-emerald-50 border border-emerald-100"}`}>
              {message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.1] transition-all font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 text-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all disabled:opacity-50 font-medium shadow-sm"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
