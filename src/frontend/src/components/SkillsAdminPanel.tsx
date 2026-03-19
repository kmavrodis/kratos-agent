"use client";

import { useState, useEffect, useRef } from "react";
import { listSkills, createSkill, updateSkill, deleteSkill, getSystemPrompt, updateSystemPrompt, resetSystemPrompt, listSkillFiles, upsertSkillFile, deleteSkillFile } from "@/lib/api";
import type { Skill, SkillFile } from "@/types";

type Tab = "skills" | "prompt";

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

  useEffect(() => {
    if (open) {
      loadSkills();
      loadPrompt();
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-4 pb-0 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Admin Panel</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Manage skills and system prompt &mdash; <span className="font-medium text-gray-700">{useCase.replace(/-/g, " ")}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setTab("skills")}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                tab === "skills"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Skills
            </button>
            <button
              onClick={() => setTab("prompt")}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                tab === "prompt"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              System Prompt
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === "prompt" ? (
            /* ── System Prompt tab ── */
            promptLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    System prompt sent to the LLM at the start of every conversation
                  </label>
                  {promptIsDefault ? (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Default</span>
                  ) : (
                    <span className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">Custom</span>
                  )}
                </div>
                <textarea
                  value={promptDraft}
                  onChange={(e) => {
                    setPromptDraft(e.target.value);
                    setPromptDirty(e.target.value !== promptContent);
                  }}
                  rows={16}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <div className="flex justify-between">
                  <button
                    onClick={handleResetPrompt}
                    disabled={promptIsDefault}
                    className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                      className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleSavePrompt}
                      disabled={!promptDirty || !promptDraft.trim()}
                      className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save Prompt
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
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
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  &larr; Back
                </button>
                <h3 className="font-medium text-gray-900">
                  Editing: {editingSkill.name}
                </h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editingSkill.description}
                  onChange={(e) =>
                    setEditingSkill({ ...editingSkill, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instructions (SKILL.md content)
                </label>
                <textarea
                  value={editingSkill.instructions}
                  onChange={(e) =>
                    setEditingSkill({ ...editingSkill, instructions: e.target.value })
                  }
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Files & Scripts section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Scripts &amp; Files
                    {skillFiles.length > 0 && (
                      <span className="ml-1.5 text-xs font-normal text-gray-400">({skillFiles.length})</span>
                    )}
                  </label>
                  {!showUploadForm && (
                    <button
                      type="button"
                      onClick={() => setShowUploadForm(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-primary-200"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Upload
                    </button>
                  )}
                </div>
                {showUploadForm && (
                  <div className="flex items-center gap-2 mb-3 p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex-1 flex items-center gap-1.5">
                      <span className="text-xs text-gray-400 font-mono flex-shrink-0">path:</span>
                      <input
                        type="text"
                        value={uploadPath}
                        onChange={(e) => setUploadPath(e.target.value)}
                        placeholder="scripts/"
                        className="flex-1 px-2 py-1 text-xs font-mono border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-0"
                        onKeyDown={(e) => e.key === "Escape" && (setShowUploadForm(false), setUploadPath(""))}
                      />
                    </div>
                    <label className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-white bg-primary-600 hover:bg-primary-700 rounded-lg cursor-pointer transition-colors flex-shrink-0">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Choose file
                      <input ref={fileInputRef} type="file" className="hidden" onChange={handleUploadFile} />
                    </label>
                    <button
                      type="button"
                      onClick={() => { setShowUploadForm(false); setUploadPath(""); }}
                      className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                {filesLoading ? (
                  <div className="flex items-center gap-2 py-3 text-xs text-gray-400">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-gray-400" />
                    Loading files…
                  </div>
                ) : skillFiles.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">
                    No files yet. Upload scripts or other supporting files for this skill.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {skillFiles.map((file) => (
                      <div key={file.path} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div
                          className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors select-none"
                          onClick={() => setExpandedFile(expandedFile === file.path ? null : file.path)}
                        >
                          <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-xs font-mono text-gray-700 flex-1 truncate">{file.path}</span>
                          <svg
                            className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${expandedFile === file.path ? "rotate-180" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.path); }}
                            className="p-0.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                            title="Delete file"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        {expandedFile === file.path && (
                          <pre className="text-xs font-mono p-3 bg-gray-900 text-gray-100 overflow-x-auto max-h-52 overflow-y-auto whitespace-pre leading-relaxed">
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
                  className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
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
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  &larr; Back
                </button>
                <h3 className="font-medium text-gray-900">Add New Skill</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-gray-400">(lowercase, hyphens only)</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="my-new-skill"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What this skill does"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instructions (SKILL.md content)
                </label>
                <textarea
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                  rows={8}
                  placeholder="## Instructions&#10;&#10;1. Accept a query...&#10;2. Process it..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  Create Skill
                </button>
              </div>
            </div>
          ) : (
            /* ── Skills list ── */
            <div className="space-y-3">
              {skills.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  No skills configured yet
                </p>
              ) : (
                skills.map((skill) => (
                  <div
                    key={skill.name}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(skill)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors ${
                          skill.enabled ? "bg-primary-600" : "bg-gray-300"
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
                          <span className="font-medium text-sm text-gray-900">
                            {skill.name}
                          </span>
                          <span className="text-xs text-gray-400 font-mono">
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
                        <p className="text-xs text-gray-500 truncate">
                          {skill.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-3">
                      <button
                        onClick={() => setEditingSkill(skill)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(skill.name)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
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

        {/* Footer — only show when on skills list view */}
        {tab === "skills" && !editingSkill && !showCreate && (
          <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Skill
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
