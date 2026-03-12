"use client";

import { useState, useRef, useEffect } from "react";
import { Conversation, ChatMessage, ToolCallInfo } from "@/types";
import { streamAgentChat } from "@/lib/api";
import { MessageBubble } from "./MessageBubble";
import { ThoughtChain } from "./ThoughtChain";

interface Props {
  conversation: Conversation;
}

export function ChatWindow({ conversation }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallInfo[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thoughts, activeToolCalls]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
    setThoughts([]);
    setActiveToolCalls([]);

    let assistantContent = "";

    // Create a placeholder assistant message
    const assistantId = crypto.randomUUID();

    await streamAgentChat(
      conversation.id,
      trimmed,
      (event) => {
        const data = event.data as Record<string, unknown>;

        switch (event.type) {
          case "thought":
            setThoughts((prev) => [...prev, data.content as string]);
            break;

          case "tool_call":
            setActiveToolCalls((prev) => {
              const existing = prev.findIndex(
                (tc) => tc.skillName === data.skillName
              );
              const toolCall: ToolCallInfo = {
                skillName: data.skillName as string,
                status: data.status as "started" | "completed" | "failed",
                input: data.input as string,
                output: data.output as string,
                durationMs: data.durationMs as number,
              };
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = toolCall;
                return updated;
              }
              return [...prev, toolCall];
            });
            break;

          case "content":
            assistantContent += data.content as string;
            setMessages((prev) => {
              const existing = prev.find((m) => m.id === assistantId);
              if (existing) {
                return prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: assistantContent }
                    : m
                );
              }
              return [
                ...prev,
                {
                  id: assistantId,
                  conversationId: conversation.id,
                  role: "assistant" as const,
                  content: assistantContent,
                  createdAt: new Date().toISOString(),
                },
              ];
            });
            break;

          case "error":
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                conversationId: conversation.id,
                role: "assistant" as const,
                content: `Error: ${data.message}`,
                createdAt: new Date().toISOString(),
              },
            ]);
            break;
        }
      },
      (error) => {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            conversationId: conversation.id,
            role: "assistant" as const,
            content: `Connection error: ${error.message}`,
            createdAt: new Date().toISOString(),
          },
        ]);
        setIsStreaming(false);
      },
      () => {
        setIsStreaming(false);
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="border-b border-gray-200 px-6 py-4 bg-white">
        <h2 className="text-lg font-semibold text-gray-900">
          {conversation.title}
        </h2>
        <p className="text-sm text-gray-500">
          Powered by GitHub Copilot SDK &amp; Microsoft Foundry
        </p>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Thought chain (visible during streaming) */}
        {isStreaming && (thoughts.length > 0 || activeToolCalls.length > 0) && (
          <ThoughtChain thoughts={thoughts} toolCalls={activeToolCalls} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 px-6 py-4 bg-white">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Kratos anything..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: "48px", maxHeight: "200px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 200) + "px";
            }}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <svg
                className="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
