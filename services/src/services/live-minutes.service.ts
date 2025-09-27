import { EventEmitter } from "events";
import { createHash } from "crypto";
// transcript を集約→Gemini(Google AI)で要約→SSE minutes を発火するメインサービス
import { MINUTES_CONFIG, FILLER_WORDS, MAX_DIGEST_LENGTH } from "@/configs/minutes.config.js";
import { MINUTES_FINAL_CONFIG } from "@/configs/minutes-final.config.js";
import {
  Delta30sSchema,
  type Delta30s,
  type SectionUpdateResponse,
  type CurrentSectionList,
  type SectionOutput,
  type SectionInput,
} from "@/domain/minutes/index.js";
import { transcriptEmitter } from "@/services/ws-relay.service.js";
import { env } from "@/configs/env.js";
import { Logger } from "@/utils/logger.js";
import { SectionDiffEngine } from "@/services/section-diff.service.js";

export type TranscriptChunk = {
  meetingId: string;
  text: string;
  language: string;
  isFinal: boolean;
  confidence?: number;
  timestamp: string;
};

export type SectionGenerationResult = {
  delta: Delta30s;
  update: SectionUpdateResponse;
};

export type MinutesSectionsEvent = {
  meetingId: string;
  result: SectionGenerationResult;
  emittedAt: number;
  retry?: boolean;
};

type Utterance = {
  text: string;
  timestamp: number;
  hash: string;
};

type DigestCandidate = {
  digest: string;
  digestHash: string;
  queuedAt: number;
};

type MeetingState = {
  utterances: Utterance[];
  lastResult: SectionGenerationResult | null;
  lastHash: string | null;
  lastEmitAt: number | null;
  processing: boolean;
  nextCandidate: DigestCandidate | null;
  ttlTimer: NodeJS.Timeout | null;
  sectionsSnapshot: SectionOutput[];
};

const minutesLogger = new Logger("live-minutes");
const liveMinutesEmitter = new EventEmitter();
const meetingStates = new Map<string, MeetingState>();
const sectionDiffEngine = new SectionDiffEngine();

const WINDOW_MS = MINUTES_CONFIG.WINDOW_SEC * 1000;
const EMIT_INTERVAL_MS = MINUTES_CONFIG.EMIT_INTERVAL_SEC * 1000;
const STATE_TTL_MS = MINUTES_CONFIG.STATE_TTL_MIN * 60 * 1000;

const DELTA_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summaries: {
      type: "array",
      items: { type: "string" },
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          owner: { type: "string" },
          task: { type: "string" },
          due: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["task"],
        additionalProperties: false,
      },
    },
    decisions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          what: { type: "string" },
          reason: { type: "string" },
        },
        required: ["what", "reason"],
        additionalProperties: false,
      },
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          related_section_id: { type: "string" },
          priority: { enum: ["low", "mid", "high"] },
          confidence: { type: "number" },
        },
        required: ["topic"],
        additionalProperties: false,
      },
    },
  },
  required: ["summaries", "actions"],
  additionalProperties: false,
};

const PROMPT_TEMPLATE = `あなたは会議メモの確定版を作成するアシスタントです。直近30秒の会話ダイジェストを読み、以下の条件で JSON を出力してください。\n- summaries: 会話内の主要トピックを短い箇条書きで。1要約=1トピック、最大4件。\n- actions: 実行すべきタスク。可能であれば owner/due(YYYY-MM-DD)/confidence(0-1) を補完。\n- decisions: 明確に決まった事項があれば列挙。\n- questions: 未解決の論点や確認事項。priority は low/mid/high のいずれか。\n出力は JSON のみ。余計な説明を含めないでください。\n----\n{DIGEST}\n----`;
const MINUTES_EVENT = "minutes.sections" as const;
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiContentPart = {
  text?: string;
};

type GeminiCandidate = {
  content?: {
    parts?: GeminiContentPart[];
  };
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
};

// 会議 ID ごとに minutes の状態を取得（存在しなければ初期化）
function getOrCreateState(meetingId: string): MeetingState {
  // 会議 ID ごとの状態を生成または TTL 更新する
  const existing = meetingStates.get(meetingId);
  if (existing) {
    resetTtl(meetingId, existing);
    return existing;
  }

  const fresh: MeetingState = {
    utterances: [],
    lastResult: null,
    lastHash: null,
    lastEmitAt: null,
    processing: false,
    nextCandidate: null,
    ttlTimer: null,
    sectionsSnapshot: [],
  };
  meetingStates.set(meetingId, fresh);
  resetTtl(meetingId, fresh);
  return fresh;
}

// 一定時間会話が無い会議状態を自動破棄するためのタイマー管理
function resetTtl(meetingId: string, state: MeetingState) {
  if (state.ttlTimer) {
    clearTimeout(state.ttlTimer);
  }

  state.ttlTimer = setTimeout(() => {
    meetingStates.delete(meetingId);
  }, STATE_TTL_MS);
}

