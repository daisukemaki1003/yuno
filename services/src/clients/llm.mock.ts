import type { LLMClient, LLMCompletionRequest, LLMCompletionResponse } from "./llm.client.js";

function extractTranscript(messages: LLMCompletionRequest["messages"]): string {
  const userMessage = messages.find((message) => message.role === "user")?.content ?? "";
  const match = userMessage.match(/transcript:\s*\|\s*\n([\s\S]*)/);
  if (!match) {
    return "";
  }

  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

export class MockLLMClient implements LLMClient {
  async completeJson(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const transcript = extractTranscript(request.messages);
    const summary = transcript.slice(0, 120) || "会話内容が空でした。";

    const payload = {
      summaries: [summary],
      actions: [],
      decisions: [],
      questions: [],
    } satisfies Record<string, unknown>;

    return {
      outputText: JSON.stringify(payload),
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
  }
}
