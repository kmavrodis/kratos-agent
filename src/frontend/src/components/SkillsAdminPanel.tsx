"use client";

import { useState, useEffect, useRef } from "react";
import { listSkills, createSkill, updateSkill, deleteSkill, getSystemPrompt, updateSystemPrompt, resetSystemPrompt, listSkillFiles, upsertSkillFile, deleteSkillFile, getMCPConfig, updateMCPConfig } from "@/lib/api";
import type { MCPConfig, Skill, SkillFile } from "@/types";

type Tab = "skills" | "prompt" | "mcp";

interface Props {
  open: boolean;
  onClose: () => void;
  useCase?: string;
}

export function SkillsAdminPanel({ open, onClose, useCase = "generic" }: Props) {
  const [tab, setTab] = useState<Tab>("skills");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // New skill form state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newInstructions, setNewInstructions] = useState("");

  // System prompt state
  const [promptContent, setPromptContent] = useState("");
  const [promptDraft, setPromptDraft] = useState("");
  const [promptIsDefault, setPromptIsDefault] = useState(true);
  const [promptDirty, setPromptDirty] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);

  // MCP servers state
  const [mcpServers, setMcpServers] = useState<Record<string, MCPConfig["servers"][string]>>({});
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpError, setMcpError] = useState("");
  const [editingMcp, setEditingMcp] = useState<{ name: string; config: MCPConfig["servers"][string] } | null>(null);
  const [showMcpCreate, setShowMcpCreate] = useState(false);

  // MCP create/edit form state
  const [mcpName, setMcpName] = useState("");
  const [mcpType, setMcpType] = useState<"local" | "http" | "sse">("local");
  const [mcpCommand, setMcpCommand] = useState("");
  const [mcpArgs, setMcpArgs] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpTools, setMcpTools] = useState("*");
  const [mcpEnv, setMcpEnv] = useState("");
  const [mcpCwd, setMcpCwd] = useState("");
  const [mcpHeaders, setMcpHeaders] = useState("");
  const [mcpTimeout, setMcpTimeout] = useState("");

  // Skill files state
  const [skillFiles, setSkillFiles] = useState<SkillFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadPath, setUploadPath] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSkills = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listSkills(useCase);
      setSkills(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skills");
    } finally {
      setLoading(false);
    }
  };

  const loadPrompt = async () => {
    setPromptLoading(true);
    setError("");
    try {
      const data = await getSystemPrompt();
      setPromptContent(data.content);
      setPromptDraft(data.content);
      setPromptIsDefault(data.isDefault);
      setPromptDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load system prompt");
    } finally {
      setPromptLoading(false);
    }
  };

  const loadMCPConfig = async () => {
    setMcpLoading(true);
    setMcpError("");
    try {
      const data = await getMCPConfig(useCase);
      setMcpServers(data.servers);
    } catch (err) {
      setMcpError(err instanceof Error ? err.message : "Failed to load MCP config");
    } finally {
      setMcpLoading(false);
    }
  };

  const resetMcpForm = () => {
    setMcpName(""); setMcpType("local"); setMcpCommand(""); setMcpArgs(""); setMcpUrl("");
    setMcpTools("*"); setMcpEnv(""); setMcpCwd(""); setMcpHeaders(""); setMcpTimeout("");
  };

  const populateMcpForm = (name: string, cfg: MCPConfig["servers"][string]) => {
    setMcpName(name);
    // Backward compat: old configs may have type "remote" — map to "http"
    const t = cfg.type === ("remote" as string) ? "http" : cfg.type;
    setMcpType(t as "local" | "http" | "sse");
    setMcpTools((cfg.tools ?? ["*"]).join(", "));
    if (cfg.type === "local") {
      setMcpCommand(cfg.command);
      setMcpArgs((cfg.args ?? []).join(", "));
      setMcpEnv(cfg.env ? Object.entries(cfg.env).map(([k,v]) => `${k}=${v}`).join("\n") : "");
      setMcpCwd(cfg.cwd ?? "");
      setMcpUrl(""); setMcpHeaders(""); setMcpTimeout("");
    } else {
      setMcpUrl(cfg.url);
      setMcpHeaders(cfg.headers ? Object.entries(cfg.headers).map(([k,v]) => `${k}: ${v}`).join("\n") : "");
      setMcpTimeout(cfg.timeout != null ? String(cfg.timeout) : "");
      setMcpCommand(""); setMcpArgs(""); setMcpEnv(""); setMcpCwd("");
    }
  };

  const buildMcpConfig = (): MCPConfig["servers"][string] => {
    const tools = mcpTools.split(",").map(t => t.trim()).filter(Boolean);
    if (mcpType === "local") {
      const env: Record<string, string> = {};
      mcpEnv.split("\n").forEach(line => { const [k, ...v] = line.split("="); if (k?.trim()) env[k.trim()] = v.join("=").trim(); });
      return {
        type: "local" as const, command: mcpCommand,
        args: mcpArgs ? mcpArgs.split(",").map(a => a.trim()).filter(Boolean) : [],
        tools,
        ...(Object.keys(env).length ? { env } : {}),
        ...(mcpCwd.trim() ? { cwd: mcpCwd.trim() } : {}),
      };
    } else {
      const headers: Record<string, string> = {};
      mcpHeaders.split("\n").forEach(line => { const idx = line.indexOf(":"); if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim(); });
      return {
        type: mcpType as "http" | "sse", url: mcpUrl, tools,
        ...(Object.keys(headers).length ? { headers } : {}),
        ...(mcpTimeout.trim() ? { timeout: Number(mcpTimeout) } : {}),
      };
    }
  };

  const handleSaveMcpServer = async () => {
    setMcpError("");
    const name = mcpName.trim();
    if (!name) { setMcpError("Server name is required."); return; }
    if (mcpType === "local" && !mcpCommand.trim()) { setMcpError("Command is required for local servers."); return; }
    if ((mcpType === "http" || mcpType === "sse") && !mcpUrl.trim()) { setMcpError("URL is required for remote servers."); return; }
    const updated = { ...mcpServers, [name]: buildMcpConfig() };
    try {
      const data = await updateMCPConfig(useCase, updated);
      setMcpServers(data.servers);
      setEditingMcp(null);
      setShowMcpCreate(false);
      resetMcpForm();
    } catch (err) {
      setMcpError(err instanceof Error ? err.message : "Failed to save MCP server");
    }
  };

  const handleDeleteMcp = async (name: string) => {
    if (!confirm(`Delete MCP server "${name}"? This cannot be undone.`)) return;
    setMcpError("");
    const updated = { ...mcpServers };
    delete updated[name];
    try {
      const data = await updateMCPConfig(useCase, updated);
      setMcpServers(data.servers);
    } catch (err) {
      setMcpError(err instanceof Error ? err.message : "Failed to delete MCP server");
    }
  };

  useEffect(() => {
    if (open) {
      loadSkills();
      loadPrompt();
      loadMCPConfig();
    }
  }, [open, useCase]);

  const handleToggle = async (skill: Skill) => {
    try {
      const updated = await updateSkill(skill.name, { enabled: !skill.enabled }, useCase);
      setSkills((prev) => prev.map((s) => (s.name === updated.name ? updated : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update skill");
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setError("");
    try {
      const created = await createSkill({
        name: newName.trim().toLowerCase().replace(/\s+/g, "-"),
        description: newDescription,
        enabled: true,
        instructions: newInstructions,
      }, useCase);
      setSkills((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      setNewInstructions("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create skill");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingSkill) return;
    setError("");
    try {
      const updated = await updateSkill(editingSkill.name, {
        description: editingSkill.description,
        instructions: editingSkill.instructions,
      }, useCase);
      setSkills((prev) => prev.map((s) => (s.name === updated.name ? updated : s)));
      setEditingSkill(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save skill");
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete skill "${name}"? This cannot be undone.`)) return;
    setError("");
    try {
      await deleteSkill(name, useCase);
      setSkills((prev) => prev.filter((s) => s.name !== name));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete skill");
    }
  };

  const handleSavePrompt = async () => {
    setError("");
    try {
      const data = await updateSystemPrompt(promptDraft);
      setPromptContent(data.content);
      setPromptIsDefault(data.isDefault);
      setPromptDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save system prompt");
    }
  };

  const handleResetPrompt = async () => {
    if (!confirm("Reset to the default system prompt? Your custom prompt will be deleted.")) return;
    setError("");
    try {
      await resetSystemPrompt();
      await loadPrompt();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset system prompt");
    }
  };

  // ─── File management ───────────────────────────────────────────────────

  useEffect(() => {
    if (editingSkill) {
      setSkillFiles([]);
      setExpandedFile(null);
      setShowUploadForm(false);
      setUploadPath("");
      setFilesLoading(true);
      listSkillFiles(editingSkill.name, useCase)
        .then((d) => setSkillFiles(d.files))
        .catch(() => setSkillFiles([]))
        .finally(() => setFilesLoading(false));
    } else {
      setSkillFiles([]);
      setExpandedFile(null);
    }
  }, [editingSkill?.name]);

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingSkill || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setError("");
    try {
      const content = await file.text();
      // Build final path: strip trailing slash from prefix, join with filename
      const prefix = uploadPath.trim().replace(/\/+$/, "");
      const filePath = prefix ? `${prefix}/${file.name}` : file.name;
      await upsertSkillFile(editingSkill.name, filePath, content, useCase);
      const existing = skillFiles.findIndex((f) => f.path === filePath);
      const updated: SkillFile = { path: filePath, name: file.name, content };
      setSkillFiles((prev) =>
        existing >= 0
          ? prev.map((f) => (f.path === filePath ? updated : f))
          : [...prev, updated]
      );
      // Refresh skill list so fileCount badge updates
      setSkills((prev) =>
        prev.map((s) =>
          s.name === editingSkill.name
            ? { ...s, fileCount: (s.fileCount ?? 0) + (existing >= 0 ? 0 : 1) }
            : s
        )
      );
      setShowUploadForm(false);
      setUploadPath("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteFile = async (filePath: string) => {
    if (!editingSkill) return;
    if (!confirm(`Delete file "${filePath}"? This cannot be undone.`)) return;
    setError("");
    try {
      await deleteSkillFile(editingSkill.name, filePath, useCase);
      setSkillFiles((prev) => prev.filter((f) => f.path !== filePath));
      if (expandedFile === filePath) setExpandedFile(null);
      setSkills((prev) =>
        prev.map((s) =>
          s.name === editingSkill.name
            ? { ...s, fileCount: Math.max(0, (s.fileCount ?? 0) - 1) }
            : s
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete file");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-navy-800 rounded-2xl shadow-glass-lg max-w-3xl w-full max-h-[85vh] flex flex-col border border-slate-200/50 dark:border-white/[0.08] animate-slide-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-5 pb-0 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-100 to-primary-100 dark:from-accent-900/30 dark:to-primary-900/30 flex items-center justify-center border border-primary-200/50 dark:border-primary-500/20">
                <svg className="w-4.5 h-4.5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Agent Manager</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage skills, MCP servers, and system prompt &mdash; <span className="font-medium text-slate-700 dark:text-slate-300">{useCase.replace(/-/g, " ")}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex gap-1">
            {(["skills", "prompt", "mcp"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-all duration-200 ${
                  tab === t
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {t === "skills" ? "Skills" : t === "prompt" ? "System Prompt" : "MCP Servers"}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 px-4 py-2.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-500/20 animate-fade-in">
            {error}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "mcp" ? (
            /* ── MCP Servers tab ── */
            mcpLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-200 border-t-primary-600" />
              </div>
            ) : editingMcp ? (
              /* ── MCP Edit view ── */
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => { setEditingMcp(null); resetMcpForm(); }} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">&larr; Back</button>
                  <h3 className="font-medium text-slate-900 dark:text-white">Editing: {editingMcp.name}</h3>
                </div>
                {mcpError && <div className="px-4 py-2.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-500/20">{mcpError}</div>}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Type</label>
                  <select value={mcpType} onChange={(e) => setMcpType(e.target.value as "local" | "http" | "sse")} className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all">
                    <option value="local">Local (stdio)</option>
                    <option value="http">Remote (HTTP)</option>
                    <option value="sse">Remote (SSE)</option>
                  </select>
                </div>
                {mcpType === "local" ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Command <span className="text-red-500">*</span></label>
                      <input type="text" value={mcpCommand} onChange={(e) => setMcpCommand(e.target.value)} placeholder="faker-mcp-server" className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Arguments <span className="text-slate-400 text-xs font-normal">(comma-separated)</span></label>
                      <input type="text" value={mcpArgs} onChange={(e) => setMcpArgs(e.target.value)} placeholder="--port, 3000" className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Environment Variables <span className="text-slate-400 text-xs font-normal">(KEY=VALUE per line)</span></label>
                      <textarea value={mcpEnv} onChange={(e) => setMcpEnv(e.target.value)} rows={3} placeholder={"API_KEY=abc123\nDEBUG=true"} className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Working Directory</label>
                      <input type="text" value={mcpCwd} onChange={(e) => setMcpCwd(e.target.value)} placeholder="/path/to/dir" className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">URL <span className="text-red-500">*</span></label>
                      <input type="text" value={mcpUrl} onChange={(e) => setMcpUrl(e.target.value)} placeholder="https://mcp.example.com/sse" className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Headers <span className="text-slate-400 text-xs font-normal">(Key: Value per line)</span></label>
                      <textarea value={mcpHeaders} onChange={(e) => setMcpHeaders(e.target.value)} rows={3} placeholder={"Authorization: Bearer token123\nX-Custom: value"} className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Timeout <span className="text-slate-400 text-xs font-normal">(seconds)</span></label>
                      <input type="number" value={mcpTimeout} onChange={(e) => setMcpTimeout(e.target.value)} placeholder="30" className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tools <span className="text-slate-400 text-xs font-normal">(comma-separated, * = all)</span></label>
                  <input type="text" value={mcpTools} onChange={(e) => setMcpTools(e.target.value)} placeholder="*" className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => { setEditingMcp(null); resetMcpForm(); }} className="px-4 py-2 text-sm text-slate-500 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all font-medium">Cancel</button>
                  <button onClick={handleSaveMcpServer} className="px-4 py-2 text-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all shadow-sm font-medium">Save Changes</button>
                </div>
              </div>
            ) : showMcpCreate ? (
              /* ── MCP Create view ── */
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => { setShowMcpCreate(false); resetMcpForm(); }} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">&larr; Back</button>
                  <h3 className="font-medium text-slate-900 dark:text-white">Add MCP Server</h3>
                </div>
                {mcpError && <div className="px-3 py-2 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-sm rounded-lg">{mcpError}</div>}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Server Name <span className="text-red-500">*</span></label>
                  <input type="text" value={mcpName} onChange={(e) => setMcpName(e.target.value)} placeholder="my-mcp-server" className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Type</label>
                  <select value={mcpType} onChange={(e) => setMcpType(e.target.value as "local" | "http" | "sse")} className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all">
                    <option value="local">Local (stdio)</option>
                    <option value="http">Remote (HTTP)</option>
                    <option value="sse">Remote (SSE)</option>
                  </select>
                </div>
                {mcpType === "local" ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Command <span className="text-red-500">*</span></label>
                      <input type="text" value={mcpCommand} onChange={(e) => setMcpCommand(e.target.value)} placeholder="faker-mcp-server" className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Arguments <span className="text-slate-400 text-xs font-normal">(comma-separated)</span></label>
                      <input type="text" value={mcpArgs} onChange={(e) => setMcpArgs(e.target.value)} placeholder="--port, 3000" className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Environment Variables <span className="text-slate-400 text-xs font-normal">(KEY=VALUE per line)</span></label>
                      <textarea value={mcpEnv} onChange={(e) => setMcpEnv(e.target.value)} rows={3} placeholder={"API_KEY=abc123\nDEBUG=true"} className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Working Directory</label>
                      <input type="text" value={mcpCwd} onChange={(e) => setMcpCwd(e.target.value)} placeholder="/path/to/dir" className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">URL <span className="text-red-500">*</span></label>
                      <input type="text" value={mcpUrl} onChange={(e) => setMcpUrl(e.target.value)} placeholder="https://mcp.example.com/sse" className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Headers <span className="text-slate-400 text-xs font-normal">(Key: Value per line)</span></label>
                      <textarea value={mcpHeaders} onChange={(e) => setMcpHeaders(e.target.value)} rows={3} placeholder={"Authorization: Bearer token123\nX-Custom: value"} className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Timeout <span className="text-slate-400 text-xs font-normal">(seconds)</span></label>
                      <input type="number" value={mcpTimeout} onChange={(e) => setMcpTimeout(e.target.value)} placeholder="30" className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tools <span className="text-slate-400 text-xs font-normal">(comma-separated, * = all)</span></label>
                  <input type="text" value={mcpTools} onChange={(e) => setMcpTools(e.target.value)} placeholder="*" className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => { setShowMcpCreate(false); resetMcpForm(); }} className="px-4 py-2 text-sm text-slate-500 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all font-medium">Cancel</button>
                  <button onClick={handleSaveMcpServer} disabled={!mcpName.trim()} className="px-4 py-2 text-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all shadow-sm font-medium disabled:opacity-50">Add Server</button>
                </div>
              </div>
            ) : (
              /* ── MCP server list ── */
              <div className="space-y-3">
                {Object.keys(mcpServers).length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No MCP servers configured yet</p>
                ) : (
                  Object.entries(mcpServers).map(([name, cfg]) => (
                    <div key={name} className="flex items-center justify-between p-4 border border-slate-200 dark:border-white/[0.06] rounded-xl dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/[0.1] hover:shadow-sm transition-all">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          cfg.type === "local" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"
                        }`}>{cfg.type}</span>
                        <div className="min-w-0">
                          <span className="font-medium text-sm text-slate-900 dark:text-white">{name}</span>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
                            {cfg.type === "local" ? cfg.command : cfg.url}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-3">
                        <button onClick={() => { populateMcpForm(name, cfg); setEditingMcp({ name, config: cfg }); }} className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteMcp(name)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )
          ) : tab === "prompt" ? (
            /* ── System Prompt tab ── */
            promptLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    System prompt sent to the LLM at the start of every conversation
                  </label>
                  {promptIsDefault ? (
                    <span className="text-xs bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">Default</span>
                  ) : (
                    <span className="text-xs bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-full">Custom</span>
                  )}
                </div>
                <textarea
                  value={promptDraft}
                  onChange={(e) => {
                    setPromptDraft(e.target.value);
                    setPromptDirty(e.target.value !== promptContent);
                  }}
                  rows={16}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
                />
                <div className="flex justify-between">
                  <button
                    onClick={handleResetPrompt}
                    disabled={promptIsDefault}
                    className="px-4 py-2 text-sm text-slate-500 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Reset to Default
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setPromptDraft(promptContent);
                        setPromptDirty(false);
                      }}
                      disabled={!promptDirty}
                      className="px-4 py-2 text-sm text-slate-500 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleSavePrompt}
                      disabled={!promptDirty || !promptDraft.trim()}
                      className="px-4 py-2 text-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save Prompt
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Changes take effect on the next new conversation. Existing sessions are not affected.
                </p>
              </div>
            )
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : editingSkill ? (
            /* ── Edit view ── */
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setEditingSkill(null)}
                  className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  &larr; Back
                </button>
                <h3 className="font-medium text-slate-900 dark:text-white">
                  Editing: {editingSkill.name}
                </h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={editingSkill.description}
                  onChange={(e) =>
                    setEditingSkill({ ...editingSkill, description: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Instructions (SKILL.md content)
                </label>
                <textarea
                  value={editingSkill.instructions}
                  onChange={(e) =>
                    setEditingSkill({ ...editingSkill, instructions: e.target.value })
                  }
                  rows={12}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
                />
              </div>

              {/* Files & Scripts section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Scripts &amp; Files
                    {skillFiles.length > 0 && (
                      <span className="ml-1.5 text-xs font-normal text-slate-400">({skillFiles.length})</span>
                    )}
                  </label>
                  {!showUploadForm && (
                    <button
                      type="button"
                      onClick={() => setShowUploadForm(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-xl transition-all border border-primary-200 dark:border-primary-500/20"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Upload
                    </button>
                  )}
                </div>
                {showUploadForm && (
                  <div className="flex items-center gap-2 mb-3 p-2.5 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl">
                    <div className="flex-1 flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 font-mono flex-shrink-0">path:</span>
                      <input
                        type="text"
                        value={uploadPath}
                        onChange={(e) => setUploadPath(e.target.value)}
                        placeholder="scripts/"
                        className="flex-1 px-2 py-1 text-xs font-mono border border-slate-200 dark:border-white/[0.08] rounded focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-0"
                        onKeyDown={(e) => e.key === "Escape" && (setShowUploadForm(false), setUploadPath(""))}
                      />
                    </div>
                    <label className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-white bg-primary-600 hover:bg-primary-700 rounded-xl cursor-pointer transition-colors flex-shrink-0">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Choose file
                      <input ref={fileInputRef} type="file" className="hidden" onChange={handleUploadFile} />
                    </label>
                    <button
                      type="button"
                      onClick={() => { setShowUploadForm(false); setUploadPath(""); }}
                      className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                {filesLoading ? (
                  <div className="flex items-center gap-2 py-3 text-xs text-slate-500">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-slate-500" />
                    Loading files…
                  </div>
                ) : skillFiles.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4 border border-dashed border-slate-300 dark:border-white/[0.08] rounded-xl">
                    No files yet. Upload scripts or other supporting files for this skill.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {skillFiles.map((file) => (
                      <div key={file.path} className="border border-slate-200 dark:border-white/[0.06] rounded-xl dark:bg-white/[0.02] overflow-hidden">
                        <div
                          className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer transition-colors select-none"
                          onClick={() => setExpandedFile(expandedFile === file.path ? null : file.path)}
                        >
                          <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-xs font-mono text-slate-400 flex-1 truncate">{file.path}</span>
                          <svg
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform flex-shrink-0 ${expandedFile === file.path ? "rotate-180" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.path); }}
                            className="p-0.5 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                            title="Delete file"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        {expandedFile === file.path && (
                          <pre className="text-xs font-mono p-3 bg-slate-100 dark:bg-navy-950 text-slate-700 dark:text-slate-300 overflow-x-auto max-h-52 overflow-y-auto whitespace-pre leading-relaxed">
                            {file.content || "(binary or empty file)"}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setEditingSkill(null)}
                  className="px-4 py-2 text-sm text-slate-500 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 text-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all shadow-sm font-medium"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : showCreate ? (
            /* ── Create view ── */
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  &larr; Back
                </button>
                <h3 className="font-medium text-slate-900 dark:text-white">Add New Skill</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Name <span className="text-slate-400">(lowercase, hyphens only)</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="my-new-skill"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What this skill does"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Instructions (SKILL.md content)
                </label>
                <textarea
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                  rows={8}
                  placeholder="## Instructions&#10;&#10;1. Accept a query...&#10;2. Process it..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm text-slate-500 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="px-4 py-2 text-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all shadow-sm font-medium disabled:opacity-50"
                >
                  Create Skill
                </button>
              </div>
            </div>
          ) : (
            /* ── Skills list ── */
            <div className="space-y-3">
              {skills.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No skills configured yet
                </p>
              ) : (
                skills.map((skill) => (
                  <div
                    key={skill.name}
                    className="flex items-center justify-between p-4 border border-slate-200 dark:border-white/[0.06] rounded-xl dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/[0.1] hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(skill)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors ${
                          skill.enabled ? "bg-primary-600" : "bg-slate-300 dark:bg-slate-600"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                            skill.enabled ? "translate-x-4 ml-0.5" : "translate-x-0.5"
                          }`}
                        />
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-slate-900 dark:text-white">
                            {skill.name}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            {skill.toolName}
                          </span>
                          {(skill.fileCount ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {skill.fileCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {skill.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-3">
                      <button
                        onClick={() => setEditingSkill(skill)}
                        className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(skill.name)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer — show when on skills or MCP list view */}
        {tab === "skills" && !editingSkill && !showCreate && (
          <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 dark:border-white/[0.06]">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-xl transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Skill
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-500 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all font-medium"
            >
              Close
            </button>
          </div>
        )}
        {tab === "mcp" && !editingMcp && !showMcpCreate && (
          <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 dark:border-white/[0.06]">
            <button
              onClick={() => { resetMcpForm(); setShowMcpCreate(true); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-xl transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Server
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-500 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all font-medium"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
