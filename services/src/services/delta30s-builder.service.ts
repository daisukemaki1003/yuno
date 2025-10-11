import { MINUTES_FINAL_CONFIG } from "@/configs/minutes-final.config.js";
import { FILLER_WORDS } from "@/configs/minutes.config.js";
import type { LLMClient } from "@/clients/llm.client.js";
import {
  DEFAULT_LANGUAGE,
  type Delta30s,
  Delta30sSchema,
  type Delta30sWindow,
} from "@/domain/minutes/delta30s.schema.js";
import { Logger } from "@/utils/logger.js";

const SYSTEM_PROMPT = `あなたはリアルタイム議事録の要約エージェントです。入力は30秒間の文字起こし（transcript）です。\nあなたの唯一の出力は「厳密なJSON」です。JSON以外の文字・注釈・説明は一切出力しないでください。\n生成ルール:\n- summaries: 30秒内の主要トピックを1文=1要点で要約（短文・具体）。\n- actions: 実行すべきタスクのみ。命令形は不可。「誰が」「何を」「いつ」を可能な限り抽出。\n- decisions: 明確に合意/確定した事項のみ。\n- questions: 具体的な未解決の疑問/確認事項のみ。\n- 重複を削除。固有名/日付は正規化（dueはYYYY-MM-DD）。\n- 事実にない推測は書かない。聞き取れない/曖昧は含めない。\n出力制約:\n- 出力は有効なJSONのみ。キー順は問わないが、スキーマに厳密に従うこと。\n- 空集合は省略せず空配列で返すこと（actions/decisions/questions）。`;

const DEVELOPER_PROMPT = `Delta30s = {\n  summaries: string[];            // min:1\n  actions: { task:string; owner?:string; due?:string; confidence?:number; }[];\n  decisions: { summary:string; decider?:string; }[];\n  questions: { question:string; asked_by?:string; }[];\n}\n\nバリデーション要件:\n- summaries.length >= 1\n- confidenceは0..1\n- dueは^\\d{4}-\\d{2}-\\d{2}$\n- actions/decisions/questionsは常に配列で返す（0件可、null/undefined不可）\n\nモデル制御:\n- temperature: 0.2\n- max_tokens: 400\n- 禁止: JSON外のテキスト、凡例の挿入、コードフェンス`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summaries: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: MINUTES_FINAL_CONFIG.MAX_SUMMARIES,
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          task: { type: "string" },
          owner: { type: "string" },
          due: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["task"],
      },
      maxItems: MINUTES_FINAL_CONFIG.MAX_ACTIONS,
    },
    decisions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          summary: { type: "string" },
          decider: { type: "string" },
        },
        required: ["summary"],
      },
      maxItems: MINUTES_FINAL_CONFIG.MAX_DECISIONS,
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question: { type: "string" },
          asked_by: { type: "string" },
        },
        required: ["question"],
      },
      maxItems: MINUTES_FINAL_CONFIG.MAX_QUESTIONS,
    },
  },
  required: ["summaries", "actions", "decisions", "questions"],
} as const;

export interface BuildDelta30sParams {
  meetingId: string;
  window: Delta30sWindow;
  transcript: string;
  language?: string;
  logger?: Logger;
}

export class InsufficientTranscriptError extends Error {
  constructor(public readonly length: number) {
    super("Transcript does not meet minimum length requirement");
    this.name = "InsufficientTranscriptError";
  }
}

export class Delta30sGenerationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "Delta30sGenerationError";
  }
}

export class Delta30sBuilderService {
  constructor(private readonly llmClient: LLMClient) {}

  async build(params: BuildDelta30sParams): Promise<Delta30s> {
    const language = params.language ?? DEFAULT_LANGUAGE;
    const logger = params.logger ?? new Logger(`delta30s-${params.meetingId}`);
    const transcript = this.normalizeTranscript(params.transcript);

    if (transcript.length < MINUTES_FINAL_CONFIG.MIN_DELTA_CHARS) {
      logger.warn("Transcript too short for Delta30s generation", {
        meeting_id: params.meetingId,
        window: params.window,
        length: transcript.length,
      });
      throw new InsufficientTranscriptError(transcript.length);
    }

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      { role: "developer" as const, content: DEVELOPER_PROMPT },
      {
        role: "user" as const,
        content: this.buildUserPrompt(params.meetingId, params.window, language, transcript),
      },
    ];

    logger.info("Requesting Delta30s generation", {
      meeting_id: params.meetingId,
      window: params.window,
      language,
    });

