import { describe, it, expect } from "@jest/globals";
import { SectionDiffEngine } from "../../src/services/section-diff.service.js";
import {
  type CurrentSectionList,
  type Delta30s,
} from "../../src/domain/minutes/index.js";

const engine = new SectionDiffEngine();

describe("SectionDiffEngine", () => {
  it("updates existing section when summary matches", () => {
    const current: CurrentSectionList = {
      meeting_id: "mtg-1",
      sections: [
        {
          id: "sec_publish",
          title: "公開スケジュール",
          status: "active",
          bullets: ["公開日を最終決定"],
          actions: [
            {
              task: "公開準備を進める",
            },
          ],
        },
      ],
    };

    const delta: Delta30s = {
      summaries: ["公開スケジュールの承認を完了"],
      actions: [
        {
          task: "公開決定事項をSlackで共有してください",
        },
      ],
    };

    const response = engine.diff(current, delta);

    expect(response.meeting_id).toBe("mtg-1");
    expect(response.change_summary.created_sections).toHaveLength(0);
    expect(response.change_summary.updated_sections).toEqual(["sec_publish"]);

    const updated = response.changed_sections.find((section) => section.id === "sec_publish");
    expect(updated).toBeDefined();
    expect(updated?.bullets).toContain("公開スケジュールの承認を完了");
    expect(updated?.actions.map((action) => action.task)).toContain(
      "公開決定事項をSlackで共有してください"
    );
  });

  it("creates new section for unmatched summary and folds decisions/questions", () => {
    const current: CurrentSectionList = {
      meeting_id: "mtg-2",
      sections: [
        {
          id: "sec_design",
          title: "デザイン調整",
          status: "active",
          bullets: ["Figma 修正を依頼"],
          actions: [],
        },
      ],
    };

    const delta: Delta30s = {
      summaries: ["QA のテストケースを追加作成"],
      actions: [
        {
          task: "テストケース一覧をNotionに追記してください",
          owner: "田中",
        },
      ],
      decisions: [
        {
          what: "テスト環境を月曜にリセット",
          reason: "メンテナンス完了に合わせる",
        },
      ],
      questions: [
        {
          topic: "自動化スクリプトの担当者は?",
        },
      ],
    };

    const response = engine.diff(current, delta);

    expect(response.change_summary.created_sections).toHaveLength(1);
    const createdId = response.change_summary.created_sections[0];
    const created = response.changed_sections.find((section) => section.id === createdId);
    expect(created).toBeDefined();
    expect(created?.bullets).toContain("QA のテストケースを追加作成");
    expect(created?.actions[0].owner).toBe("田中");

    const updatedDesign = response.changed_sections.find((section) => section.id === "sec_design");
    expect(updatedDesign?.bullets.some((bullet) => bullet.startsWith("決定:"))).toBe(true);
    expect(updatedDesign?.bullets.some((bullet) => bullet.startsWith("未解決:"))).toBe(true);
  });
});