// 文字起こし文中のフィラー語を取り除き、空白を整える
function normalizeText(text: string): string {
  let cleaned = text.trim();
  for (const filler of FILLER_WORDS) {
    const regex = new RegExp(filler, "g");
    cleaned = cleaned.replace(regex, "");
  }
  return cleaned.replace(/\s+/g, " ").trim();
}

// 発話の重複検出や digest 比較用にハッシュ化
function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// 45 秒ウィンドウから外れた古い発話を削除
function pruneWindow(state: MeetingState, latestTimestamp: number) {
  state.utterances = state.utterances.filter(
    (utterance) => latestTimestamp - utterance.timestamp <= WINDOW_MS
  );
}

// LLM に渡すダイジェスト文字列とハッシュを生成
function buildDigest(state: MeetingState): DigestCandidate | null {
  if (state.utterances.length === 0) {
    return null;
  }

  let digest = state.utterances.map((u) => u.text).join("。");
  if (digest.length > MAX_DIGEST_LENGTH) {
    digest = digest.slice(-MAX_DIGEST_LENGTH);
  }

  const digestHash = hashText(digest);
  return {
    digest,
    digestHash,
    queuedAt: Date.now(),
  };
}

// digest が十分な長さで更新されているか、レート制御に引っ掛からないか確認
function shouldProcessCandidate(
  meetingId: string,
  state: MeetingState,
  candidate: DigestCandidate
): boolean {
  if (!candidate.digest || candidate.digest.length < 40) {
    minutesLogger.info("Skip digest: too short", {
      meetingId,
      length: candidate.digest?.length ?? 0,
    });
    return false;
  }

  if (state.lastHash && candidate.digestHash === state.lastHash) {
    minutesLogger.info("Skip digest: same hash as last emit", {
      meetingId,
      digestHash: candidate.digestHash,
    });
    return false;
  }

  if (state.lastEmitAt && Date.now() - state.lastEmitAt < EMIT_INTERVAL_MS) {
    minutesLogger.info("Skip digest: emit interval not elapsed", {
      meetingId,
      elapsedMs: Date.now() - state.lastEmitAt,
    });
    return false;
  }

  return true;
}

// digest を次の処理対象として登録し、必要ならキュー処理を走らせる
function scheduleCandidate(meetingId: string, state: MeetingState) {
  // ウィンドウ内の発話をまとめた digest を作り、キューに積む
  const candidate = buildDigest(state);
  if (!candidate) {
    return;
  }

  minutesLogger.info("Digest candidate queued", {
    meetingId,
    length: candidate.digest.length,
    utteranceCount: state.utterances.length,
  });

  state.nextCandidate = candidate;
  if (!state.processing) {
    void processQueue(meetingId, state);
  }
}

// 会議単位で Gemini 呼び出しを直列化し、必要に応じて待機時間を設ける
async function processQueue(meetingId: string, state: MeetingState) {
  // 会議単位で LLM 呼び出しを直列化し、レート制御を掛ける
  state.processing = true;

  while (state.nextCandidate) {
    const candidate = state.nextCandidate;
    state.nextCandidate = null;

    if (!shouldProcessCandidate(meetingId, state, candidate)) {
      continue;
    }

    const now = Date.now();
    if (state.lastEmitAt && now - state.lastEmitAt < EMIT_INTERVAL_MS) {
      const waitMs = EMIT_INTERVAL_MS - (now - state.lastEmitAt);
      await sleep(waitMs);
      // After waiting, requeue the candidate if nothing newer arrived
      if (!state.nextCandidate) {
        state.nextCandidate = candidate;
      }
      continue;
    }

    const result = await generateSectionsWithRetry(candidate, meetingId, state);

    if (!result) {
      if (state.lastResult) {
        const emittedAt = Date.now();
        state.lastEmitAt = emittedAt;
        state.lastHash = candidate.digestHash;
        liveMinutesEmitter.emit(MINUTES_EVENT, {
          meetingId,
          result: state.lastResult,
          emittedAt,
          retry: true,
        });
      }
      continue;
    }

    minutesLogger.info("Minutes generated", {
      meetingId,
      digestLength: candidate.digest.length,
      windowStart: candidate.queuedAt - MINUTES_FINAL_CONFIG.DELTA_WINDOW_SEC * 1000,
      windowEnd: candidate.queuedAt,
      created: result.update.change_summary.created_sections.length,
      updated: result.update.change_summary.updated_sections.length,
      closed: result.update.change_summary.closed_sections.length,
    });

    state.lastResult = result;
    state.lastHash = candidate.digestHash;
    state.lastEmitAt = Date.now();

    liveMinutesEmitter.emit(MINUTES_EVENT, {
      meetingId,
      result,
      emittedAt: state.lastEmitAt,
    });
  }

  state.processing = false;
}

