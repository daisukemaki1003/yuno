---

# エージェント実装依頼：リアルタイム議事録（軽量LLM常時ON / SSE）

## 目的 / スコープ

* **目的**：会議中の文字起こし（JSONL断片）から、**30秒目安**で「いまの議事録」を**SSE**で配信する。
* **前提**：**軽量LLMを常時使用**して要点・文面整形を行う（OFFは無し）。
* **除外**：確定版の最終議事録、確認カード、DB保存、RAG、UI。

---

## 現状把握メモ（2025-02 時点リポジトリ）

- `services/src/services/ws-relay.service.ts` が Gladia から受けた transcript を `transcriptEmitter` で配信している（`meetingId` を保持）。
- SSE は既存の `GET /v1/meetings/:meetingId/stream`（`bearerAuth` + `extractMeetingBaasApiKey` 必須）で公開され、`hono/streaming` を使って `event: transcript`・`event: ping` を送信している。
- `StreamQuerySchema` の `types` には現在 `audio, transcript, event` のみが許可されており、新しい種別 `minutes` を追加する必要がある。
- `transcriptEmitter` から流れてくるデータには `confidence` が含まれていないため、前処理で信頼度フィルタを掛けるには `ws-relay.service.ts` 側で値を引き渡す修正が必要。
- KEEP-ALIVE は `: ping` コメントと `event: ping`（20 秒間隔）で既に実装されているので、新しいイベントもこれに合わせる。
- LLM 実装は未着手。Gemini 利用に合わせて Firebase AI SDK (`firebase/ai`) を導入し、API キーのみ環境変数（`GOOGLE_GENAI_API_KEY`）で扱う。

## 成果物（受け入れ基準 / DoD）

- 文字起こしを投入すると、**最大 30 秒以内**に `minutes.partial` が 1 回以上届く。
- 既存 SSE (`GET /v1/meetings/:meetingId/stream`) に `types` で `minutes` を指定し、Authorization / `x-meeting-baas-api-key` を付けると `event: minutes.partial` が受け取れる。
- SSE ペイロードは **日本語の箇条書き 3〜5 行**の `summary` と **0〜3 件**の `actions`。
- LLM 応答は**JSON Schema に適合**。崩れた場合は**1 回だけ自動再試行**し、それでも無理なら**直前の正常出力を再送**（黙るより安全）。
- 同じ内容を連投しない（差分＆レート制御が有効）。
- メモリのみで完結。最後の入力から **STATE_TTL_MIN** 経過でクリーンアップ。

---

## 入力（既存の JSONL 断片）

各行（例）：

```json
{
  "meetingId": "meeting-123",
  "text": "デザインは後日共有します",
  "language": "ja",
  "isFinal": true,
  "confidence": 0.92,
  "timestamp": "2025-09-13T04:54:11.749Z"
}
```

> ※ `ws-relay.service.ts` の `transcriptEmitter.emit` で `confidence` を渡す修正を先に行うこと。ベンダーから来ない場合は `undefined` として扱い、フィルタ時は `0` 相当で落とす。

## 出力（SSE）

- ルート：`GET /v1/meetings/:meetingId/stream?userId=...&types=minutes[,transcript]`
  - 認証ヘッダー：`Authorization: Bearer ...` / `x-meeting-baas-api-key: ...`（既存 SSE と同等）
  - `types` に複数指定する場合はカンマ区切り。`minutes` を含めたときだけ minutes 配信を受け取る。
- イベント名：`minutes.partial`
- keep-alive：既存実装に倣い `: ping` コメント + `event: ping`（20 秒間隔）を送る。
- 例：

```json
{
  "summary": [
    "公開スケジュールの調整",
    "フォームは2件・確認画面あり",
    "デザインデータは後日共有予定"
  ],
  "actions": [{ "text": "Figmaリンク共有" }, { "text": "公開日を確定" }]
}
```

---

## 型（I/F 固定・配置は任意）

```ts
export type TranscriptChunk = {
  meetingId: string;
  text: string;
  language: string; // "ja"
  isFinal: boolean;
  confidence?: number; // 0..1 (未提供時は undefined)
  timestamp: string; // ISO
};

export type LiveMinutes = {
  summary: string[]; // 3..5
  actions: { text: string; owner?: string; due?: string }[]; // 0..3
};
```

