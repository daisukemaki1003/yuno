import { describe, expect, it, beforeEach, afterEach, jest } from "@jest/globals";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { MinutesLogWriter } from "../../src/utils/minutes-log-writer.js";
import type { Delta30s } from "../../src/domain/minutes/delta30s.schema.js";
import type { SectionUpdateResponse } from "../../src/domain/minutes/index.js";
import { useTempDir } from "../utils/tmp-dir.js";

describe("MinutesLogWriter", () => {
  const tempDir = useTempDir("minutes-log-writer");
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    jest.spyOn(process, "cwd").mockReturnValue(tempDir.path);
  });

  afterEach(() => {
    jest.spyOn(process, "cwd").mockReturnValue(originalCwd);
    jest.restoreAllMocks();
  });

  it("writes transcript, delta, and section updates to separate files", () => {
    const writer = new MinutesLogWriter();
    const meetingId = "fvt-dfmo-jpx";
    const timestamp = "2025-10-11T22:35:00.000Z";

    writer.logTranscript(meetingId, {
      text: "議事録のテスト発話です",
      language: "ja",
      isFinal: true,
      confidence: 0.9,
      timestamp,
    });

    const delta: Delta30s = {
      summaries: ["セクションログの検証を実施"],
      actions: [],
      decisions: [],
      questions: [],
    };

    writer.logDelta(meetingId, {
      window: {
        start: timestamp,
        end: timestamp,
      },
      delta,
      digestHash: "abc123",
    });

    const update: SectionUpdateResponse = {
      meeting_id: meetingId,
      changed_sections: [
        {
          id: "sec-1",
          title: "テストセクション",
          summary: "セクション内容を記録",
          status: "active",
        },
      ],
      change_summary: {
        created_sections: ["sec-1"],
        updated_sections: [],
        closed_sections: [],
      },
    };

    writer.logSectionUpdate(meetingId, update);

    const baseDir = join(tempDir.path, "logs", "2025-10-11_2235");
    expect(existsSync(baseDir)).toBe(true);

    const safeId = meetingId.replace(/[^a-zA-Z0-9-_]/g, "_");

    const transcriptPath = join(baseDir, `${safeId}-transcript.jsonl`);
    const deltaPath = join(baseDir, `${safeId}-delta.jsonl`);
    const sectionsPath = join(baseDir, `${safeId}-sections.jsonl`);

    expect(existsSync(transcriptPath)).toBe(true);
    expect(existsSync(deltaPath)).toBe(true);
    expect(existsSync(sectionsPath)).toBe(true);

    const transcriptEntry = JSON.parse(readFileSync(transcriptPath, "utf-8").trim());
    expect(transcriptEntry).toMatchObject({
      type: "transcript",
      meetingId,
      text: "議事録のテスト発話です",
      language: "ja",
    });

    const deltaEntry = JSON.parse(readFileSync(deltaPath, "utf-8").trim());
    expect(deltaEntry).toMatchObject({
      type: "delta30s",
      meetingId,
      delta,
      digestHash: "abc123",
    });

    const sectionEntry = JSON.parse(readFileSync(sectionsPath, "utf-8").trim());
    expect(sectionEntry).toMatchObject({
      type: "sections",
      meetingId,
      update,
    });
  });
});
