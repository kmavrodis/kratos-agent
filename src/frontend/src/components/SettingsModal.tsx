"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AIServiceStatus {
  configured: boolean;
  aiServicesEndpoint: string;
  aiServicesModelDeployment: string;
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
    fetch(`${API_URL}/api/settings`)
      .then((res) => res.json())
      .then((data: AIServiceStatus) => {
        setStatus(data);
        setEndpoint(data.aiServicesEndpoint || "");
        setModel(data.aiServicesModelDeployment || "gpt-52");
      })
      .catch(() => {
        setStatus(null);
      });
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiServicesEndpoint: endpoint,
          aiServicesModelDeployment: model,
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            AI Service Configuration
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500">
            View and update the Azure OpenAI endpoint and model deployment. Authentication uses Managed Identity — no API keys needed.
          </p>

          {/* Status indicator */}
          {status && (
            <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
              status.configured
                ? "bg-green-50 text-green-700"
                : "bg-amber-50 text-amber-700"
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                status.configured ? "bg-green-500" : "bg-amber-500"
              }`} />
              {status.configured ? "Endpoint configured" : "No endpoint configured"}
            </div>
          )}

          {/* AI Services Endpoint */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AI Services Endpoint
            </label>
            <input
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://your-resource.openai.azure.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Model Deployment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model Deployment
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-52"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Message */}
          {message && (
            <p className={`text-sm ${message.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
              {message}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
