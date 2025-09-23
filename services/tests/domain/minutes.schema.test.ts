import { describe, it, expect } from "@jest/globals";
import {
  Delta30sSchema,
  MinutesActionSchema,
  SectionInputSchema,
  SectionOutputSchema,
  SectionUpdateResponseSchema,
} from "../../src/domain/minutes/index.js";

describe("minutes domain schemas", () => {
  it("accepts a well-formed Delta30s payload", () => {
    const result = Delta30sSchema.parse({
      summaries: ["公開最終版は来週水曜に確定"],
      actions: [
        {
          task: "Figma 資料を最新化して共有",
          owner: "",
          due: null,
          confidence: 0.9,
        },
      ],
      decisions: [
        {
          what: "公開日を来週水曜に決定",
          reason: "上申が承認されたため",
        },
      ],
      questions: [
        {
          topic: "最終承認者の確認",
          related_section_id: "sec_publish",
          priority: "mid",
          confidence: 0.42,
        },
      ],
    });

    expect(result.summaries).toHaveLength(1);
    expect(result.actions[0].due).toBeNull();
  });

  it("rejects actions with invalid due date format", () => {
    expect(() =>
      MinutesActionSchema.parse({
        task: "締切の再調整",
        due: "21-09-2025",
      })
    ).toThrow("Invalid date format");
  });

  it("enforces input and output section status enum boundaries", () => {
    expect(() =>
      SectionInputSchema.parse({
        id: "sec-1",
        title: "公開スケジュール",
        status: "closed",
        bullets: ["タイムラインを整理"],
      })
    ).toThrow();

    const output = SectionOutputSchema.parse({
      id: "sec-1",
      title: "公開スケジュール",
      status: "closed",
      bullets: ["タイムラインを整理"],
      actions: [],
    });

    expect(output.status).toBe("closed");
  });

  it("requires change summary arrays in SectionUpdateResponse", () => {
    const response = SectionUpdateResponseSchema.parse({
      meeting_id: "mtg-1",
      changed_sections: [
        {
          id: "sec-new",
          title: "新規タスク",
          status: "active",
          bullets: ["メモを追加"],
          actions: [],
        },
      ],
      change_summary: {
        created_sections: ["sec-new"],
        updated_sections: [],
        closed_sections: [],
      },
    });

    expect(response.change_summary.created_sections).toEqual(["sec-new"]);
  });
});
