export interface Conversation {
  id: string;
  title: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: ToolCallInfo[];
  thoughts?: string[];
  createdAt: string;
}

export interface ToolCallInfo {
  skillName: string;
  status: "started" | "completed" | "failed";
  input?: string;
  output?: string;
  durationMs?: number;
}

// SSE Event types from the backend
export interface ThoughtEvent {
  type: "thought";
  content: string;
  iteration: number;
}

export interface ToolCallEvent {
  type: "tool_call";
  skillName: string;
  status: string;
  input: string;
  output: string;
  durationMs: number;
}

export interface ContentEvent {
  type: "content";
  content: string;
}

export interface DoneEvent {
  type: "done";
  conversationId: string;
  totalDurationMs: number;
  totalToolCalls: number;
}

export interface ErrorEvent {
  type: "error";
  message: string;
  code: string;
}

export type AgentEvent =
  | ThoughtEvent
  | ToolCallEvent
  | ContentEvent
  | DoneEvent
  | ErrorEvent;