---

## 設定（コード内定数で管理）

- 前処理パラメータはモジュール定数（例：`services/src/services/live-minutes.config.ts`）として管理。デフォルト値：
  - `CONF_MIN=0.55`
  - `MERGE_GAP_MS=1200`
  - `WINDOW_SEC=90`
  - `EMIT_INTERVAL_SEC=30`
  - `MAX_SUMMARY=5`
  - `MAX_ACTIONS=3`
  - `STATE_TTL_MIN=30`
- LLM も同モジュールで固定値を定義する。
  - `DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"`
  - `MAX_TOKENS = 320`
  - `TEMPERATURE = 0.2`
  - `REQUEST_TIMEOUT_MS = 4000`
- 環境変数は Gemini の API キーのみ (`GOOGLE_GENAI_API_KEY`)。その他はコード内で定数として扱い、変更が必要な場合のみ設定ファイルで上書きする。

---

## 実装タスク（最小・手戻り小）

### 0) イベント配信レイヤーの下準備

- `ws-relay.service.ts` の `transcriptEmitter.emit` へ `confidence` を追加し、SSE でも渡るようにする。
- `StreamTypeSchema` / `StreamQuerySchema` に `minutes` 種別を追加。`types` 指定が無い場合は互換性のため従来どおり `audio,transcript,event` を返す。
- `services/src/services` に minutes 専用サービスを用意し、`transcriptEmitter` を購読して minutes 更新を発火する `EventEmitter`（例: `liveMinutesEmitter`）と現在の `lastLive` を取得する API を提供する。
- `streams.controller.ts` の SSE ハンドラで minutes イベントを購読し、接続直後に `lastLive` を送る処理を追加する。
- Firebase AI SDK (`firebase/ai`) を `services` パッケージに追加し、Gemini 呼び出しは同 SDK 経由で行う。
- `services/src/configs/env.ts` には `GOOGLE_GENAI_API_KEY` のみ追加し、その他の Gemini 関連値はコード内定数で扱う。

### 1) 前処理（純関数）

- **フィルタ**：`language==="ja" && isFinal && confidence>=CONF_MIN`
- **ノイズ除去**：`["えー","あの","その","なんか","はい","えっと","ですね"]` を軽く削る
- **断片結合**：`MERGE_GAP_MS` 以内は 1 発話に結合
- **窓抽出**：`WINDOW_SEC` 以内の発話を連結 → **digest（最大\~450 字）**
- **重複抑制**：文面の簡易ハッシュで重複行を弾く

## -### 2) 軽量 LLM サマライザ（常時 ON）

- 入力：`digest`（直近 90 秒の要約テキスト）
- 出力：`LiveMinutes`（`summary[3..5]`, `actions[0..3]`）※**JSON Schema で厳密検証**
- **再試行**：JSON 崩壊/タイムアウト時は**同じプロンプトで 1 回だけ再試行**。失敗時は**前回正常出力を再送**。
- **呼ぶ条件**：`digest.length >= 40` かつ **前回 digest から十分変化**（単純ハッシュ不一致で OK）
- 実装：Firebase AI SDK (`firebase/ai`) を用い、`getAI` + `GoogleAIBackend` で Gemini バックエンドを初期化。`responseMimeType: "application/json"` と `responseSchema` を必ず指定し、戻り値（JSON 文字列）を `JSON.parse` して `LiveMinutes` に変換する。
- Safety ブロックなどで `result.response.text()` が空になるケースに備え、`result.response.candidates?.[0]?.content?.parts?.[0]?.text` をフォールバック参照し、空ならリトライ扱いにする。

例：

