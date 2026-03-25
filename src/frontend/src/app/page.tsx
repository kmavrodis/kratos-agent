"use client";

import { useState, useEffect } from "react";
import { ChatWindow } from "@/components/ChatWindow";
import { Sidebar } from "@/components/Sidebar";
import { SettingsModal } from "@/components/SettingsModal";
import { SkillsAdminPanel } from "@/components/SkillsAdminPanel";
import { Conversation, UseCase, Skill } from "@/types";
import { listUseCases, listConversations, createConversation, deleteConversation, listSkills } from "@/lib/api";
import { loadRuntimeConfig } from "@/lib/config";

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [selectedUseCase, setSelectedUseCase] = useState<string>("generic");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  useEffect(() => {
    // Load runtime config (resolves API URL from /config.json if present)
    loadRuntimeConfig().then(() => {
    // Load use-cases
    listUseCases()
      .then((ucs) => {
        setUseCases(ucs);
        if (ucs.length > 0 && !ucs.find((uc) => uc.name === selectedUseCase)) {
          setSelectedUseCase(ucs[0].name);
        }
      })
      .catch(() => {
        setUseCases([{ name: "generic", displayName: "Generic Assistant", description: "", skillCount: 0, sampleQuestions: [] }]);
      });

    // Load existing conversations from Cosmos so the sidebar persists across reloads
    listConversations()
      .then((data) => {
        const convs = (data.conversations as Conversation[]) || [];
        setConversations(convs);
      })
      .catch(() => {
        // Non-fatal — sidebar will just be empty on this load
      });
    }); // end loadRuntimeConfig
  }, []);

  // Fetch skills whenever the selected use-case changes
  useEffect(() => {
    listSkills(selectedUseCase)
      .then((s) => setSkills(s))
      .catch(() => setSkills([]));
  }, [selectedUseCase]);

  const handleNewConversation = async () => {
    // Optimistically show the conversation immediately
    const tempId = crypto.randomUUID();
    const optimistic: Conversation = {
      id: tempId,
      title: "New Conversation",
      useCase: selectedUseCase,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setConversations((prev) => [optimistic, ...prev]);
    setActiveConversation(optimistic);
    setPendingMessage(null);

    // Persist to Cosmos and replace the optimistic entry with the server one
    try {
      const saved = await createConversation("New Conversation", selectedUseCase) as Conversation;
      setConversations((prev) =>
        prev.map((c) => (c.id === tempId ? { ...optimistic, id: saved.id } : c))
      );
      setActiveConversation((prev) =>
        prev?.id === tempId ? { ...optimistic, id: saved.id } : prev
      );
    } catch {
      // Keep the optimistic entry — messages will still work, just won't survive a reload
    }
  };

  const handleDeleteConversation = async (conv: Conversation) => {
    // Optimistically remove from UI
    setConversations((prev) => prev.filter((c) => c.id !== conv.id));
    if (activeConversation?.id === conv.id) {
      setActiveConversation(null);
    }
    try {
      await deleteConversation(conv.id);
    } catch {
      // Restore on failure
      setConversations((prev) => [conv, ...prev]);
    }
  };

  const handleTitleChange = (conversationId: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, title } : c))
    );
    setActiveConversation((prev) =>
      prev?.id === conversationId ? { ...prev, title } : prev
    );
  };

  const handleSelectConversation = (conv: Conversation) => {
    setActiveConversation(conv);
    setSelectedUseCase(conv.useCase || "generic");
    setPendingMessage(null);
  };

  const handleSampleQuestion = async (question: string) => {
    // Create a new conversation and auto-send the sample question
    const tempId = crypto.randomUUID();
    const optimistic: Conversation = {
      id: tempId,
      title: "New Conversation",
      useCase: selectedUseCase,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setConversations((prev) => [optimistic, ...prev]);
    setActiveConversation(optimistic);

    // Wait for the real conversation ID before setting the pending message
    // so ChatWindow sends to a conversation that exists in Cosmos
    try {
      const saved = await createConversation("New Conversation", selectedUseCase) as Conversation;
      const real = { ...optimistic, id: saved.id };
      setConversations((prev) =>
        prev.map((c) => (c.id === tempId ? real : c))
      );
      setActiveConversation(real);
      setPendingMessage(question);
    } catch {
      // Fallback: try with the optimistic entry
      setPendingMessage(question);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeConversation?.id ?? null}
        onNew={handleNewConversation}
        onSelect={handleSelectConversation}
        onDelete={handleDeleteConversation}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSkills={() => setSkillsOpen(true)}
        useCases={useCases}
        selectedUseCase={selectedUseCase}
        onSelectUseCase={setSelectedUseCase}
      />

      {/* Settings modal */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Skills admin panel */}
      <SkillsAdminPanel open={skillsOpen} onClose={() => setSkillsOpen(false)} useCase={selectedUseCase} />

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {activeConversation ? (
          <ChatWindow conversation={activeConversation} onTitleChange={handleTitleChange} initialMessage={pendingMessage ?? undefined} />
        ) : (
          <div className="flex-1 flex items-center justify-center mesh-bg">
            <div className="text-center max-w-2xl animate-fade-in">
              {/* Logo */}
              <div className="mx-auto mb-8 w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/25">
                <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>

              <h1 className="text-4xl font-bold mb-3">
                <span className="gradient-text">
                  {useCases.find((uc) => uc.name === selectedUseCase)?.displayName || "Kratos Agent"}
                </span>
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-lg mb-10 leading-relaxed">
                {useCases.find((uc) => uc.name === selectedUseCase)?.description || (
                  <>Enterprise AI Agent powered by GitHub Copilot SDK<br /><span className="text-slate-400">&amp; Microsoft Foundry</span></>
                )}
              </p>

              <button
                onClick={handleNewConversation}
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all duration-200 font-medium shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Start a conversation
              </button>

              {/* Sample questions */}
              {(useCases.find((uc) => uc.name === selectedUseCase)?.sampleQuestions ?? []).length > 0 && (
                <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
                  {useCases.find((uc) => uc.name === selectedUseCase)!.sampleQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSampleQuestion(q)}
                      className="group text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] hover:border-primary-300 dark:hover:border-primary-500/30 hover:bg-primary-50 dark:hover:bg-primary-500/[0.06] transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <svg className="w-4 h-4 mt-0.5 text-primary-400 dark:text-primary-500 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                        </svg>
                        <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors leading-snug">{q}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Skill pills */}
              {skills.filter((s) => s.enabled).length > 0 && (
                <div className="mt-12 flex flex-wrap justify-center gap-2.5">
                  {skills.filter((s) => s.enabled).map((s) => (
                    <span key={s.name} className="px-3.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-white/[0.06] rounded-full border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-none">
                      {s.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
