import { describe, expect, it } from "@jest/globals";
import {
  CurrentSectionListSchema,
  Delta30sSchema,
  MinutesActionSchema,
  SectionSchema,
  SectionUpdateResponseSchema,
} from "../../src/domain/minutes/index.js";

describe("minutes domain schemas", () => {
  it("accepts a well-formed Delta30s payload", () => {
    const result = Delta30sSchema.parse({
      summaries: ["次回レビューで最終版を確定する"],
      actions: [
        {
          task: "レビュー資料をアップデートする",
          owner: "佐藤",
          due: "2025-10-12",
          confidence: 0.8,
        },
      ],
      decisions: [
        {
          summary: "公開日は10/15で合意",
          decider: "全員",
        },
      ],
      questions: [
        {
          question: "法務レビューの担当は誰か?",
          asked_by: "田中",
        },
      ],
    });

    expect(result.summaries).toHaveLength(1);
    expect(result.actions[0].task).toBe("レビュー資料をアップデートする");
  });

  it("rejects actions with invalid due date format", () => {
    expect(() =>
      MinutesActionSchema.parse({
        task: "締切の再調整",
        due: "21-09-2025",
      })
    ).toThrow("Invalid date format");
  });

  it("disallows closed sections inside CurrentSectionList", () => {
    expect(() =>
      CurrentSectionListSchema.parse({
        meeting_id: "mtg-1",
        sections: [
          {
            id: "sec-1",
            title: "公開スケジュール",
            summary: "公開日を確定",
            status: "closed",
          },
        ],
      })
    ).toThrow();
  });

  it("validates SectionUpdateResponse with optional lists", () => {
    const response = SectionUpdateResponseSchema.parse({
      meeting_id: "mtg-1",
      changed_sections: [
        SectionSchema.parse({
          id: "sec-new",
          title: "新規タスク",
          summary: "資料更新タスクを追加",
          status: "active",
          actions: [
            {
              task: "資料更新",
            },
          ],
        }),
      ],
      change_summary: {
        created_sections: ["sec-new"],
        updated_sections: [],
        closed_sections: [],
      },
    });

    expect(response.change_summary.created_sections).toEqual(["sec-new"]);
    expect(response.changed_sections[0].actions).toHaveLength(1);
  });
});
