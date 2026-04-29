export interface Conversation {
  id: string;
  title: string;
  useCase: string;
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
  metadata?: {
    thoughts?: string[];
    toolCalls?: ToolCallInfo[];
    runStats?: RunStats;
  };
  attachments?: Attachment[];
  createdAt: string;
}

export interface ToolCallInfo {
  skillName: string;
  status: "started" | "completed" | "failed";
  input?: string;
  output?: string;
  durationMs?: number;
  source?: string; // "local" | "blob" | "apm:<package>" | ""
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
  source?: string;
}

export interface ContentEvent {
  type: "content";
  content: string;
}

export interface UsageEvent {
  type: "usage";
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

export interface DoneEvent {
  type: "done";
  conversationId: string;
  totalDurationMs: number;
  totalToolCalls: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  timeToFirstTokenMs: number;
  modelLatencyMs: number;
}

export interface ErrorEvent {
  type: "error";
  message: string;
  code: string;
}

export interface UserInputRequestEvent {
  type: "user_input_request";
  requestId: string;
  question: string;
  choices: string[];
  allowFreeform: boolean;
}

export interface FollowUpQuestionsEvent {
  type: "follow_up_questions";
  questions: string[];
}

// ─── Attachments ───

export interface FileAttachment {
  type: "file";
  path: string;
  displayName: string;
  content?: string; // base64-encoded file content
}

export interface DirectoryAttachment {
  type: "directory";
  path: string;
  displayName: string;
}

export interface SelectionAttachment {
  type: "selection";
  filePath: string;
  displayName: string;
  text: string;
}

export type Attachment = FileAttachment | DirectoryAttachment | SelectionAttachment;

export interface RunStats {
  totalDurationMs: number;
  totalToolCalls: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
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
  | ErrorEvent
  | UserInputRequestEvent
  | FollowUpQuestionsEvent;

// ─── Skills Admin ───

export interface SkillFile {
  path: string;
  name: string;
  content: string;
}

export interface Skill {
  name: string;
  description: string;
  enabled: boolean;
  instructions: string;
  toolName: string;
  fileCount?: number;
  source?: string; // "local" | "blob" | "apm:<package>"
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

// ─── Use Cases ───

export interface UseCase {
  name: string;
  displayName: string;
  description: string;
  skillCount: number;
  sampleQuestions: string[];
}

// ─── MCP Servers Admin ───

export interface MCPLocalServer {
  type: "local";
  command: string;
  args?: string[];
  tools?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface MCPRemoteServer {
  type: "http" | "sse";
  url: string;
  tools?: string[];
  headers?: Record<string, string>;
  timeout?: number;
}

export type MCPServerConfig = MCPLocalServer | MCPRemoteServer;

export interface MCPConfig {
  servers: Record<string, MCPServerConfig>;
  sources?: Record<string, string>;
}

// ─── Consistency Analysis ───

export interface AnalysisIssue {
  severity: "critical" | "warning" | "info";
  category: "contradiction" | "overlap" | "gap" | "terminology" | "tone" | "ambiguity" | "unused";
  title: string;
  description: string;
  affectedSkills: string[];
  recommendation: string;
}

export interface AnalysisResult {
  summary: string;
  overallScore: number;
  issues: AnalysisIssue[];
  strengths: string[];
  durationMs: number;
}

// ─── Apply Fix ───

export interface FixChange {
  target: string;
  changeType: "modified" | "disabled";
  summary: string;
}

export interface ApplyFixResult {
  success: boolean;
  changes: FixChange[];
  error: string;
}

// ─── APM (Agent Package Manager) Admin ───

export interface ApmDependency {
  name: string;
  ref: string | null;
  resolved: string | null;
  source: string;
}

export interface ApmMcpServer {
  name: string;
  transport: string;
  command?: string | null;
  args?: string[];
  url?: string | null;
  env?: Record<string, string>;
  registry?: boolean;
}

export interface ApmStatusResponse {
  dependencies: ApmDependency[];
  materialised_skill_dirs: string[];
  mcp_servers?: ApmMcpServer[];
  version: string;
}

export interface ApmCommandResponse {
  success: boolean;
  returncode: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
  dependencies: ApmDependency[];
}
