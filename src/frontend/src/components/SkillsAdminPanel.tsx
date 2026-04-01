"use client";

import { useState, useEffect, useRef } from "react";
import { listSkills, createSkill, updateSkill, deleteSkill, getSystemPrompt, updateSystemPrompt, resetSystemPrompt, listSkillFiles, upsertSkillFile, deleteSkillFile, getMCPConfig, updateMCPConfig } from "@/lib/api";
import type { MCPConfig, Skill, SkillFile, UseCase } from "@/types";
import { useTheme } from "./ThemeProvider";

type Tab = "skills" | "prompt" | "mcp";

interface Props {
  onClose: () => void;
  useCase?: string;
  useCases?: UseCase[];
  onSelectUseCase?: (name: string) => void;
}

export function SkillsAdminPanel({ onClose, useCase = "generic", useCases = [], onSelectUseCase }: Props) {
  const [tab, setTab] = useState<Tab>("skills");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

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
    loadSkills();
    loadPrompt();
    loadMCPConfig();
  }, [useCase]);

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

  const navItems: { id: Tab; label: string; icon: string }[] = [
    { id: "skills", label: "Skills", icon: "puzzle" },
    { id: "prompt", label: "System Prompt", icon: "document" },
    { id: "mcp", label: "MCP Servers", icon: "server" },
  ];

  const renderNavIcon = (icon: string) => {
    switch (icon) {
      case "puzzle": return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.166 3.532-1.005 3.532a1.5 1.5 0 01-1.5-1.5v0c0-.828-.895-1.5-2-1.5s-2 .672-2 1.5v0a1.5 1.5 0 01-1.5 1.5c-1.171 0-1.191-1.919-1.005-3.532a48.39 48.39 0 01-4.163.3A.64.64 0 012.25 6.73v0c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003C3 3.732 3.84 2.875 5.25 2.875s2.25.857 2.25 1.893c0 .369-.128.713-.349 1.003" /></svg>;
      case "document": return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;
      case "server": return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" /></svg>;
      default: return null;
    }
  };

  return (
    <div className="flex h-screen bg-surface-50 dark:bg-navy-950">
      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Left sidebar navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[280px] bg-navy-950 border-r border-white/[0.06] flex flex-col
        transform transition-transform duration-300 ease-out
        md:relative md:translate-x-0 md:z-auto
        ${mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {/* Header */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center transition-all flex-shrink-0"
              title="Back to Chat"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-white text-sm tracking-tight">Agent Manager</h1>
              <p className="text-[11px] text-slate-400">Configure skills, prompts &amp; MCP</p>
            </div>
            {/* Mobile close */}
            <button
              onClick={() => setMobileNavOpen(false)}
              className="md:hidden p-1.5 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-white/[0.06] transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Use case selector */}
        {useCases.length > 1 && (
          <div className="px-4 pb-3">
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 px-1">
              Agent Persona
            </label>
            <div className="relative">
              <select
                value={useCase}
                onChange={(e) => onSelectUseCase?.(e.target.value)}
                className="w-full text-sm text-slate-200 bg-white/[0.06] border border-white/[0.1] rounded-lg pl-3 pr-9 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500/50 appearance-none cursor-pointer hover:bg-white/[0.1] hover:border-white/[0.14] transition-all"
              >
                {useCases.map((uc) => (
                  <option key={uc.name} value={uc.name} className="bg-navy-900">
                    {uc.displayName} ({uc.skillCount} skills)
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </div>
            </div>
          </div>
        )}

        <div className="mx-4 my-1 border-t border-white/[0.06]" />

        {/* Navigation items */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setTab(item.id); setMobileNavOpen(false); setEditingSkill(null); setShowCreate(false); setEditingMcp(null); setShowMcpCreate(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                tab === item.id
                  ? "bg-white/[0.12] text-white font-medium"
                  : "text-slate-300 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <span className={tab === item.id ? "text-primary-400" : "text-slate-400"}>
                {renderNavIcon(item.icon)}
              </span>
              {item.label}
              {item.id === "skills" && skills.length > 0 && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.1] text-slate-400 font-mono">
                  {skills.length}
                </span>
              )}
              {item.id === "mcp" && Object.keys(mcpServers).length > 0 && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.1] text-slate-400 font-mono">
                  {Object.keys(mcpServers).length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all duration-150"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
            </svg>
            Back to Chat
          </button>
          <div className="pt-2 px-3 flex items-center justify-between">
            <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-slow"></span>
              {useCase.replace(/-/g, " ")}
            </p>
            <button
              onClick={toggleTheme}
              className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-white/[0.06] transition-all"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="border-b border-slate-200/80 dark:border-white/[0.06] px-4 sm:px-8 py-4 bg-white/80 dark:bg-navy-900/80 backdrop-blur-lg">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden p-2 -ml-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {tab === "skills" ? (showCreate ? "Create Skill" : "Skills") : tab === "prompt" ? "System Prompt" : (editingMcp ? `Edit: ${editingMcp.name}` : showMcpCreate ? "Add MCP Server" : "MCP Servers")}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {tab === "skills" ? `${skills.filter(s => s.enabled).length} of ${skills.length} active` : tab === "prompt" ? "Configure the system prompt for all conversations" : `${Object.keys(mcpServers).length} server${Object.keys(mcpServers).length !== 1 ? "s" : ""} configured`}
              </p>
            </div>
            {/* Action buttons */}
            {tab === "skills" && !showCreate && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all shadow-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Add Skill</span>
              </button>
            )}
            {tab === "mcp" && !editingMcp && !showMcpCreate && (
              <button
                onClick={() => { resetMcpForm(); setShowMcpCreate(true); }}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all shadow-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Add Server</span>
              </button>
            )}
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="mx-4 sm:mx-8 mt-4 px-4 py-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-500/20 animate-fade-in flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          {tab === "mcp" ? (
            /* ── MCP Servers tab ── */
            mcpLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-200 border-t-primary-600" />
              </div>
            ) : editingMcp ? (
              /* ── MCP Edit view ── */
              <div className="max-w-3xl space-y-5">
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
              <div className="max-w-3xl space-y-5">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Object.keys(mcpServers).length === 0 ? (
                  <div className="col-span-full text-center py-16">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-white/[0.04] flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">No MCP servers configured</p>
                    <p className="text-xs text-slate-400 mt-1">Add a server to extend agent capabilities</p>
                  </div>
                ) : (
                  Object.entries(mcpServers).map(([name, cfg]) => (
                    <div key={name} className="flex flex-col p-5 border border-slate-200 dark:border-white/[0.06] rounded-2xl bg-white dark:bg-navy-800 hover:border-slate-300 dark:hover:border-white/[0.1] hover:shadow-card-hover transition-all">
                      <div className="flex items-start gap-3 mb-3">
                        <span className={`text-xs px-2.5 py-1 rounded-lg font-medium flex-shrink-0 ${
                          cfg.type === "local" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20" : "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"
                        }`}>{cfg.type.toUpperCase()}</span>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-sm text-slate-900 dark:text-white block">{name}</span>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono mt-1">
                            {cfg.type === "local" ? cfg.command : cfg.url}
                          </p>
                          {cfg.tools && cfg.tools.length > 0 && cfg.tools[0] !== "*" && (
                            <p className="text-[10px] text-slate-400 mt-1">{cfg.tools.length} tool{cfg.tools.length !== 1 ? "s" : ""} configured</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-100 dark:border-white/[0.04]">
                        <button onClick={() => { populateMcpForm(name, cfg); setEditingMcp({ name, config: cfg }); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-all font-medium">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          Edit
                        </button>
                        <button onClick={() => handleDeleteMcp(name)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all font-medium">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Delete
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
              <div className="max-w-3xl space-y-5">
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
                  rows={20}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all resize-y"
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

          ) : showCreate ? (
            /* ── Create view ── */
            <div className="max-w-3xl space-y-5">

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
                  rows={16}
                  placeholder="## Instructions&#10;&#10;1. Accept a query...&#10;2. Process it..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all resize-y"
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
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {skills.length === 0 ? (
                <div className="col-span-full text-center py-16">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-white/[0.04] flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.166 3.532-1.005 3.532" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">No skills configured</p>
                  <p className="text-xs text-slate-400 mt-1">Add your first skill to get started</p>
                </div>
              ) : (
                skills.map((skill) => {
                  const isEditing = editingSkill?.name === skill.name;
                  return (
                  <div
                    key={skill.name}
                    className={`flex flex-col p-5 border rounded-2xl transition-all ${
                      isEditing
                        ? "col-span-full border-primary-300 dark:border-primary-500/30 bg-white dark:bg-navy-800 shadow-lg ring-1 ring-primary-200 dark:ring-primary-500/20"
                        : "border-slate-200 dark:border-white/[0.06] bg-white dark:bg-navy-800 hover:border-slate-300 dark:hover:border-white/[0.1] hover:shadow-card-hover group"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                            {skill.name}
                          </span>
                          {(skill.fileCount ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {skill.fileCount}
                            </span>
                          )}
                        </div>
                        {!isEditing && (
                          <>
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                              {skill.description || "No description"}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-1.5">{skill.toolName}</p>
                          </>
                        )}
                      </div>
                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(skill)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors ${
                          skill.enabled ? "bg-primary-600" : "bg-slate-300 dark:bg-slate-600"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                            skill.enabled ? "translate-x-5 ml-0.5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>

                    {isEditing ? (
                      /* ── Inline Edit Form ── */
                      <div className="space-y-5 pt-3 border-t border-slate-100 dark:border-white/[0.04]">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Description</label>
                          <input
                            type="text"
                            value={editingSkill.description}
                            onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Instructions (SKILL.md content)</label>
                          <textarea
                            value={editingSkill.instructions}
                            onChange={(e) => setEditingSkill({ ...editingSkill, instructions: e.target.value })}
                            rows={20}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-slate-200 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all resize-y"
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

                        <div className="flex justify-end gap-3 pt-2">
                          <button
                            onClick={() => setEditingSkill(null)}
                            className="px-5 py-2.5 text-sm text-slate-500 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            className="px-5 py-2.5 text-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all shadow-sm font-medium"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-100 dark:border-white/[0.04]">
                        <button
                          onClick={() => setEditingSkill(skill)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-all font-medium"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(skill.name)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all font-medium"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
