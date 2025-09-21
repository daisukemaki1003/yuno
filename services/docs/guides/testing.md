# Testing Guide

`services` パッケージの自動テストおよび手動検証手順をまとめます。

## 前提条件
1. 依存関係のインストール
   ```bash
   pnpm install
   ```

2. `.env` ファイルの準備 (`services/.env` または環境変数で指定)
   ```bash
   PROJECT_ID=local-project
   REGION=asia-northeast1
   KMS_KEY_NAME=projects/local/locations/global/keyRings/dev/cryptoKeys/meeting-baas
   MEETING_BAAS_BASE_URL=https://api.meetingbaas.example.com
   GLADIA_API_KEY=replace-with-real-key
   PUBLIC_WS_BASE=wss://localhost:3000
   # 任意
   STREAM_RECONNECT_BASE_MS=5000
   STREAM_BACKPRESSURE_MAX_BUFFER=5242880
   GLADIA_SEND_WS_CONFIG=false
   WS_RELAY_AUTH_TOKEN=local-dev-token
   ```

## 自動テスト
`services` ディレクトリで以下を実行します。

```bash
pnpm --filter server lint
pnpm --filter server test
```

- `lint` は TypeScript/ESLint ルール違反を検知します。
- `test` は Jest によるユニットテストを実行します。必要に応じて `test:watch` や `test:coverage` も利用してください。

## ローカルサーバーの起動
```bash
pnpm --filter server dev
```

- HTTP サーバー (Hono) と `/mb-input` WebSocket サーバーが同一ポートで起動します。
- 起動時に `logs/transcripts-YYYY-MM-DD.jsonl` が生成され、Gladia からの transcript が追記されます。

## WebSocket リレーの動作確認
1. WebSocket クライアント (例: `wscat`) で接続します。
   ```bash
   wscat -c "ws://localhost:3000/mb-input?meetingId=demo&auth=local-dev-token"
   ```
2. 接続直後にサーバーから `{"type":"ready"}` が返ることを確認します。
3. テキストメッセージで `{"meetingId":"demo"}` を送信すると、セッションに Meeting ID が保持されます。
4. 実音声を送らない場合でも、`GET /healthz` でセッションが `activeSessions: 1` になっていることを確認できます。

> 音声フレームを送信する場合は、16kHz/16bit PCM (mono) のバイナリデータを WebSocket 経由で送ってください。Gladia API キーが有効であれば、後述の SSE で transcript を受信できます。

## SSE (録音ストリーム) の確認
1. 別ターミナルから下記コマンドを実行します。
   ```bash
   curl -N \
     -H "Authorization: Bearer dummy" \
     -H "x-meeting-baas-api-key: your-meeting-baas-key" \
     "http://localhost:3000/v1/meetings/demo/stream?userId=user-123&mode=raw&types=transcript"
   ```
2. 20 秒ごとに `event: ping` が届くことを確認します。
3. WebSocket から音声を送信すると、`event: transcript` が SSE で出力されます。

## トラブルシューティング
- `401 Unauthorized`: Bearer トークンまたは `WS_RELAY_AUTH_TOKEN` が一致しているか確認してください。
- Gladia との接続に失敗した場合はログに詳細が出力されます。API キーとネットワークアクセスを確認してください。
- Transcript が `logs/` に書き込まれない場合は、プロセスにファイル書き込み権限があるか確認してください。
