import { EventEmitter } from "events";
import { createHash } from "crypto";
// transcript を集約→Gemini(Google AI)で要約→SSE minutes を発火するメインサービス
import { MINUTES_CONFIG, FILLER_WORDS, MAX_DIGEST_LENGTH } from "@/configs/minutes.config.js";
import { transcriptEmitter } from "@/services/ws-relay.service.js";
import { env } from "@/configs/env.js";
import { Logger } from "@/utils/logger.js";
import type { GenerativeModel, GenerativeModelResult } from "firebase/ai";

export type TranscriptChunk = {
  meetingId: string;
  text: string;
  language: string;
  isFinal: boolean;
  confidence?: number;
  timestamp: string;
};

export type LiveMinutes = {
  summary: string[];
  actions: { text: string; owner?: string; due?: string }[];
};

export type MinutesEvent = {
  meetingId: string;
  live: LiveMinutes;
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
  lastLive: LiveMinutes | null;
  lastHash: string | null;
  lastEmitAt: number | null;
  processing: boolean;
  nextCandidate: DigestCandidate | null;
  ttlTimer: NodeJS.Timeout | null;
};

const minutesLogger = new Logger("live-minutes");
const liveMinutesEmitter = new EventEmitter();
const meetingStates = new Map<string, MeetingState>();

const WINDOW_MS = MINUTES_CONFIG.WINDOW_SEC * 1000;
const EMIT_INTERVAL_MS = MINUTES_CONFIG.EMIT_INTERVAL_SEC * 1000;
const STATE_TTL_MS = MINUTES_CONFIG.STATE_TTL_MIN * 60 * 1000;

