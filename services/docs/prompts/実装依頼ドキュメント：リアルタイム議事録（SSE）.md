---

# エージェント実装依頼：リアルタイム議事録（軽量LLM常時ON / SSE）

## 目的 / スコープ

* **目的**：会議中の文字起こし（JSONL断片）から、**10秒目安**で「いまの議事録」を**SSE**で配信する。
* **前提**：**軽量LLMを常時使用**して要点・文面整形を行う（OFFは無し）。
* **除外**：確定版の最終議事録、確認カード、DB保存、RAG、UI。

---

## 成果物（受け入れ基準 / DoD）

- 文字起こしを投入すると、**最大 15 秒以内**に `minutes.partial` が 1 回以上届く。
- SSE ペイロードは **日本語の箇条書き 3〜5 行**の `summary` と **0〜3 件**の `actions`。
- LLM 応答は**JSON Schema に適合**。崩れた場合は**1 回だけ自動再試行**し、それでも無理なら**直前の正常出力を再送**（黙るより安全）。
- 同じ内容を連投しない（差分＆レート制御が有効）。
- メモリのみで完結。最後の入力から **STATE_TTL_MIN** 経過でクリーンアップ。

---

## 入力（既存の JSONL 断片）

各行（例）：

```json
{
  "text": "デザインは後日共有します",
  "language": "ja",
  "isFinal": true,
  "confidence": 0.92,
  "timestamp": "2025-09-13T04:54:11.749Z",
  "loggedAt": "2025-09-13T04:54:11.749Z"
}
```

## 出力（SSE）

- ルート：`GET /minutes/live?meetingId=...`
- イベント名：`minutes.partial`
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
  confidence: number; // 0..1
  timestamp: string; // ISO
  loggedAt: string; // ISO
};

export type LiveMinutes = {
  summary: string[]; // 3..5
  actions: { text: string; owner?: string; due?: string }[]; // 0..3
};
```

---

## 設定（環境変数・値は調整可）

```
# 前処理
CONF_MIN=0.55           # これ未満の信頼度は捨てる
MERGE_GAP_MS=1200       # 断片結合の最大ギャップ(ms)
WINDOW_SEC=45           # 直近ウィンドウ(秒)
EMIT_INTERVAL_SEC=10    # 最短送出間隔(秒)
MAX_SUMMARY=5
MAX_ACTIONS=3
STATE_TTL_MIN=30        # 最終入力からの破棄(分)

