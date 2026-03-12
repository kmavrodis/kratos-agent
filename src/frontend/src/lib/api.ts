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
