#!/usr/bin/env tsx

// transcriptEmitter にテスト用の文字列を流し込み、minutes.sections の確認を行うスクリプト
// 使い方例:
// pnpm exec tsx tests/helpers/mock-transcript.ts --meetingId=test-001
// pnpm exec tsx tests/helpers/mock-transcript.ts --text="カスタム文" --text="追加文"

import { readFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

interface FixtureEntry {
  meetingId?: string;
  text?: string;
  language?: string;
  isFinal?: boolean;
  confidence?: number;
  timestamp?: string;
}

interface CliOptions {
  meetingId: string;
  language: string;
  confidence: number;
  isFinal: boolean;
  texts: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_FIXTURE_PATH = resolvePath(__dirname, "../fixtures/transcripts.sample.jsonl");
const DEFAULT_PORT = process.env.PORT || "8080";
const DEFAULT_BASE_URL = process.env.MOCK_TRANSCRIPT_BASE_URL || `http://localhost:${DEFAULT_PORT}`;
const DEFAULT_AUTH_TOKEN = process.env.MOCK_TRANSCRIPT_AUTH || "mock-script-token";
const DEFAULT_API_KEY =
  process.env.MOCK_TRANSCRIPT_API_KEY ||
  "0ad6e9166b8f6c4f4258d6207e5427a1d8049ea1ea6b8f52c9557b72440e2613";

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

  return options;
}

function loadFixtureEntries(): FixtureEntry[] {
  const content = readFileSync(DEFAULT_FIXTURE_PATH, "utf8");
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const entries: FixtureEntry[] = [];

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as FixtureEntry);
    } catch (error) {
      console.error(`[mock-transcript] JSONL の解析に失敗しました: ${line}`);
      throw error;
    }
  }

  return entries;
}

function buildCustomEntries(options: CliOptions): FixtureEntry[] {
  const now = Date.now();
  return options.texts.map((text, index) => ({
    meetingId: options.meetingId,
    text,
    language: options.language,
    isFinal: options.isFinal,
    confidence: options.confidence,
    timestamp: new Date(now + index * 1500).toISOString(),
  }));
}

function normalizeEntries(options: CliOptions, rawEntries: FixtureEntry[]): FixtureEntry[] {
  return rawEntries.map((entry, index) => {
    const meetingId = entry.meetingId ?? options.meetingId;
    const timestamp = entry.timestamp
      ? new Date(entry.timestamp).toISOString()
      : new Date(Date.now() + index * 1500).toISOString();

    return {
      meetingId,
      text: entry.text ?? "",
      language: entry.language ?? options.language,
      isFinal: entry.isFinal ?? options.isFinal,
      confidence: entry.confidence ?? options.confidence,
      timestamp,
    };
  });
}

async function sendTranscripts(options: CliOptions, entries: FixtureEntry[]) {
  if (entries.length === 0) {
    console.warn("[mock-transcript] 送信する transcript がありません");
    return;
  }

  const fetchFn = (globalThis as any).fetch as
    | ((input: string, init?: any) => Promise<any>)
    | undefined;

  if (!fetchFn) {
    throw new Error("Fetch API is not available in this runtime");
  }

  const url = `${DEFAULT_BASE_URL}/v1/meetings/${encodeURIComponent(options.meetingId)}/mock-transcripts`;
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEFAULT_AUTH_TOKEN}`,
      "x-meeting-baas-api-key": DEFAULT_API_KEY,
    },
    body: JSON.stringify(entries),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[mock-transcript] リクエストに失敗しました: status=${response.status}, body=${text}`);
    throw new Error(`Failed to send transcripts: ${response.status}`);
  }

  console.info(`[*] ${entries.length} 件の transcript を送信しました (${url})`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const entries = options.texts.length > 0
    ? buildCustomEntries(options)
    : loadFixtureEntries();

  const normalized = normalizeEntries(options, entries);
  await sendTranscripts(options, normalized);
  console.info(
  `[mock-transcript] minutes.sections が SSE で流れるか "GET /v1/meetings/${options.meetingId}/stream" で確認してください。`
  );
}

main().catch((error) => {
  console.error("[mock-transcript] エラーが発生しました", error);
  process.exit(1);
});