# LLM（軽量・常時ON）
SMALL_MODEL_PROVIDER=openai     # openai|anthropic|azure など
SMALL_MODEL_NAME=gpt-4o-mini    # 例
SMALL_MODEL_MAX_TOKENS=320
SMALL_MODEL_TEMP=0.2
SMALL_MODEL_TIMEOUT_MS=4000
```

---

## 実装タスク（最小・手戻り小）

### 1) 前処理（純関数）

- **フィルタ**：`language==="ja" && isFinal && confidence>=CONF_MIN`
- **ノイズ除去**：`["えー","あの","その","なんか","はい","えっと","ですね"]` を軽く削る
- **断片結合**：`MERGE_GAP_MS` 以内は 1 発話に結合
- **窓抽出**：`WINDOW_SEC` 以内の発話を連結 → **digest（最大\~450 字）**
- **重複抑制**：文面の簡易ハッシュで重複行を弾く

### 2) 軽量 LLM サマライザ（常時 ON）

- 入力：`digest`（直近 45 秒の要約テキスト）
- 出力：`LiveMinutes`（`summary[3..5]`, `actions[0..3]`）※**JSON Schema で厳密検証**
- **再試行**：JSON 崩壊/タイムアウト時は**同じプロンプトで 1 回だけ再試行**。失敗時は**前回正常出力を再送**。
- **呼ぶ条件**：`digest.length >= 40` かつ **前回 digest から十分変化**（単純ハッシュ不一致で OK）

### 3) 状態と送出制御

- 会議 ID ごとの状態：`{ lastDigestHash, lastLive: LiveMinutes, lastEmitAt }`
- **差分＆レート**：`lastDigestHash` が同じ、または `EMIT_INTERVAL_SEC` 未満なら送らない
- **TTL**：`STATE_TTL_MIN` で自動破棄

### 4) SSE エンドポイント

- `GET /minutes/live?meetingId=...`

  - 接続時：`lastLive` があれば即 1 回送信
  - 以降：更新時に `event: "minutes.partial"` を送信
  - 15〜30 秒に一度 `:heartbeat\n\n` を送って接続維持

### 5) 既存 WS との接続

- 既存の WS 受信ハンドラから `onTranscript(chunk: TranscriptChunk)` を呼べる Adapter を 1 つ用意

---

## 軽量 LLM のプロンプト & スキーマ（そのまま使える）

### JSON Schema（バリデーション用）

```json
{
  "type": "object",
  "properties": {
    "summary": { "type": "array", "items": { "type": "string" }, "minItems": 1, "maxItems": 5 },
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

> **OpenAI 利用時**：`response_format: { type: "json_schema", json_schema: { name:"LiveMinutes", schema: <上記> } }` を使うと堅牢です。

---

## 疑似コード（最小）

```ts
function onTranscript(chunk: TranscriptChunk) {
  state.ingest(chunk); // confidence/結合/窓抽出まで
  const digest = state.buildDigest(chunk.meetingId);
  const now = Date.now();
  if (!digest || digest.length < 40) return;
  if (state.lastHash === hash(digest)) return;
  if (now - state.lastEmitAt < EMIT_INTERVAL_SEC * 1000) return;

  let live: LiveMinutes | null = null;
  try {
    live = await smallLLM.summarizeToJSON(digest); // 常時ON
  } catch {
    // 1回だけ再試行（プロバイダ障害吸収）
    live = await smallLLM.summarizeToJSON(digest);
  }
  if (!live) live = state.lastLive ?? { summary: [], actions: [] }; // 直前の正常値

  state.save({ lastLive: live, lastHash: hash(digest), lastEmitAt: now });
  sse.emit("minutes.partial", live);
}
```

---

## テスト（最小・実運用を邪魔しない）

- **前処理ユニット**：低 confidence やノイズ断片が捨てられ、結合・窓抽出が正しく行われること。
- **スキーマ検証**：`smallLLM.summarizeToJSON` の戻り値が **JSON Schema に通る**こと（LLM は実呼び出し。失敗しがちな環境では `it.skip` 可）。
- **SSE 疑似**：疑似断片を連投しても**差分＆間隔**が効き、連投しないこと。

> どうしても CI で LLM を叩きたくない場合のみ、\*\*固定 JSON を返す“軽量スタブ”\*\*に切替可能にしておいてください（本番コードは常に LLM を叩く）。

---

## 依頼メッセージ（コピペ用）

```
# 実装依頼: リアルタイム議事録（SSE）軽量LLM常時ON

目的: 文字起こし(JSONL)から直近45秒のダイジェストを作り、軽量LLMで「summary(3–5) / actions(0–3)」をJSON生成し、10秒目安で SSE 配信する。

要件:
- LLMは常時ON（OFFはなし）。JSON Schema厳守、崩れたら1回だけ再試行、ダメなら直前の正常値を再送。
- 差分＆レート制御で連投しない。メモリのみ。STATE_TTL_MINで破棄。
- SSE: GET /minutes/live?meetingId=... / event: minutes.partial
- 既存WSから onTranscript(chunk) を呼べば流れる。

提供物:
- 実装コード一式（Node18+/TS）
- README（起動/環境変数/API）
- テスト（前処理/スキーマ/SSE差分）※ LLM実呼び出しが難しければ該当テストは it.skip でOK

環境変数（初期値は任意変更可）:
CONF_MIN=0.55 MERGE_GAP_MS=1200 WINDOW_SEC=45 EMIT_INTERVAL_SEC=10 MAX_SUMMARY=5 MAX_ACTIONS=3 STATE_TTL_MIN=30
SMALL_MODEL_PROVIDER=openai SMALL_MODEL_NAME=gpt-4o-mini SMALL_MODEL_MAX_TOKENS=320 SMALL_MODEL_TEMP=0.2 SMALL_MODEL_TIMEOUT_MS=4000

備考:
- ディレクトリ構成は任意。I/F（型・API・関数名）は維持してください。
- LLMプロンプトとJSON Schemaは添付テンプレに従ってください。
```

---

## 補足（プロジェクトに合わせた柔軟ポイント）

- **ノイズ語・重要語**は `config/*.txt` に出しておくと非エンジニアでも差し替えやすい。
- **ウィンドウ/間隔**は負荷と品質で調整（例：`WINDOW_SEC=30`, `EMIT_INTERVAL_SEC=8`）。
- **アクション表現**はまず `text` のみ。`owner/due` は見つかった時だけ入れる（空は入れない）。

---
