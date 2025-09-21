// Firebase AI SDK を型エラーなく使うための最小限の定義
declare module "firebase/app" {
  export interface FirebaseApp {}
  export function initializeApp(options: Record<string, unknown>): FirebaseApp;
}

declare module "firebase/ai" {
  export type SchemaValue = unknown;

  export const Schema: {
    object: (definition: Record<string, unknown>) => SchemaValue;
    array: (definition: Record<string, unknown>) => SchemaValue;
    string: () => SchemaValue;
  };

  export class GoogleAIBackend {
    constructor(options: { apiKey: string });
  }

  export interface GenerativeContentPart {
    text?: string;
  }

  export interface GenerativeContent {
    parts?: GenerativeContentPart[];
  }

  export interface GenerativeCandidate {
    content?: GenerativeContent;
  }

  export interface GenerativeResponse {
    text(): string | null;
    candidates?: GenerativeCandidate[];
  }

  export interface GenerativeModelResult {
    response: GenerativeResponse;
  }

  export interface GenerativeModel {
    generateContent(prompt: string): Promise<GenerativeModelResult>;
  }

  export function getAI(app: unknown, options: { backend: GoogleAIBackend }): unknown;
  export function getGenerativeModel(ai: unknown, options: Record<string, unknown>): GenerativeModel;
}
