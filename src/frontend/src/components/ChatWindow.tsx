"use client";

import { useState, useRef, useEffect } from "react";
import { Conversation, ChatMessage, ToolCallInfo, RunStats } from "@/types";
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
  const [runStats, setRunStats] = useState<RunStats | null>(null);
  const [messageStats, setMessageStats] = useState<Record<string, { thoughts: string[]; toolCalls: ToolCallInfo[]; runStats: RunStats }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const thoughtsRef = useRef<string[]>([]);
  const toolCallsRef = useRef<ToolCallInfo[]>([]);
  const runStatsRef = useRef<RunStats | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thoughts, activeToolCalls, runStats]);

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
    setRunStats(null);
    thoughtsRef.current = [];
    toolCallsRef.current = [];
    runStatsRef.current = null;

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
            setThoughts((prev) => {
              const next = [...prev, data.content as string];
              thoughtsRef.current = next;
              return next;
            });
            break;

          case "tool_call":
            setActiveToolCalls((prev) => {
              const toolCall: ToolCallInfo = {
                skillName: data.skillName as string,
                status: data.status as "started" | "completed" | "failed",
                input: data.input as string,
                output: data.output as string,
                durationMs: data.durationMs as number,
              };
              let next: ToolCallInfo[];
              if (toolCall.status !== "started") {
                // Find the first "started" entry with the same name and update it
                const existing = prev.findIndex(
                  (tc) =>
                    tc.skillName === toolCall.skillName &&
                    tc.status === "started"
                );
                if (existing >= 0) {
                  next = [...prev];
                  next[existing] = { ...next[existing], ...toolCall };
                } else {
                  // Fallback: find any entry with the same name
                  const fallback = prev.findIndex(
                    (tc) => tc.skillName === toolCall.skillName
                  );
                  if (fallback >= 0) {
                    next = [...prev];
                    next[fallback] = { ...next[fallback], ...toolCall };
                  } else {
                    next = [...prev, toolCall];
                  }
                }
              } else {
                next = [...prev, toolCall];
              }
              toolCallsRef.current = next;
              return next;
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

          case "done": {
            const stats: RunStats = {
              totalDurationMs: (data.totalDurationMs as number) || 0,
              totalToolCalls: (data.totalToolCalls as number) || 0,
              promptTokens: (data.promptTokens as number) || 0,
              completionTokens: (data.completionTokens as number) || 0,
              totalTokens: (data.totalTokens as number) || 0,
              timeToFirstTokenMs: (data.timeToFirstTokenMs as number) || 0,
              modelLatencyMs: (data.modelLatencyMs as number) || 0,
            };
            setRunStats(stats);
            runStatsRef.current = stats;
            break;
          }
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
        // Persist execution details for this assistant message
        if (runStatsRef.current) {
          setMessageStats((prev) => ({
            ...prev,
            [assistantId]: {
              thoughts: thoughtsRef.current,
              toolCalls: toolCallsRef.current,
              runStats: runStatsRef.current!,
            },
          }));
        }
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
          <div key={msg.id}>
            <MessageBubble message={msg} />
            {/* Show persisted execution details below each assistant message */}
            {msg.role === "assistant" && messageStats[msg.id] && (
              <div className="mt-2">
                <ThoughtChain
                  thoughts={messageStats[msg.id].thoughts}
                  toolCalls={messageStats[msg.id].toolCalls}
                  isStreaming={false}
                  runStats={messageStats[msg.id].runStats}
                />
              </div>
            )}
          </div>
        ))}

        {/* Live thought chain (visible during streaming) */}
        {isStreaming && (thoughts.length > 0 || activeToolCalls.length > 0) && (
          <ThoughtChain
            thoughts={thoughts}
            toolCalls={activeToolCalls}
            isStreaming={true}
            runStats={runStats}
          />
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