const PROMPT_TEMPLATE = `直近の会話ダイジェスト:\n----\n{DIGEST}\n----\n出力は JSON のみ（summary と actions）。規定のスキーマに完全一致させてください。`;
const MINUTES_EVENT = "minutes" as const;

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
    lastLive: null,
    lastHash: null,
    lastEmitAt: null,
    processing: false,
    nextCandidate: null,
    ttlTimer: null,
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
function shouldProcessCandidate(state: MeetingState, candidate: DigestCandidate): boolean {
  if (!candidate.digest || candidate.digest.length < 40) {
    return false;
  }

  if (state.lastHash && candidate.digestHash === state.lastHash) {
    return false;
  }

  if (state.lastEmitAt && Date.now() - state.lastEmitAt < EMIT_INTERVAL_MS) {
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

    if (!shouldProcessCandidate(state, candidate)) {
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

    const live = await summarizeWithRetry(candidate.digest, meetingId, state.lastLive);

    if (!live) {
      if (state.lastLive) {
        const emittedAt = Date.now();
        state.lastEmitAt = emittedAt;
        state.lastHash = candidate.digestHash;
        liveMinutesEmitter.emit(MINUTES_EVENT, {
          meetingId,
          live: state.lastLive,
          emittedAt,
          retry: true,
        });
      }
      continue;
    }

    state.lastLive = live;
    state.lastHash = candidate.digestHash;
    state.lastEmitAt = Date.now();

    liveMinutesEmitter.emit(MINUTES_EVENT, {
      meetingId,
      live,
      emittedAt: state.lastEmitAt,
    });
  }

  state.processing = false;
}

// Gemini 失敗時に 1 回だけリトライし、最終的に前回値へフォールバック
async function summarizeWithRetry(
  digest: string,
  meetingId: string,
  previous: LiveMinutes | null
): Promise<LiveMinutes | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const live = await summarizeDigest(digest);
      return live;
    } catch (error) {
      minutesLogger.warn("Gemini summarize failed", {
        meetingId,
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return previous;
}

// Gemini で JSON 出力を生成し、summary/actions をトリミング
async function summarizeDigest(digest: string): Promise<LiveMinutes> {
  // Gemini に JSON Schema を渡して minutes を生成
  const model = await getGenerativeModel();
  const prompt = PROMPT_TEMPLATE.replace("{DIGEST}", digest);

  const result = await withTimeout<GenerativeModelResult>(
    model.generateContent(prompt),
    MINUTES_CONFIG.REQUEST_TIMEOUT_MS
  );

  let jsonText: string | null = null;

  if (typeof result?.response?.text === "function") {
    jsonText = result.response.text();
  }

  if (!jsonText && result?.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
    jsonText = result.response.candidates[0].content.parts[0].text as string;
  }

  if (!jsonText) {
    throw new Error("Gemini response missing JSON payload");
  }

  const parsed = JSON.parse(jsonText) as LiveMinutes;
  parsed.summary = (parsed.summary ?? []).slice(0, MINUTES_CONFIG.MAX_SUMMARY);
  parsed.actions = (parsed.actions ?? []).slice(0, MINUTES_CONFIG.MAX_ACTIONS);
  return parsed;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Gemini request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// GenerativeModel を初期化後キャッシュして再利用
async function getGenerativeModel(): Promise<GenerativeModel> {
  if (!globalModelPromise) {
    globalModelPromise = initializeModel();
  }
  return globalModelPromise;
}

let globalModelPromise: Promise<GenerativeModel> | null = null;

// Firebase アプリと GoogleAIBackend を構築し、JSON Schema を設定したモデルを返す
async function initializeModel(): Promise<GenerativeModel> {
  const [{ initializeApp }] = await Promise.all([import("firebase/app")]);

  const firebaseConfig = {
    projectId: env.PROJECT_ID,
    apiKey: env.GOOGLE_GENAI_API_KEY,
  } as Record<string, string>;

  const firebaseApp = initializeApp(firebaseConfig);

  const {
    getAI,
    getGenerativeModel: getFirebaseGenerativeModel,
    GoogleAIBackend,
    Schema,
  } = await import("firebase/ai");

  const ai = getAI(firebaseApp, {
    backend: new GoogleAIBackend({
      apiKey: env.GOOGLE_GENAI_API_KEY,
    }),
  });

  const liveMinutesSchema = Schema.object({
    properties: {
      summary: Schema.array({
        items: Schema.string(),
        minItems: 3,
        maxItems: MINUTES_CONFIG.MAX_SUMMARY,
      }),
      actions: Schema.array({
        items: Schema.object({
          properties: {
            text: Schema.string(),
            owner: Schema.string(),
            due: Schema.string(),
          },
          optionalProperties: ["owner", "due"],
          requiredProperties: ["text"],
        }),
        maxItems: MINUTES_CONFIG.MAX_ACTIONS,
      }),
    },
    requiredProperties: ["summary", "actions"],
  });

  const generationConfig = {
    responseMimeType: "application/json",
    responseSchema: liveMinutesSchema,
    temperature: MINUTES_CONFIG.TEMPERATURE,
    maxOutputTokens: MINUTES_CONFIG.MAX_TOKENS,
  };

  return getFirebaseGenerativeModel(ai, {
    model: MINUTES_CONFIG.DEFAULT_GEMINI_MODEL,
    generationConfig,
  }) as GenerativeModel;
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
  if (!chunk.isFinal || chunk.language !== "ja" || confidence < MINUTES_CONFIG.CONF_MIN) {
    return;
  }

  const cleanedText = normalizeText(chunk.text ?? "");
  if (!cleanedText) {
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
  } else {
    if (state.utterances.some((utterance) => utterance.hash === hash)) {
      return;
    }
    state.utterances.push({
      text: cleanedText,
      timestamp,
      hash,
    });
  }

  pruneWindow(state, timestamp);
  scheduleCandidate(meetingId, state);
}

// Gladia からの transcript を minutes 処理に流し込む
transcriptEmitter.on("transcript", handleTranscript);

// 現在保持している最新 minutes を取得（SSE 接続時に初期送信）
export function getLastLiveMinutes(meetingId: string): LiveMinutes | null {
  const state = meetingStates.get(meetingId);
  return state?.lastLive ?? null;
}

// minutes イベントを購読（SSE 側などから利用）
export function onLiveMinutes(listener: (event: MinutesEvent) => void): void {
  liveMinutesEmitter.on(MINUTES_EVENT, listener);
}

// minutes イベント購読を解除
export function offLiveMinutes(listener: (event: MinutesEvent) => void): void {
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
