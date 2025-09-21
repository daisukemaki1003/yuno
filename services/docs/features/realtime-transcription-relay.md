# Realtime Transcription Relay

Meeting BaaS からの音声ストリームを Gladia Live API へリレーし、SSE でクライアントへ配信する機能の実装概要です。主なコードは `src/index.ts`、`src/services/ws-relay.service.ts`、`src/controllers/streams.controller.ts`、`src/utils/transcript-logger.ts` にあります。

## 全体フロー
1. Meeting BaaS が WebSocket (`wss://<host>/mb-input`) に接続し、PCM 音声フレームを送信します。
2. `setupWebSocketRelay` が接続ごとにセッションを生成し、Gladia Live API との WebSocket を初期化します。
3. Gladia からの transcript イベントを受信すると、`transcriptEmitter` 経由で SSE クライアントへ通知し、同時に JSONL ファイルへ保存します。
4. クライアントは `GET /v1/meetings/:meetingId/stream` (SSE) に接続し、`types` クエリに `transcript` を含めることで文字起こし結果を受け取ります。

## WebSocket エントリーポイント
- `src/index.ts` が `/mb-input` へのアップグレード要求をハンドリングします。
- `WS_RELAY_AUTH_TOKEN` が設定されている場合、クエリまたは `x-auth-token` ヘッダー経由で一致するトークンが必要です。
- 接続時に `meetingId` クエリを受け取り、セッションを Meeting ID に紐づけて追跡します。

## Gladia 連携
- `ws-relay.service.ts` の `initializeGladiaSession` がシングルユースの Live API トークンを生成します。
- 接続断時には指数バックオフ (`STREAM_RECONNECT_BASE_MS`) で再接続し、キューに溜まった音声フレームを順次再送します。
- バックプレッシャー制御として、バッファサイズが `STREAM_BACKPRESSURE_MAX_BUFFER` を超えると古いフレームを破棄します。

## Transcript 配信
- Gladia からのメッセージは `handleGladiaMessage` で正規化され、`transcriptEmitter.emit("transcript", { ... })` により配信されます。
- `streams.controller.ts` の `recordingSse` が emitter を購読し、`event: transcript` として SSE 送信します。SSE は 20 秒ごとに keep-alive コメントと `ping` イベントを送出します。
- SSE クライアントは `types` クエリで受信するイベント種別を制御できます (デフォルトは `audio,transcript,event`)。

## ログと監視
- `transcript-logger.ts` が `logs/transcripts-YYYY-MM-DD.jsonl` に文字起こしとエラーを JSON Lines 形式で保存します。
- `GET /healthz` では `getRelayStats` の結果を返し、現在のセッション数・キューサイズなどを確認できます。

## エラー処理
- WebSocket の `error`／`close` イベントでは詳細なログを残し、必要に応じて再接続やセッション破棄を行います。
- SSE 側で例外が発生した場合は `event: error` を送出し、最終的にストリームをクリーンアップします。
