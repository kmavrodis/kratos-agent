"use client";

import { Conversation } from "@/types";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (conv: Conversation) => void;
  onOpenSettings: () => void;
}

export function Sidebar({ conversations, activeId, onNew, onSelect, onOpenSettings }: Props) {
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
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors truncate ${
                    activeId === conv.id
                      ? "bg-primary-50 text-primary-700 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {conv.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-gray-200">
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
        <p className="text-xs text-gray-400 mt-2 px-3">Copilot SDK + Foundry + MCP</p>
      </div>
    </aside>
  );
}
