"use client";

import { useState, useRef, useEffect } from "react";
import { Conversation, ChatMessage, ToolCallInfo, RunStats, Attachment } from "@/types";
import { streamAgentChat, respondToUserInput, getConversationMessages, updateConversation } from "@/lib/api";
import { MessageBubble } from "./MessageBubble";
import { ThoughtChain } from "./ThoughtChain";

interface UserInputPrompt {
  requestId: string;
  question: string;
  choices: string[];
  allowFreeform: boolean;
}

interface Props {
  conversation: Conversation;
  onTitleChange?: (conversationId: string, title: string) => void;
  initialMessage?: string;
}

export function ChatWindow({ conversation, onTitleChange, initialMessage }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallInfo[]>([]);
  const [runStats, setRunStats] = useState<RunStats | null>(null);
  const [messageStats, setMessageStats] = useState<Record<string, { thoughts: string[]; toolCalls: ToolCallInfo[]; runStats: RunStats }>>({});
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [userInputPrompt, setUserInputPrompt] = useState<UserInputPrompt | null>(null);
  const [userInputAnswer, setUserInputAnswer] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thoughtsRef = useRef<string[]>([]);
  const toolCallsRef = useRef<ToolCallInfo[]>([]);
  const runStatsRef = useRef<RunStats | null>(null);
  const titleUpdatedRef = useRef<Set<string>>(new Set()); // track which conversations have been titled

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thoughts, activeToolCalls, runStats]);

  // Load message history when switching to an existing conversation
  useEffect(() => {
    setMessages([]);
    setThoughts([]);
    setActiveToolCalls([]);
    setRunStats(null);
    setMessageStats({});
    getConversationMessages(conversation.id)
      .then((msgs) => {
        const loaded = (msgs as ChatMessage[]).filter(
          (m) => m.role === "user" || m.role === "assistant"
        );
        if (loaded.length > 0) {
          setMessages(loaded);
        }
      })
      .catch(() => {
        // Non-fatal — new conversation or backend unreachable
      });
  }, [conversation.id]);

  const handleSend = async (messageOverride?: string) => {
    const trimmed = (messageOverride ?? input).trim();
    if (!trimmed || isStreaming) return;

    // Auto-title on the first message of a conversation
    const isFirstMessage = messages.length === 0;
    if (isFirstMessage && !titleUpdatedRef.current.has(conversation.id)) {
      titleUpdatedRef.current.add(conversation.id);
      const title = trimmed.slice(0, 60) + (trimmed.length > 60 ? "…" : "");
      onTitleChange?.(conversation.id, title);
      updateConversation(conversation.id, { title }).catch(() => {/* non-fatal */});
    }

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

    const currentAttachments = attachments.length > 0 ? [...attachments] : undefined;
    setAttachments([]);

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
              reasoningTokens: (data.reasoningTokens as number) || 0,
              totalTokens: (data.totalTokens as number) || 0,
              timeToFirstTokenMs: (data.timeToFirstTokenMs as number) || 0,
              modelLatencyMs: (data.modelLatencyMs as number) || 0,
            };
            setRunStats(stats);
            runStatsRef.current = stats;
            break;
          }

          case "user_input_request": {
            setUserInputPrompt({
              requestId: data.requestId as string,
              question: data.question as string,
              choices: (data.choices as string[]) || [],
              allowFreeform: (data.allowFreeform as boolean) ?? true,
            });
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
        setUserInputPrompt(null);
      },
      currentAttachments,
      conversation.useCase
    );
  };

  // Auto-send initial message (e.g. from sample question click)
  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;
  const initialMessageSentRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialMessage && initialMessageSentRef.current !== `${conversation.id}:${initialMessage}`) {
      initialMessageSentRef.current = `${conversation.id}:${initialMessage}`;
      const timer = setTimeout(() => handleSendRef.current(initialMessage), 150);
      return () => clearTimeout(timer);
    }
  }, [conversation.id, initialMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: Attachment[] = await Promise.all(
      Array.from(files).map(
        (file) =>
          new Promise<Attachment>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = (reader.result as string).split(",")[1] || "";
              resolve({
                type: "file" as const,
                path: file.name,
                displayName: file.name,
                content: base64,
              });
            };
            reader.readAsDataURL(file);
          })
      )
    );
    setAttachments((prev) => [...prev, ...newAttachments]);
    // Reset the input so the same file can be selected again
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUserInputSubmit = async (answer: string) => {
    if (!userInputPrompt) return;
    try {
      await respondToUserInput(conversation.id, userInputPrompt.requestId, answer);
    } catch (err) {
      console.error("Failed to respond to user input:", err);
    }
    setUserInputPrompt(null);
    setUserInputAnswer("");
  };

  return (
    <div className="flex flex-col h-full bg-surface-50 dark:bg-navy-950">
      {/* Header */}
      <header className="border-b border-slate-200/80 dark:border-white/[0.06] px-6 py-3 bg-white/80 dark:bg-navy-900/80 backdrop-blur-lg sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-5xl mx-auto">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                {conversation.title}
              </h2>
              {conversation.useCase && conversation.useCase !== "generic" && (
                <span className="text-[11px] px-2.5 py-0.5 bg-gradient-to-r from-primary-50 to-accent-50 text-accent-700 rounded-full font-medium border border-accent-200 flex-shrink-0">
                  {conversation.useCase.replace(/-/g, " ")}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Powered by GitHub Copilot SDK &amp; Microsoft Foundry
            </p>
          </div>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-5">
          {messages.map((msg) => (
            <div key={msg.id}>
              <MessageBubble message={msg} />
              {/* Show persisted execution details below each assistant message */}
              {msg.role === "assistant" && messageStats[msg.id] && (
                <div className="mt-2 ml-11">
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
            <div className="ml-11">
              <ThoughtChain
                thoughts={thoughts}
                toolCalls={activeToolCalls}
                isStreaming={true}
                runStats={runStats}
              />
            </div>
          )}

          {/* User input request from agent */}
          {userInputPrompt && (
            <div className="ml-11 bg-amber-50/80 border border-amber-200/80 rounded-xl p-4 max-w-2xl backdrop-blur-sm">
              <p className="text-sm font-medium text-amber-800 mb-3">
                {userInputPrompt.question}
              </p>
              {userInputPrompt.choices.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {userInputPrompt.choices.map((choice) => (
                    <button
                      key={choice}
                      onClick={() => handleUserInputSubmit(choice)}
                      className="px-3.5 py-1.5 text-sm bg-white border border-amber-300/80 rounded-lg hover:bg-amber-100 transition-all duration-150 shadow-sm"
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              )}
              {userInputPrompt.allowFreeform && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={userInputAnswer}
                    onChange={(e) => setUserInputAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && userInputAnswer.trim()) {
                        handleUserInputSubmit(userInputAnswer.trim());
                      }
                    }}
                    placeholder="Type your answer..."
                    className="flex-1 text-sm border border-amber-300/80 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400/50 bg-white"
                  />
                  <button
                    onClick={() => handleUserInputSubmit(userInputAnswer.trim())}
                    disabled={!userInputAnswer.trim()}
                    className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Attachment pills */}
      {attachments.length > 0 && (
        <div className="px-4">
          <div className="max-w-5xl mx-auto px-2 py-2 flex flex-wrap gap-2">
            {attachments.map((att, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] rounded-lg shadow-sm animate-fade-in"
              >
                <svg className="w-3.5 h-3.5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="text-slate-600 dark:text-slate-300 font-medium">{att.displayName || ("path" in att ? att.path : "")}</span>
                <button
                  onClick={() => removeAttachment(idx)}
                  className="ml-0.5 text-slate-400 hover:text-red-400 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 pb-5 pt-2">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-end gap-2 bg-white dark:bg-navy-800 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-glass dark:shadow-none px-3 py-2 focus-within:border-primary-300 dark:focus-within:border-primary-500/50 focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all duration-200">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              title="Attach files"
              className="p-2 text-slate-400 hover:text-primary-500 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Kratos anything..."
              rows={1}
              disabled={isStreaming}
              className="flex-1 resize-none text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-transparent border-none focus:outline-none focus:ring-0 py-2 px-1 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: "36px", maxHeight: "200px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 200) + "px";
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={isStreaming || !input.trim()}
              className="p-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow-md disabled:shadow-none"
            >
              {isStreaming ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 mt-2">
            Kratos may produce inaccurate information. Verify important details.
          </p>
        </div>
      </div>
    </div>
  );
}
