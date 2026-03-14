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

export interface UsageEvent {
  type: "usage";
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface DoneEvent {
  type: "done";
  conversationId: string;
  totalDurationMs: number;
  totalToolCalls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timeToFirstTokenMs: number;
  modelLatencyMs: number;
}

export interface ErrorEvent {
  type: "error";
  message: string;
  code: string;
}

export interface RunStats {
  totalDurationMs: number;
  totalToolCalls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timeToFirstTokenMs: number;
  modelLatencyMs: number;
}

export type AgentEvent =
  | ThoughtEvent
  | ToolCallEvent
  | ContentEvent
  | UsageEvent
  | DoneEvent
  | ErrorEvent;

// ─── Skills Admin ───

export interface Skill {
  name: string;
  description: string;
  enabled: boolean;
  instructions: string;
  toolName: string;
}

export interface SkillCreate {
  name: string;
  description: string;
  enabled: boolean;
  instructions: string;
}

export interface SkillUpdate {
  description?: string;
  enabled?: boolean;
  instructions?: string;
}

// ─── System Prompt Admin ───

export interface SystemPrompt {
  content: string;
  isDefault: boolean;
}
