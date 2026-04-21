import { getApiUrl } from "@/lib/config";
import type { Attachment } from "@/types";

/**
 * Send a message to the agent and receive streaming SSE events.
 */
export async function streamAgentChat(
  conversationId: string,
  message: string,
  onEvent: (event: { type: string; data: unknown }) => void,
  onError: (error: Error) => void,
  onDone: () => void,
  attachments?: Attachment[],
  useCase?: string
): Promise<void> {
  try {
    const payload: Record<string, unknown> = { conversationId, message };
    if (attachments && attachments.length > 0) {
      payload.attachments = attachments;
    }
    if (useCase) {
      payload.useCase = useCase;
    }

    const response = await fetch(`${getApiUrl()}/api/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Agent request failed: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          // Ignore — we extract type from the data
          continue;
        }
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            onEvent({ type: parsed.type, data: parsed });

            if (parsed.type === "done") {
              onDone();
              return;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }

    onDone();
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * Create a new conversation.
 */
export async function createConversation(
  title: string = "New Conversation",
  useCase: string = "generic"
): Promise<{ id: string; title: string; useCase: string }> {
  const response = await fetch(`${getApiUrl()}/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, useCase }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create conversation: ${response.status}`);
  }

  return response.json();
}

/**
 * Respond to a user input request from the agent.
 */
export async function respondToUserInput(
  conversationId: string,
  requestId: string,
  answer: string
): Promise<void> {
  const response = await fetch(`${getApiUrl()}/api/agent/user-input`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, requestId, answer }),
  });
  if (!response.ok) {
    throw new Error(`Failed to respond to user input: ${response.status}`);
  }
}

/**
 * Update a conversation's title.
 */
export async function updateConversation(
  conversationId: string,
  updates: { title?: string }
): Promise<void> {
  const response = await fetch(
    `${getApiUrl()}/api/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to update conversation: ${response.status}`);
  }
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  const response = await fetch(
    `${getApiUrl()}/api/conversations/${encodeURIComponent(conversationId)}`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(`Failed to delete conversation: ${response.status}`);
  }
}

/**
 * List all conversations.
 */
export async function listConversations(): Promise<{ conversations: unknown[] }> {
  const response = await fetch(`${getApiUrl()}/api/conversations`);
  if (!response.ok) {
    throw new Error(`Failed to list conversations: ${response.status}`);
  }
  return response.json();
}

/**
 * Get messages for a conversation.
 */
export async function getConversationMessages(conversationId: string): Promise<unknown[]> {
  const response = await fetch(`${getApiUrl()}/api/conversations/${encodeURIComponent(conversationId)}/messages`);
  if (!response.ok) {
    throw new Error(`Failed to get messages: ${response.status}`);
  }
  return response.json();
}

// ─── Use Cases API ───

import type { UseCase } from "@/types";

export async function listUseCases(): Promise<UseCase[]> {
  const response = await fetch(`${getApiUrl()}/api/use-cases`);
  if (!response.ok) throw new Error(`Failed to list use-cases: ${response.status}`);
  const data = await response.json();
  return data.useCases;
}

// ─── Skills Admin API ───

import type { Skill, SkillCreate, SkillUpdate } from "@/types";

export async function listSkills(useCase: string = "generic"): Promise<Skill[]> {
  const response = await fetch(`${getApiUrl()}/api/admin/skills?use_case=${encodeURIComponent(useCase)}`);
  if (!response.ok) throw new Error(`Failed to list skills: ${response.status}`);
  const data = await response.json();
  return data.skills;
}

export async function getSkill(name: string, useCase: string = "generic"): Promise<Skill> {
  const response = await fetch(`${getApiUrl()}/api/admin/skills/${encodeURIComponent(name)}?use_case=${encodeURIComponent(useCase)}`);
  if (!response.ok) throw new Error(`Failed to get skill: ${response.status}`);
  return response.json();
}

export async function createSkill(skill: SkillCreate, useCase: string = "generic"): Promise<Skill> {
  const response = await fetch(`${getApiUrl()}/api/admin/skills?use_case=${encodeURIComponent(useCase)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(skill),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to create skill: ${response.status}`);
  }
  return response.json();
}

export async function updateSkill(name: string, updates: SkillUpdate, useCase: string = "generic"): Promise<Skill> {
  const response = await fetch(`${getApiUrl()}/api/admin/skills/${encodeURIComponent(name)}?use_case=${encodeURIComponent(useCase)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update skill: ${response.status}`);
  }
  return response.json();
}

export async function deleteSkill(name: string, useCase: string = "generic"): Promise<void> {
  const response = await fetch(`${getApiUrl()}/api/admin/skills/${encodeURIComponent(name)}?use_case=${encodeURIComponent(useCase)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to delete skill: ${response.status}`);
  }
}

// ─── Skill Files API ───

import type { SkillFile } from "@/types";

export async function listSkillFiles(skillName: string, useCase: string = "generic"): Promise<{ files: SkillFile[] }> {
  const response = await fetch(
    `${getApiUrl()}/api/admin/skills/${encodeURIComponent(skillName)}/files?use_case=${encodeURIComponent(useCase)}`
  );
  if (!response.ok) throw new Error(`Failed to list skill files: ${response.status}`);
  return response.json();
}

export async function upsertSkillFile(
  skillName: string,
  filePath: string,
  content: string,
  useCase: string = "generic"
): Promise<void> {
  const response = await fetch(
    `${getApiUrl()}/api/admin/skills/${encodeURIComponent(skillName)}/files/${filePath}?use_case=${encodeURIComponent(useCase)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to upload file: ${response.status}`);
  }
}

export async function deleteSkillFile(
  skillName: string,
  filePath: string,
  useCase: string = "generic"
): Promise<void> {
  const response = await fetch(
    `${getApiUrl()}/api/admin/skills/${encodeURIComponent(skillName)}/files/${filePath}?use_case=${encodeURIComponent(useCase)}`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to delete file: ${response.status}`);
  }
}

// ─── System Prompt Admin API ───

import type { SystemPrompt } from "@/types";

export async function getSystemPrompt(useCase?: string): Promise<SystemPrompt> {
  const params = useCase ? `?use_case=${encodeURIComponent(useCase)}` : "";
  const response = await fetch(`${getApiUrl()}/api/admin/system-prompt${params}`);
  if (!response.ok) throw new Error(`Failed to get system prompt: ${response.status}`);
  return response.json();
}

export async function updateSystemPrompt(content: string, useCase?: string): Promise<SystemPrompt> {
  const params = useCase ? `?use_case=${encodeURIComponent(useCase)}` : "";
  const response = await fetch(`${getApiUrl()}/api/admin/system-prompt${params}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update system prompt: ${response.status}`);
  }
  return response.json();
}

export async function resetSystemPrompt(useCase?: string): Promise<void> {
  const params = useCase ? `?use_case=${encodeURIComponent(useCase)}` : "";
  const response = await fetch(`${getApiUrl()}/api/admin/system-prompt${params}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to reset system prompt: ${response.status}`);
  }
}

// ─── MCP Servers Admin API ───

import type { MCPConfig } from "@/types";

export async function getMCPConfig(useCase: string): Promise<MCPConfig> {
  const response = await fetch(`${getApiUrl()}/api/admin/mcp-servers?use_case=${encodeURIComponent(useCase)}`);
  if (!response.ok) throw new Error(`Failed to get MCP config: ${response.status}`);
  return response.json();
}

export async function updateMCPConfig(useCase: string, servers: MCPConfig["servers"]): Promise<MCPConfig> {
  const response = await fetch(`${getApiUrl()}/api/admin/mcp-servers?use_case=${encodeURIComponent(useCase)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ servers }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update MCP config: ${response.status}`);
  }
  return response.json();
}

// ─── Consistency Analysis API ───

import type { AnalysisResult } from "@/types";

export async function analyzeConsistency(
  useCase: string = "generic",
  includeDisabled: boolean = true
): Promise<AnalysisResult> {
  const response = await fetch(
    `${getApiUrl()}/api/admin/analysis/consistency?use_case=${encodeURIComponent(useCase)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeDisabled }),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Analysis failed: ${response.status}`);
  }
  return response.json();
}

import type { AnalysisIssue, ApplyFixResult } from "@/types";

export async function applyAnalysisFix(
  issue: AnalysisIssue,
  useCase: string = "generic"
): Promise<ApplyFixResult> {
  const response = await fetch(
    `${getApiUrl()}/api/admin/analysis/apply-fix?use_case=${encodeURIComponent(useCase)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: issue.category,
        title: issue.title,
        description: issue.description,
        recommendation: issue.recommendation,
        affectedSkills: issue.affectedSkills,
      }),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Apply fix failed: ${response.status}`);
  }
  return response.json();
}
