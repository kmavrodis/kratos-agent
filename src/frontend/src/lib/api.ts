const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Send a message to the agent and receive streaming SSE events.
 */
export async function streamAgentChat(
  conversationId: string,
  message: string,
  onEvent: (event: { type: string; data: unknown }) => void,
  onError: (error: Error) => void,
  onDone: () => void
): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, message }),
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
  title: string = "New Conversation"
): Promise<{ id: string; title: string }> {
  const response = await fetch(`${API_URL}/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create conversation: ${response.status}`);
  }

  return response.json();
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

// ─── Skills Admin API ───

import type { Skill, SkillCreate, SkillUpdate } from "@/types";

export async function listSkills(): Promise<Skill[]> {
  const response = await fetch(`${API_URL}/api/admin/skills`);
  if (!response.ok) throw new Error(`Failed to list skills: ${response.status}`);
  const data = await response.json();
  return data.skills;
}

export async function getSkill(name: string): Promise<Skill> {
  const response = await fetch(`${API_URL}/api/admin/skills/${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error(`Failed to get skill: ${response.status}`);
  return response.json();
}

export async function createSkill(skill: SkillCreate): Promise<Skill> {
  const response = await fetch(`${API_URL}/api/admin/skills`, {
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

export async function updateSkill(name: string, updates: SkillUpdate): Promise<Skill> {
  const response = await fetch(`${API_URL}/api/admin/skills/${encodeURIComponent(name)}`, {
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

export async function deleteSkill(name: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/admin/skills/${encodeURIComponent(name)}`, {
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
