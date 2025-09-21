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

## 3. minutes の後段だけを切り分けて確認（transcriptEmitter を直接叩く）

Gladia までは動いているが minutes が出ない、あるいは WebSocket を扱わず minutes だけ確認したい場合は、`transcriptEmitter` に直接イベントを流して検証できます。

### 手順
1. サーバー (`pnpm --filter server dev`) を起動したまま、別ターミナルで Node REPL を開く：
   ```bash
   cd services
   node --experimental-repl-await
   ```

2. REPL で以下を実行：
   ```js
   const { transcriptEmitter } = await import('./src/services/ws-relay.service.js');

   transcriptEmitter.emit('transcript', {
     meetingId: 'mock-meeting-001',
     text: '公開スケジュールは来週決定予定です',
     language: 'ja',
     isFinal: true,
     confidence: 0.9,
     timestamp: new Date().toISOString(),
   });
   ```
   - `meetingId` は SSE で確認したい ID。
   - `isFinal`, `language`, `confidence` の条件を満たさないと minutes は生成されません。

3. 別ターミナルで SSE を購読：
   ```bash
   curl -N \
     -H "Authorization: Bearer <任意のトークン>" \
     -H "x-meeting-baas-api-key: <Meeting BaaS API キー>" \
     "http://localhost:<PORT>/v1/meetings/mock-meeting-001/stream?userId=test&types=minutes"
   ```
   `event: minutes.partial` が出力されれば、minutes サービス～SSE の流れが正常に動作していると確認できます。

4. 上記を複数回行うと差分制御／レート制御がどう効くかもテストできます。

### スクリプトで minutes を模擬する

REPL を使わずに minutes の後段だけを検証したい場合は、用意済みのヘルパースクリプトを実行します。

```bash
pnpm exec tsx tests/helpers/mock-transcript.ts --meetingId=mock-meeting-001 --text="公開スケジュールは来週決定" --text="Figma 共有を依頼"
```

| オプション | 説明 | 既定値 |
| --- | --- | --- |
| `--meetingId=<id>` | SSE 側と合わせたい meetingId | `mock-meeting-001` |
| `--text="..."` | 送信する transcript 文。複数指定可 | デフォルト文 2 行 |
| `--language=ja` | 言語コード | `ja` |
| `--confidence=0.9` | 信頼度（minutes は 0.55 以上が必要） | `0.9` |
| `--isFinal=true` | transcript を確定扱いにするか | `true` |

スクリプトを実行したあと、SSE を購読していれば即座に `event: minutes.partial` が流れてくるはずです。minutes が出ない場合は、上記オプションがフィルタ条件を満たしているか確認してください。

---

## 4. minutes が配信されない場合のチェックリスト

| 確認項目 | 詳細 |
| --- | --- |
| meetingId が一致しているか | `/mb-input` 接続時と SSE リクエストで同じ文字列を使っているか。URL を meetingId にする場合は SSE 側で URL エンコードする必要があります。 |
| transcript が届いているか | `services/logs/transcripts-*.jsonl` やコンソールログ（`📝 Transcript`）で `isFinal: true` / `language: "ja"` の行があるか確認。 |
| confidence が 0.55 以上か | 低すぎる transcript は minutes の対象外になります。必要であれば `services/src/configs/minutes.config.ts` の `CONF_MIN` を調整してください。 |
| digest が作られているか | 45 秒以内に合計 40 文字以上の transcript がないと LLM を呼びません。任意のテキストを emit してテストすると切り分けが容易です。 |
| Gemini エラーが出ていないか | `pnpm dev` のターミナルに `Gemini summarize failed` が表示されていないか確認。API キーやレスポンスの JSON 化エラーが原因の場合があります。 |

---

## 5. 参考
- minutes の実装詳細：`services/src/services/live-minutes.service.ts`
- SSE コントローラ：`services/src/controllers/streams.controller.ts`
- WebSocket リレー：`services/src/services/ws-relay.service.ts`

上記ファイルを読みながらテスト用 emit を組み合わせることで、問題箇所を切り分けできます。