// Gemini 失敗時に規定回数リトライし、前回値へフォールバック
async function generateSectionsWithRetry(
  candidate: DigestCandidate,
  meetingId: string,
  state: MeetingState
): Promise<SectionGenerationResult | null> {
  const windowEnd = candidate.queuedAt;
  const windowStart = windowEnd - MINUTES_FINAL_CONFIG.DELTA_WINDOW_SEC * 1000;

  for (let attempt = 0; attempt <= MINUTES_FINAL_CONFIG.LLM_RETRY_LIMIT; attempt++) {
    try {
      const delta = await generateDelta30sFromDigest(candidate.digest, {
        meetingId,
        windowStart,
        windowEnd,
      });

      const update = buildSectionUpdate(meetingId, state, delta);
      if (!update) {
        return null;
      }

      return { delta, update };
    } catch (error) {
      minutesLogger.warn("Gemini summarize failed", {
        meetingId,
        attempt,
        windowStart,
        windowEnd,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return null;
}

async function requestGeminiJson(
  prompt: string,
  responseSchema: Record<string, unknown> = DELTA_RESPONSE_SCHEMA
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MINUTES_CONFIG.REQUEST_TIMEOUT_MS);

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: MINUTES_CONFIG.TEMPERATURE,
      maxOutputTokens: MINUTES_CONFIG.MAX_TOKENS,
      responseSchema,
    },
  };

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/${MINUTES_CONFIG.DEFAULT_GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": env.GOOGLE_GENAI_API_KEY,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Gemini request failed (${response.status} ${response.statusText})${
          errorText ? `: ${errorText}` : ""
        }`
      );
    }

    const data = (await response.json()) as GeminiResponse;
    const textPart = data.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      ?.find((part) => typeof part?.text === "string" && part.text.trim().length > 0);

    if (!textPart?.text) {
      throw new Error("Gemini response missing text candidate");
    }

    return textPart.text;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Gemini request timed out after ${MINUTES_CONFIG.REQUEST_TIMEOUT_MS}ms`);
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(String(error));
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeDelta30s(jsonText: string): Delta30s {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error(`Failed to parse Delta30s JSON: ${jsonText}`);
  }

  return Delta30sSchema.parse(raw);
}

function buildSectionUpdate(
  meetingId: string,
  state: MeetingState,
  delta: Delta30s
): SectionUpdateResponse | null {
  const currentSections: CurrentSectionList = {
    meeting_id: meetingId,
    sections: state.sectionsSnapshot
      .filter((section) => section.status !== "closed")
      .map((section) => cloneSectionInput(section)),
  };

  const update = sectionDiffEngine.diff(currentSections, delta);
  if (update.changed_sections.length === 0) {
    minutesLogger.info("Section diff produced no changes", {
      meetingId,
    });
    return null;
  }

  applySectionUpdate(state, update);
  return update;
}

function cloneSectionOutput(section: SectionOutput): SectionOutput {
  return {
    id: section.id,
    title: section.title,
    status: section.status,
    bullets: [...section.bullets],
    actions: section.actions.map((action) => ({ ...action })),
  };
}

function cloneSectionInput(section: SectionOutput): SectionInput {
  return {
    id: section.id,
    title: section.title,
    status: section.status === "closed" ? "provisional" : (section.status as SectionInput["status"]),
    bullets: [...section.bullets],
    actions: section.actions.map((action) => ({ ...action })),
  };
}

function applySectionUpdate(state: MeetingState, update: SectionUpdateResponse) {
  const map = new Map<string, SectionOutput>();
  for (const section of state.sectionsSnapshot) {
    map.set(section.id, cloneSectionOutput(section));
  }

  for (const changed of update.changed_sections) {
    if (changed.status === "closed") {
      map.delete(changed.id);
      continue;
    }

    map.set(changed.id, cloneSectionOutput(changed));
  }

  state.sectionsSnapshot = Array.from(map.values());
}

export async function generateDelta30sFromDigest(
  digest: string,
  metadata: { meetingId: string; windowStart: number; windowEnd: number }
): Promise<Delta30s> {
  const prompt = PROMPT_TEMPLATE.replace("{DIGEST}", digest);
  const jsonText = await requestGeminiJson(prompt, DELTA_RESPONSE_SCHEMA);
  const delta = normalizeDelta30s(jsonText);
  minutesLogger.debug("Delta30s generated", {
    meetingId: metadata.meetingId,
    windowStart: metadata.windowStart,
    windowEnd: metadata.windowEnd,
    summaryCount: delta.summaries.length,
    actionCount: delta.actions.length,
    decisionCount: delta.decisions?.length ?? 0,
    questionCount: delta.questions?.length ?? 0,
  });
  return delta;
}

