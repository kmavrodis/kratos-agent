"use client";

import { Conversation, UseCase } from "@/types";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (conv: Conversation) => void;
  onOpenSettings: () => void;
  onOpenSkills: () => void;
  useCases: UseCase[];
  selectedUseCase: string;
  onSelectUseCase: (name: string) => void;
}

export function Sidebar({ conversations, activeId, onNew, onSelect, onOpenSettings, onOpenSkills, useCases, selectedUseCase, onSelectUseCase }: Props) {
  return (
    <aside className="w-72 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Logo / brand */}
      <div className="px-4 py-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">K</span>
          </div>
          <div>
            <h1 className="font-semibold text-gray-900 text-sm">
              Kratos Agent
            </h1>
            <p className="text-xs text-gray-500">AI Solution Accelerator</p>
          </div>
        </div>
      </div>

      {/* Use-case selector */}
      {useCases.length > 1 && (
        <div className="px-3 py-3 border-b border-gray-200">
          <label className="block text-xs font-medium text-gray-500 mb-1.5 px-1">
            Agent Persona
          </label>
          <select
            value={selectedUseCase}
            onChange={(e) => onSelectUseCase(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {useCases.map((uc) => (
              <option key={uc.name} value={uc.name}>
                {uc.displayName} ({uc.skillCount} skills)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* New conversation button */}
      <div className="px-3 py-3">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New conversation
        </button>
      </div>

      {/* Conversation list */}
      <nav className="flex-1 overflow-y-auto px-3 py-1">
        {conversations.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">
            No conversations yet
          </p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((conv) => (
              <li key={conv.id}>
                <button
                  onClick={() => onSelect(conv)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeId === conv.id
                      ? "bg-primary-50 text-primary-700 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="block truncate">{conv.title}</span>
                  {conv.useCase && conv.useCase !== "generic" && (
                    <span className="text-[10px] text-gray-400">
                      {conv.useCase.replace(/-/g, " ")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-gray-200 space-y-1">
        <button
          onClick={onOpenSkills}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          Skills Manager
        </button>
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          BYOK Settings
        </button>
        <p className="text-xs text-gray-400 mt-2 px-3">Copilot SDK + Azure OpenAI + MCP</p>
      </div>
    </aside>
  );
}
