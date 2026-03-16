"use client";

import { useState, useEffect } from "react";
import { ChatWindow } from "@/components/ChatWindow";
import { Sidebar } from "@/components/Sidebar";
import { SettingsModal } from "@/components/SettingsModal";
import { SkillsAdminPanel } from "@/components/SkillsAdminPanel";
import { Conversation, UseCase } from "@/types";
import { listUseCases } from "@/lib/api";

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [selectedUseCase, setSelectedUseCase] = useState<string>("generic");

  useEffect(() => {
    listUseCases()
      .then((ucs) => {
        setUseCases(ucs);
        if (ucs.length > 0 && !ucs.find((uc) => uc.name === selectedUseCase)) {
          setSelectedUseCase(ucs[0].name);
        }
      })
      .catch(() => {
        // Fallback — API not available yet
        setUseCases([{ name: "generic", displayName: "Generic Assistant", description: "", skillCount: 0 }]);
      });
  }, []);

  const handleNewConversation = () => {
    const newConv: Conversation = {
      id: crypto.randomUUID(),
      title: "New Conversation",
      useCase: selectedUseCase,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversation(newConv);
  };

  const handleSelectConversation = (conv: Conversation) => {
    setActiveConversation(conv);
    setSelectedUseCase(conv.useCase || "generic");
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeConversation?.id ?? null}
        onNew={handleNewConversation}
        onSelect={handleSelectConversation}
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
      <main className="flex-1 flex flex-col">
        {activeConversation ? (
          <ChatWindow conversation={activeConversation} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Kratos Agent
              </h1>
              <p className="text-gray-500 mb-8">
                Enterprise AI Agent powered by GitHub Copilot SDK &amp;
                Microsoft Foundry
              </p>
              <button
                onClick={handleNewConversation}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Start a conversation
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
