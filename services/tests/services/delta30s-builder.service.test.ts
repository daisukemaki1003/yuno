import { describe, expect, it } from "@jest/globals";
import type { LLMClient, LLMCompletionRequest, LLMCompletionResponse } from "../../src/clients/llm.client.js";
import { Delta30sBuilderService, InsufficientTranscriptError } from "../../src/services/delta30s-builder.service.js";
import type { Delta30sWindow } from "../../src/domain/minutes/delta30s.schema.js";
import { Logger } from "../../src/utils/logger.js";

class StubLLMClient implements LLMClient {
  private responses: string[];
  public calls: number = 0;

  constructor(responses: string[]) {
    this.responses = responses;
  }

  async completeJson(_request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const response = this.responses[Math.min(this.calls, this.responses.length - 1)];
    this.calls += 1;
    return { outputText: response };
  }
}

const window: Delta30sWindow = {
  start: "2025-10-11T12:00:00Z",
  end: "2025-10-11T12:00:30Z",
};

const transcript = Array(10)
  .fill("次回の会議について詳細を整理しながら議題をまとめる作業を進めています。")
  .join(" ");

describe("Delta30sBuilderService", () => {
  it("parses, sanitises, and deduplicates Delta30s output", async () => {
    const llmClient = new StubLLMClient([
      JSON.stringify({
        summaries: ["計画の共有", "計画の共有"],
        actions: [
          { task: "タスクを実行", owner: "  佐藤  " },
          { task: "タスクを実行", owner: "佐藤" },
        ],
        decisions: [
          { summary: "リリース日を決定" },
          { summary: "リリース日を決定" },
        ],
        questions: [
          { question: "テスト担当は誰か?" },
          { question: "テスト担当は誰か?" },
        ],
      }),
    ]);

    const service = new Delta30sBuilderService(llmClient);
    const logger = new Logger("delta30s-test", { color: false });

    const delta = await service.build({
      meetingId: "mtg-1",
      window,
      transcript,
      language: "ja",
      logger,
    });

    expect(delta.summaries).toEqual(["計画の共有"]);
    expect(delta.actions).toHaveLength(1);
    expect(delta.actions[0].owner).toBe("佐藤");
    expect(delta.decisions).toHaveLength(1);
    expect(delta.questions).toHaveLength(1);
  });

  it("retries once when LLM output is invalid JSON", async () => {
    const responses = ["not-json", JSON.stringify({ summaries: ["要約"], actions: [], decisions: [], questions: [] })];
    const llmClient = new StubLLMClient(responses);
    const service = new Delta30sBuilderService(llmClient);

    const delta = await service.build({
      meetingId: "mtg-2",
      window,
      transcript,
      logger: new Logger("delta30s-retry", { color: false }),
    });

    expect(delta.summaries).toEqual(["要約"]);
    expect(llmClient.calls).toBe(2);
  });

  it("throws when transcript is shorter than minimum threshold", async () => {
    const llmClient = new StubLLMClient(["{}"]);
    const service = new Delta30sBuilderService(llmClient);

    await expect(
      service.build({
        meetingId: "mtg-3",
        window,
        transcript: "短い",
      })
    ).rejects.toBeInstanceOf(InsufficientTranscriptError);
  });
});