// レート制御の待機などに使うシンプルなタイマー
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// transcriptEmitter から届く生データを安全な構造体に正規化
function normalizeChunk(event: unknown): TranscriptChunk | null {
  if (!event || typeof event !== "object") {
    return null;
  }

  const maybeChunk = event as Record<string, unknown>;
  const meetingId = typeof maybeChunk.meetingId === "string" ? maybeChunk.meetingId : undefined;
  const text = typeof maybeChunk.text === "string" ? maybeChunk.text : "";
  const language = typeof maybeChunk.language === "string" ? maybeChunk.language : "";
  const isFinal = typeof maybeChunk.isFinal === "boolean" ? maybeChunk.isFinal : false;
  let confidence: number | undefined;
  if (typeof maybeChunk.confidence === "number") {
    confidence = maybeChunk.confidence;
  } else if (typeof maybeChunk.confidence === "string") {
    const parsed = Number(maybeChunk.confidence);
    confidence = Number.isFinite(parsed) ? parsed : undefined;
  }
  const timestamp =
    typeof maybeChunk.timestamp === "string" ? maybeChunk.timestamp : new Date().toISOString();

  if (!meetingId) {
    return null;
  }

  return {
    meetingId,
    text,
    language,
    isFinal,
    confidence,
    timestamp,
  };
}

// transcriptEmitter から届いた文字起こしを minutes 状態に反映
function handleTranscript(event: unknown) {
  const chunk = normalizeChunk(event);
  if (!chunk) {
    return;
  }

  const confidence = chunk.confidence ?? 0;
  const skipReasons: string[] = [];
  if (!chunk.isFinal) {
    skipReasons.push("not_final");
  }
  if (chunk.language !== "ja") {
    skipReasons.push("unsupported_language");
  }
  if (confidence < MINUTES_CONFIG.CONF_MIN) {
    skipReasons.push("low_confidence");
  }

  if (skipReasons.length > 0) {
    minutesLogger.info("Transcript ignored", {
      meetingId: chunk.meetingId,
      reasons: skipReasons,
      confidence,
      language: chunk.language,
    });
    return;
  }

  const cleanedText = normalizeText(chunk.text ?? "");
  if (!cleanedText) {
    minutesLogger.info("Transcript ignored", {
      meetingId: chunk.meetingId,
      reasons: ["empty_after_normalize"],
    });
    return;
  }

  const timestamp = new Date(chunk.timestamp).getTime() || Date.now();
  const meetingId = chunk.meetingId;

  const state = getOrCreateState(meetingId);

  const hash = hashText(cleanedText);
  const lastUtterance = state.utterances[state.utterances.length - 1];

  if (lastUtterance && timestamp - lastUtterance.timestamp <= MINUTES_CONFIG.MERGE_GAP_MS) {
    const mergedText = `${lastUtterance.text} ${cleanedText}`.trim();
    lastUtterance.text = mergedText;
    lastUtterance.timestamp = timestamp;
    lastUtterance.hash = hashText(mergedText);
    minutesLogger.info("Transcript merged", {
      meetingId,
      mergedLength: mergedText.length,
    });
  } else {
    if (state.utterances.some((utterance) => utterance.hash === hash)) {
      minutesLogger.info("Transcript ignored", {
        meetingId,
        reasons: ["duplicate_hash"],
      });
      return;
    }
    state.utterances.push({
      text: cleanedText,
      timestamp,
      hash,
    });
    minutesLogger.info("Transcript accepted", {
      meetingId,
      length: cleanedText.length,
      utteranceCount: state.utterances.length,
    });
  }

  pruneWindow(state, timestamp);
  scheduleCandidate(meetingId, state);
}

// Gladia からの transcript を minutes 処理に流し込む
transcriptEmitter.on("transcript", handleTranscript);

// 現在保持している最新 minutes（セクション差分）を取得（SSE 接続時に初期送信）
export function getLastSectionUpdate(meetingId: string): SectionGenerationResult | null {
  const state = meetingStates.get(meetingId);
  return state?.lastResult ?? null;
}

// minutes.sections イベントを購読（SSE 側などから利用）
export function onSectionUpdates(listener: (event: MinutesSectionsEvent) => void): void {
  liveMinutesEmitter.on(MINUTES_EVENT, listener);
}

// minutes.sections イベント購読を解除
export function offSectionUpdates(listener: (event: MinutesSectionsEvent) => void): void {
  liveMinutesEmitter.off(MINUTES_EVENT, listener);
}

// テスト用：全会議の状態を初期化
export function clearLiveMinutesState() {
  for (const state of meetingStates.values()) {
    if (state.ttlTimer) {
      clearTimeout(state.ttlTimer);
    }
  }
  meetingStates.clear();
}