    const maxAttempts = MINUTES_FINAL_CONFIG.LLM_RETRY_LIMIT + 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.llmClient.completeJson({
          model: MINUTES_FINAL_CONFIG.LLM_MODEL,
          temperature: 0.2,
          maxOutputTokens: 400,
          messages,
          responseFormat: {
            type: "json_schema",
            json_schema: {
              name: "Delta30s",
              schema: RESPONSE_SCHEMA,
            },
          },
        });

        const delta = this.parseAndSanitise(response.outputText);

        logger.info("Delta30s generated", {
          meeting_id: params.meetingId,
          window: params.window,
          usage: response.tokenUsage,
          summaries: delta.summaries.length,
          actions: delta.actions.length,
          decisions: delta.decisions.length,
          questions: delta.questions.length,
        });

        return delta;
      } catch (error) {
        lastError = error;
        logger.warn("Delta30s generation attempt failed", {
          meeting_id: params.meetingId,
          window: params.window,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    throw new Delta30sGenerationError(`Failed to generate Delta30s after ${maxAttempts} attempts`, {
      cause: lastError,
    });
  }

  private normalizeTranscript(transcript: string): string {
    const compact = transcript
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ");

    const withoutFillers = FILLER_WORDS.reduce((acc, filler) => {
      const pattern = new RegExp(filler, "g");
      return acc.replace(pattern, "");
    }, compact);

    return withoutFillers.replace(/\s+/g, " ").trim();
  }

  private buildUserPrompt(
    meetingId: string,
    window: Delta30sWindow,
    language: string,
    transcript: string
  ): string {
    return `# Inputs\nmeeting_id: ${meetingId}\nwindow: ${window.start}/${
      window.end
    }\nlanguage: ${language}\ntranscript: |\n  ${transcript.replace(
      /\n/g,
      "\n  "
    )}\n\n# Task\n上記transcriptの30秒分だけを要約し、Delta30s(JSON)を出力してください。\n\n# Output JSON Schema\n{\n  "summaries": "string[] (必須, 要点1文/行, 最小1)",\n  "actions":   "[{ task:string (必須); owner?:string; due?:YYYY-MM-DD; confidence?:0..1 }]",\n  "decisions": "[{ summary:string (必須); decider?:string }]",\n  "questions": "[{ question:string (必須); asked_by?:string }]"\n}\n\n# Constraints\n- 必ず有効なJSONのみを出力すること。\n- 30秒ウィンドウ外の情報は含めない。\n- 曖昧・ノイズは除外。重複統合。`;
  }

  private parseAndSanitise(raw: string): Delta30s {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Delta30sGenerationError("LLM response was not valid JSON", {
        cause: error instanceof Error ? error : undefined,
      });
    }

    const delta = Delta30sSchema.parse(parsed);

    return {
      summaries: this.uniqueStrings(delta.summaries).slice(0, MINUTES_FINAL_CONFIG.MAX_SUMMARIES),
      actions: this.uniqueActions(delta.actions).slice(0, MINUTES_FINAL_CONFIG.MAX_ACTIONS),
      decisions: this.uniqueDecisions(delta.decisions).slice(0, MINUTES_FINAL_CONFIG.MAX_DECISIONS),
      questions: this.uniqueQuestions(delta.questions).slice(0, MINUTES_FINAL_CONFIG.MAX_QUESTIONS),
    };
  }

  private uniqueStrings(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
      const normalized = value.trim();
      if (!normalized) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(normalized);
    }
    return result;
  }

  private uniqueActions(actions: Delta30s["actions"]): Delta30s["actions"] {
    const seen = new Set<string>();
    const result: Delta30s["actions"] = [];

    for (const action of actions) {
      const normalizedTask = action.task.trim();
      if (!normalizedTask) {
        continue;
      }
      const owner = action.owner?.trim();
      const due = action.due ?? "";
      const key = `${normalizedTask.toLowerCase()}|${owner?.toLowerCase() ?? ""}|${due}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push({
        task: normalizedTask,
        owner: owner || undefined,
        due: action.due,
        confidence: action.confidence,
      });
    }

    return result;
  }

  private uniqueDecisions(decisions: Delta30s["decisions"]): Delta30s["decisions"] {
    const seen = new Set<string>();
    const result: Delta30s["decisions"] = [];

    for (const decision of decisions) {
      const summary = decision.summary.trim();
      if (!summary) {
        continue;
      }
      const key = summary.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push({ summary, decider: decision.decider?.trim() || undefined });
    }

    return result;
  }

  private uniqueQuestions(questions: Delta30s["questions"]): Delta30s["questions"] {
    const seen = new Set<string>();
    const result: Delta30s["questions"] = [];

    for (const question of questions) {
      const normalized = question.question.trim();
      if (!normalized) {
        continue;
      }
      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push({ question: normalized, asked_by: question.asked_by?.trim() || undefined });
    }

    return result;
  }
}
