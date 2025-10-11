import { describe, expect, it } from "@jest/globals";
import { SectionDiffService } from "../../src/services/section-diff.service.js";
import type {
  CurrentSectionList,
  Delta30s,
} from "../../src/domain/minutes/index.js";

const service = new SectionDiffService();

describe("SectionDiffService", () => {
  it("updates existing section when summary matches and appends actions", () => {
    const current: CurrentSectionList = {
      meeting_id: "mtg-1",
      sections: [
        {
          id: "sec-progress",
          title: "進捗確認",
          summary: "進捗報告と課題整理",
          status: "active",
          actions: [
            {
              task: "週次レポートを送付",
            },
          ],
        },
      ],
    };

    const delta: Delta30s = {
      summaries: ["進捗報告でレビュー日程を決定"],
      actions: [
        {
          task: "レビュー日程を共有する",
          owner: "佐藤",
        },
      ],
      decisions: [],
      questions: [],
    };

    const response = service.diff("mtg-1", delta, current);

    expect(response.meeting_id).toBe("mtg-1");
    expect(response.change_summary.updated_sections).toContain("sec-progress");

    const updated = response.changed_sections.find((section) => section.id === "sec-progress");
    expect(updated).toBeDefined();
    expect(updated?.summary).toBe("進捗報告でレビュー日程を決定");
    expect(updated?.actions?.some((action) => action.task === "レビュー日程を共有する")).toBe(true);
  });

  it("creates new section when no existing section matches", () => {
    const current: CurrentSectionList = { meeting_id: "mtg-2", sections: [] };

    const delta: Delta30s = {
      summaries: ["QAチームで追加シナリオを実装"],
      actions: [
        {
          task: "テストケース一覧をNotionに追記",
          owner: "田中",
        },
      ],
      decisions: [
        {
          summary: "リリース判定会を木曜に開催",
        },
      ],
      questions: [
        {
          question: "自動テストのカバレッジは十分か?",
        },
      ],
    };

    const response = service.diff("mtg-2", delta, current);

    expect(response.change_summary.created_sections).toHaveLength(1);
    const createdId = response.change_summary.created_sections[0];
    const created = response.changed_sections.find((section) => section.id === createdId);
    expect(created).toBeDefined();
    expect(created?.summary).toBe("QAチームで追加シナリオを実装");
    expect(created?.actions?.[0].owner).toBe("田中");
    expect(created?.decisions?.[0].summary).toContain("リリース判定会");
    expect(created?.questions?.[0].question).toContain("自動テスト");
  });

  it("deduplicates identical actions based on task/owner/due", () => {
    const current: CurrentSectionList = {
      meeting_id: "mtg-3",
      sections: [
        {
          id: "sec-ops",
          title: "運用準備",
          summary: "タスク整理",
          status: "active",
        },
      ],
    };

    const delta: Delta30s = {
      summaries: ["本番リリース準備を進める"],
      actions: [
        { task: "チェックリストを更新", owner: "田中" },
        { task: "チェックリストを更新", owner: "田中" },
      ],
      decisions: [],
      questions: [],
    };

    const response = service.diff("mtg-3", delta, current);

    const target = response.changed_sections.find(
      (section) => section.summary === "本番リリース準備を進める"
    );
    expect(target?.actions ?? []).toHaveLength(1);
  });
});