```ts
import { initializeApp } from "firebase/app";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  Schema,
} from "firebase/ai";
-
const firebaseApp = initializeApp(firebaseConfig); // 既存の PROJECT_ID など最小構成でOK
const ai = getAI(firebaseApp, {
  backend: new GoogleAIBackend({ apiKey: process.env.GOOGLE_GENAI_API_KEY! }),
});

const liveMinutesSchema = Schema.object({
  properties: {
    summary: Schema.array({
      items: Schema.string(),
      minItems: 3,
      maxItems: 5,
    }),
    actions: Schema.array({
      items: Schema.object({
        properties: {
          text: Schema.string(),
          owner: Schema.string(),
          due: Schema.string(),
        },
        optionalProperties: ["owner", "due"],
      }),
      maxItems: 3,
    }),
  },
  requiredProperties: ["summary", "actions"],
});

const model = getGenerativeModel(ai, {
  model: DEFAULT_GEMINI_MODEL,
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: liveMinutesSchema,
    temperature: TEMPERATURE,
    maxOutputTokens: MAX_TOKENS,
  },
});

const result = await model.generateContent(prompt);
const jsonText = result.response.text()
  ?? result.response.candidates?.[0]?.content?.parts?.[0]?.text;
if (!jsonText) throw new Error("Gemini response missing JSON payload");
const live = JSON.parse(jsonText) as LiveMinutes;
```

- 上記の `DEFAULT_GEMINI_MODEL` / `TEMPERATURE` / `MAX_TOKENS` は `live-minutes.config.ts` などの共有モジュールから import する想定。
- `generationConfig.responseSchema` では `owner/due` の optional を含む JSON Schema を指定（Firebase AI SDK は Draft 2020-12 準拠）。

### 3) 状態と送出制御

- 会議 ID ごとの状態：`{ lastDigestHash, lastLive: LiveMinutes, lastEmitAt }`
- **差分＆レート**：`lastDigestHash` が同じ、または `EMIT_INTERVAL_SEC` 未満なら送らない
- **同時実行ガード**：会議ごとに LLM 呼び出しは直列化 (`inFlight` フラグやジョブキュー) し、重複発火を避ける。
- **TTL**：`STATE_TTL_MIN` で自動破棄（`setTimeout` を張り直し、破棄時に minutesEmitter も閉じる）

### 4) SSE エンドポイント

- 既存の `recordingSse`（`services/src/controllers/streams.controller.ts`）に minutes 配信を組み込む。
  - 接続時：minutes サービスから `lastLive`（あれば）を取得して即送信。
  - 更新時：`event: "minutes.partial"\ndata: { ... }` を `stream.write` で送る。
  - keep-alive：既存の `ping` コメント/イベントを流用（追加は不要）。
  - 切断時は minutes サービス側の購読解除（`off`）を忘れない。

### 5) 初期化と購読

- minutes サービスはモジュール初期化時に `transcriptEmitter.on("transcript", ...)` で購読し、`STATE_TTL_MIN` 経過後に自動破棄されるようタイマー管理を行う。
- `services/src/index.ts` から明示的に import して初期化漏れを防ぐ（tree-shaking で落ちないよう、副作用 import も検討）。

---

## 軽量 LLM のプロンプト & スキーマ（そのまま使える）

### JSON Schema（バリデーション用）

```json
{
  "type": "object",
  "properties": {
    "summary": { "type": "array", "items": { "type": "string" }, "minItems": 3, "maxItems": 5 },
    "actions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "text": { "type": "string" },
          "owner": { "type": "string" },
          "due": { "type": "string" }
        },
        "required": ["text"],
        "additionalProperties": false
      },
      "maxItems": 3
    }
  },
  "required": ["summary", "actions"],
  "additionalProperties": false
}
```

### System（日本語・短く・厳しめ）

```
あなたは会議メモの要点抽出アシスタントです。
直近の会話ダイジェストから、日本語の短い箇条書きで要点(summary 3〜5行)とアクション(actions 0〜3件)を作成します。
事実のみ。誇張や推測はしない。体言止めを推奨。文は簡潔に。
出力は必ず指定のJSONスキーマに完全一致させ、余計な文字や説明は一切出力しないこと。
```

### User（テンプレ）

```
直近の会話ダイジェスト:
----
{{DIGEST}}
----
出力は JSON のみ（summary と actions）。規定のスキーマに完全一致させてください。
```

> **Gemini 利用時**：`generationConfig.responseSchema` と `responseMimeType: "application/json"` を必ず指定し、`response.text()` を JSON.parse する。JSON 崩壊時はリトライ＆前回値を返す。

---

## 疑似コード（最小）

