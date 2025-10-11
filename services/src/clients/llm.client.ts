export type LLMRole = "system" | "developer" | "user";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMJsonSchemaFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    schema: Record<string, unknown>;
  };
}

export interface LLMCompletionRequest {
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  messages: LLMMessage[];
  responseFormat: LLMJsonSchemaFormat;
}

export interface LLMCompletionResponse {
  outputText: string;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export interface LLMClient {
  completeJson(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
}

export class LLMClientError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "LLMClientError";
  }
}
