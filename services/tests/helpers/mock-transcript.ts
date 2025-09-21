#!/usr/bin/env tsx

// transcriptEmitter にテスト用の文字列を流し込み、minutes.partial の確認を行うスクリプト
// 使い方:
// pnpm exec tsx tests/helpers/mock-transcript.ts --meetingId=test-001 --text="リリースは来週" --text="Figma共有を依頼"

import { transcriptEmitter } from "../../src/services/ws-relay.service.js";

interface CliOptions {
  meetingId: string;
  language: string;
  confidence: number;
  isFinal: boolean;
  texts: string[];
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    meetingId: "mock-meeting-001",
    language: "ja",
    confidence: 0.9,
    isFinal: true,
    texts: [],
  };

  for (const arg of argv) {
    if (arg.startsWith("--meetingId=")) {
      options.meetingId = arg.split("=")[1] ?? options.meetingId;
    } else if (arg.startsWith("--language=")) {
      options.language = arg.split("=")[1] ?? options.language;
    } else if (arg.startsWith("--confidence=")) {
      const value = Number(arg.split("=")[1]);
      if (!Number.isNaN(value)) {
        options.confidence = value;
      }
    } else if (arg.startsWith("--isFinal=")) {
      const value = arg.split("=")[1];
      if (typeof value === "string") {
        options.isFinal = value !== "false";
      }
    } else if (arg.startsWith("--text=")) {
      const value = arg.split("=")[1];
      if (value) {
        options.texts.push(value);
      }
    }
  }

  if (options.texts.length === 0) {
    options.texts.push("公開スケジュールは来週決定予定です");
    options.texts.push("Figma の共有とタスク確認が必要です");
  }

  return options;
}

function emitTranscript(options: CliOptions) {
  const timestamp = new Date().toISOString();

  for (const text of options.texts) {
    transcriptEmitter.emit("transcript", {
      meetingId: options.meetingId,
      text,
      language: options.language,
      isFinal: options.isFinal,
      confidence: options.confidence,
      timestamp,
    });

    console.info(
      `[mock-transcript] 発話を送信しました: meetingId=${options.meetingId}, text="${text}"`
    );
  }

  console.info(
    `[mock-transcript] minutes.partial が SSE で流れるか "GET /v1/meetings/${options.meetingId}/stream" で確認してください。`
  );
}

const options = parseArgs(process.argv.slice(2));
emitTranscript(options);
