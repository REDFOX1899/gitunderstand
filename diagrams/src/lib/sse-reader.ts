export interface SSEEvent {
  type: string;
  payload: Record<string, unknown>;
}

export async function readSSEStream(
  url: string,
  body: unknown,
  onEvent: (event: SSEEvent) => void,
  onError: (error: Error) => void,
): Promise<void> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let data: Record<string, unknown> = {};
      try {
        data = (await response.json()) as Record<string, unknown>;
      } catch {
        /* empty */
      }
      let errMsg =
        (data.error as string) ?? (data.detail as string) ?? "Request failed";
      if (response.status === 429) {
        errMsg =
          "Rate limit exceeded. Please wait a moment before trying again.";
      }
      onEvent({ type: "error", payload: { message: errMsg, error: errMsg } });
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError(new Error("No response body reader available"));
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const eventStr of events) {
          if (!eventStr.trim()) continue;
          const lines = eventStr.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const sseEvent = JSON.parse(line.slice(6)) as SSEEvent;
                onEvent(sseEvent);
              } catch (e) {
                console.error("Failed to parse SSE event:", e, line);
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
