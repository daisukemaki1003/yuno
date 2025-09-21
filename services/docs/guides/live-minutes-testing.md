# リアルタイム議事録機能の検証手順

Gladia までの連携が済んでいる前提で、minutes（`minutes.partial`）が正しく配信されるかをローカルで確認する手順です。会議 URL を ID として扱う場合／任意の ID を使う場合の双方に対応しています。minutes の後段だけを素早く調べたい場合は「スクリプトで minutes を模擬する」節から読み始めてください。

---

## 1. 事前準備

### 必須環境変数
- `GLADIA_API_KEY`
- `GOOGLE_GENAI_API_KEY`
- `PROJECT_ID`, `REGION`

`.env` や `.env.local` に設定したら、`pnpm install` を済ませておきます。

### サーバー起動
```bash
cd services
pnpm --filter server dev
```
ポートは `.env` の `PORT` に従います（未指定時は `3000`）。

### 録音→議事録のデータフロー概要
```
Meeting BaaS (WebSocket) -> ws-relay.service (Gladia 中継) -> transcriptEmitter
                                              ↓
                                     live-minutes.service (Gemini)
                                              ↓
                           /v1/meetings/:meetingId/stream (SSE)
```

---

## 2. 実環境に近い確認（WebSocket 経由）

1. Meeting BaaS から本番と同じ形式で `/mb-input` へ接続する。例：
   ```
   wss://<PUBLIC_WS_BASE>/mb-input?meetingId=my-meeting-001&auth=<token>
   ```
   - `meetingId` は議事録を確認したい ID。URL ではなく任意の ID で構いません。
   - `auth` は `WS_RELAY_AUTH_TOKEN` を設定している場合のみ必要。

2. Gladia まで音声が届くと、`services/logs/transcripts-YYYY-MM-DD.jsonl` に transcript が追記されます。ログに `isFinal: true`・`language: "ja"` の行があることを確認してください。

3. 別ターミナルで minutes の SSE を購読：
   ```bash
   curl -N \
     -H "Authorization: Bearer <任意のトークン>" \
     -H "x-meeting-baas-api-key: <Meeting BaaS API キー>" \
     "http://localhost:<PORT>/v1/meetings/my-meeting-001/stream?userId=test&types=minutes,transcript"
   ```
   - `meetingId` は WebSocket で渡したものと同じにする。
   - `types` に `minutes` を含めると `event: minutes.partial` が配信されます。
    - 認証ヘッダーを省略すると `MISSING_AUTH` で弾かれるので注意。

4. transcript が確定 (`isFinal=true`) すると `event: transcript` と `event: minutes.partial` が届きます。届かない場合は下記の「原因切り分け」を参照してください。

---

## 3. minutes の後段だけを切り分けて確認（モック transcript API）

Gladia までの経路をスキップして minutes だけを検証したい場合は、開発環境専用の `POST /v1/meetings/:meetingId/mock-transcripts` を利用します（`NODE_ENV=production` の場合は 403 を返します）。このエンドポイントは `transcriptEmitter` に直接イベントを投入し、`live-minutes.service` と SSE までの処理をそのまま通します。

### ヘルパースクリプトを使う

もっとも簡単な方法は `tests/helpers/mock-transcript.ts` を実行することです。デフォルトで `services/tests/fixtures/transcripts.sample.jsonl` の 3 行（合計 80 文字以上）を送信し、minutes が生成される条件を満たします。

```bash
cd services
pnpm exec tsx tests/helpers/mock-transcript.ts --meetingId=mock-meeting-001
```

- 認証ヘッダーはスクリプトが自動で付与します（`Authorization: Bearer mock-script-token` と `x-meeting-baas-api-key: 0ad6…2613`）。
- `--text "..."` を指定すると、フィクスチャの代わりに任意の transcript 文を送信できます（複数指定可、各行 40 文字以上になるようにする）。
- タイムスタンプは 1.5 秒刻みで付与されるため、`MERGE_GAP_MS` を超えた個別発話として扱われます。
- SSE の購読は前節と同じ `curl …/stream` を利用してください。実行中のターミナルで `event: minutes.partial` が届けば成功です。

スクリプト実行後は `pnpm --filter server dev` 側で次のようなログを確認できます。
- `Mock transcripts emitted` … エンドポイントが受け取った件数
- `Transcript accepted / merged / ignored` … 発話が minutes の条件を満たしたかどうか
- `Digest candidate queued` と `Minutes generated` … Gemini へのリクエストと minutes.partial 送信が行われたサイン

### curl で直接叩く

同じエンドポイントを curl からも利用できます。サンプル：

```bash
curl -X POST \
  -H "Authorization: Bearer mock-script-token" \
  -H "x-meeting-baas-api-key: 0ad6e9166b8f6c4f4258d6207e5427a1d8049ea1ea6b8f52c9557b72440e2613" \
  -H "Content-Type: application/json" \
  "http://localhost:<PORT>/v1/meetings/mock-meeting-001/mock-transcripts" \
  -d '[
    {
      "text": "公開スケジュールは来週水曜までに最終版を確定します",
      "language": "ja",
      "isFinal": true,
      "confidence": 0.9
    },
    {
      "text": "Figmaの共有資料を最新に更新して担当者へ連絡してください",
      "language": "ja",
      "isFinal": true,
      "confidence": 0.9
    }
  ]'
```

リクエストボディは JSON (単一オブジェクト／配列どちらでも可) で、`meetingId` を省略した場合は URL パラメータが使われます。

### 旧来の直接 emit も可能（参考）

開発用に `transcriptEmitter.emit` を直接呼びたい場合は、従来通り Node REPL から実行できます。ただし複数人で同時に検証する際はモック API を使った方が安全です。

---

## 4. minutes が配信されない場合のチェックリスト

| 確認項目 | 詳細 |
| --- | --- |
| meetingId が一致しているか | `/mb-input` 接続時と SSE リクエストで同じ文字列を使っているか。URL を meetingId にする場合は SSE 側で URL エンコードする必要があります。 |
| transcript が届いているか | `services/logs/transcripts-*.jsonl` やコンソールログ（`📝 Transcript`）で `isFinal: true` / `language: "ja"` の行があるか確認。 |
| confidence が 0.55 以上か | 低すぎる transcript は minutes の対象外になります。必要であれば `services/src/configs/minutes.config.ts` の `CONF_MIN` を調整してください。 |
| digest が作られているか | 45 秒以内に合計 40 文字以上の transcript がないと LLM を呼びません。任意のテキストを emit してテストすると切り分けが容易です。 |
| Gemini エラーが出ていないか | `pnpm dev` のターミナルに `Gemini summarize failed` が表示されていないか確認。API キーやレスポンスの JSON 化エラーが原因の場合があります。 |

開発サーバーでは `Transcript accepted` / `Digest candidate queued` / `Minutes generated` などの info ログが出力されます。これらが出ていない場合は上記チェックリストを参照してください。

---

## 5. 参考
- minutes の実装詳細：`services/src/services/live-minutes.service.ts`
- SSE コントローラ：`services/src/controllers/streams.controller.ts`
- WebSocket リレー：`services/src/services/ws-relay.service.ts`

上記ファイルを読みながらテスト用 emit を組み合わせることで、問題箇所を切り分けできます。
