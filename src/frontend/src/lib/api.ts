const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

    const response = await fetch(`${API_URL}/api/agent/chat`, {
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
  const response = await fetch(`${API_URL}/api/conversations`, {
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
  const response = await fetch(`${API_URL}/api/agent/user-input`, {
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
    `${API_URL}/api/conversations/${encodeURIComponent(conversationId)}`,
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
    `${API_URL}/api/conversations/${encodeURIComponent(conversationId)}`,
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
  const response = await fetch(`${API_URL}/api/conversations`);
  if (!response.ok) {
    throw new Error(`Failed to list conversations: ${response.status}`);
  }
  return response.json();
}

/**
 * Get messages for a conversation.
 */
export async function getConversationMessages(conversationId: string): Promise<unknown[]> {
  const response = await fetch(`${API_URL}/api/conversations/${encodeURIComponent(conversationId)}/messages`);
  if (!response.ok) {
    throw new Error(`Failed to get messages: ${response.status}`);
  }
  return response.json();
}

// ─── Use Cases API ───

import type { UseCase } from "@/types";

export async function listUseCases(): Promise<UseCase[]> {
  const response = await fetch(`${API_URL}/api/use-cases`);
  if (!response.ok) throw new Error(`Failed to list use-cases: ${response.status}`);
  const data = await response.json();
  return data.useCases;
}

// ─── Skills Admin API ───

import type { Skill, SkillCreate, SkillUpdate } from "@/types";

export async function listSkills(useCase: string = "generic"): Promise<Skill[]> {
  const response = await fetch(`${API_URL}/api/admin/skills?use_case=${encodeURIComponent(useCase)}`);
  if (!response.ok) throw new Error(`Failed to list skills: ${response.status}`);
  const data = await response.json();
  return data.skills;
}

export async function getSkill(name: string, useCase: string = "generic"): Promise<Skill> {
  const response = await fetch(`${API_URL}/api/admin/skills/${encodeURIComponent(name)}?use_case=${encodeURIComponent(useCase)}`);
  if (!response.ok) throw new Error(`Failed to get skill: ${response.status}`);
  return response.json();
}

export async function createSkill(skill: SkillCreate, useCase: string = "generic"): Promise<Skill> {
  const response = await fetch(`${API_URL}/api/admin/skills?use_case=${encodeURIComponent(useCase)}`, {
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
  const response = await fetch(`${API_URL}/api/admin/skills/${encodeURIComponent(name)}?use_case=${encodeURIComponent(useCase)}`, {
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
  const response = await fetch(`${API_URL}/api/admin/skills/${encodeURIComponent(name)}?use_case=${encodeURIComponent(useCase)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to delete skill: ${response.status}`);
  }
}

// ─── System Prompt Admin API ───

import type { SystemPrompt } from "@/types";

export async function getSystemPrompt(): Promise<SystemPrompt> {
  const response = await fetch(`${API_URL}/api/admin/system-prompt`);
  if (!response.ok) throw new Error(`Failed to get system prompt: ${response.status}`);
  return response.json();
}

export async function updateSystemPrompt(content: string): Promise<SystemPrompt> {
  const response = await fetch(`${API_URL}/api/admin/system-prompt`, {
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

export async function resetSystemPrompt(): Promise<void> {
  const response = await fetch(`${API_URL}/api/admin/system-prompt`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to reset system prompt: ${response.status}`);
  }
}