```ts
transcriptEmitter.on("transcript", async (chunk: TranscriptChunk) => {
  minutesState.ingest(chunk); // confidence/結合/窓抽出まで
  const digest = minutesState.buildDigest(chunk.meetingId);
  const now = Date.now();

  if (!digest || digest.length < 40) return;
  const digestHash = hash(digest);
  const prev = minutesState.get(chunk.meetingId);
  if (prev && prev.lastHash === digestHash) return;
  if (prev && now - prev.lastEmitAt < EMIT_INTERVAL_SEC * 1000) return;

  let live: LiveMinutes | null = null;
  try {
    live = await smallLLM.summarizeToJSON(digest);
  } catch (err) {
    minutesLogger.warn("summarize failed, retry once", { err });
    try {
      live = await smallLLM.summarizeToJSON(digest);
    } catch (err2) {
      minutesLogger.error("retry also failed", { err: err2 });
      live = prev?.lastLive ?? null;
    }
  }

  if (!live) return; // 無音より直前値再送が無い場合はここで終了

  minutesState.save(chunk.meetingId, {
    lastLive: live,
    lastHash: digestHash,
    lastEmitAt: now,
  });

  liveMinutesEmitter.emit("minutes", {
    meetingId: chunk.meetingId,
    live,
    emittedAt: now,
  });
});
```

---

## テスト（最小・実運用を邪魔しない）

- **前処理ユニット**：低 confidence やノイズ断片が捨てられ、結合・窓抽出が正しく行われること。
- **スキーマ検証**：`smallLLM.summarizeToJSON` の戻り値が **JSON Schema に通る**こと（LLM は実呼び出し。失敗しがちな環境では `it.skip` 可）。
- **SSE 疑似**：疑似断片を minutes サービスに流し込み、`types=minutes` で接続したクライアントに `minutes.partial` が届く / `ping` は継続し、差分＆レート制御が効いていること。
- **TTL 動作（オプション）**：`STATE_TTL_MIN` 経過後に状態が破棄され、新しい transcript で再初期化されること。

> どうしても CI で LLM を叩きたくない場合のみ、\*\*固定 JSON を返す“軽量スタブ”\*\*に切替可能にしておいてください（本番コードは常に LLM を叩く）。

---

## 依頼メッセージ（コピペ用）

```
# 実装依頼: リアルタイム議事録（SSE）軽量LLM常時ON

目的: 文字起こし(JSONL)から直近90秒のダイジェストを作り、軽量LLMで「summary(3–5) / actions(0–3)」をJSON生成し、30秒目安で SSE 配信する。

要件:
- LLMは常時ON（OFFはなし）。JSON Schema厳守、崩れたら1回だけ再試行、ダメなら直前の正常値を再送。
- 差分＆レート制御で連投しない。メモリのみ。STATE_TTL_MINで破棄。
- SSE: GET /v1/meetings/:meetingId/stream?types=minutes / event: minutes.partial
- ws-relay の `transcriptEmitter` を購読して minutes を更新（import されれば常時起動）。
- LLMは Google Gemini (`gemini-2.0-flash`) 固定。`@google/genai` を使い、`responseMimeType: "application/json"` + `responseSchema` を指定する。

提供物:
- 実装コード一式（Node18+/TS）
- README（起動/環境変数/API）
- テスト（前処理/スキーマ/SSE差分）※ LLM実呼び出しが難しければ該当テストは it.skip でOK

環境変数:
GOOGLE_GENAI_API_KEY=<set>

備考:
- ディレクトリ構成は任意。I/F（型・API・関数名）は維持してください。
- LLMプロンプトとJSON Schemaは添付テンプレに従ってください。
- `services/src/configs/env.ts` に `GOOGLE_GENAI_API_KEY` 等を追加し、環境変数ドキュメントも更新してください。
```

---

## 補足（プロジェクトに合わせた柔軟ポイント）

- **ノイズ語・重要語**は `config/*.txt` に出しておくと非エンジニアでも差し替えやすい。
- **ウィンドウ/間隔**は負荷と品質で調整（例：`WINDOW_SEC=30`, `EMIT_INTERVAL_SEC=8`）。
- **アクション表現**はまず `text` のみ。`owner/due` は見つかった時だけ入れる（空は入れない）。

---
