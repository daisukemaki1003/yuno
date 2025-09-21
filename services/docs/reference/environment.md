# Environment Variables

`src/configs/env.ts` で検証している環境変数の一覧です。`pnpm --filter server dev` などを実行する前に設定してください。

| 名前 | 必須 | デフォルト | 用途 |
| --- | --- | --- | --- |
| `PROJECT_ID` | 必須 | なし | GCP プロジェクト ID。ログ出力や将来のデプロイ設定で利用します。 |
| `REGION` | 必須 | なし | GCP リージョン。ログに出力され、Cloud Functions へのデプロイ時に使用予定です。 |
| `KMS_KEY_NAME` | 必須 | なし | Key Store 連携を想定した KMS キー名。現状は未使用ですが、環境バリデーション上必須です。 |
| `MEETING_BAAS_BASE_URL` | 必須 | なし | Meeting BaaS API のベース URL (`meetingbaas.config.ts`)。 |
| `FIRESTORE_EMULATOR_HOST` | 任意 | なし | Firestore エミュレーター接続用。現在の実装では参照していません。 |
| `MEETING_BAAS_TIMEOUT_REQUEST_MS` | 任意 | `15000` | Meeting BaaS REST API のタイムアウト (ms)。数値または数値文字列。 |
| `MEETING_BAAS_TIMEOUT_STREAM_MS` | 任意 | `600000` | Meeting BaaS ストリーミングのタイムアウト (ms)。 |
| `GLADIA_API_KEY` | 必須 | なし | Gladia Live API 認証キー。WebSocket リレーで使用します。 |
| `PUBLIC_WS_BASE` | 必須 | なし | Meeting BaaS アダプターが WebSocket 入出力 URL を伝える際に利用するベース URL。 |
| `STREAM_RECONNECT_BASE_MS` | 任意 | `5000` | Gladia 再接続時のベース遅延 (指数バックオフの初期値)。 |
| `STREAM_BACKPRESSURE_MAX_BUFFER` | 任意 | `5242880` | 音声フレームのバッファ上限 (バイト数)。超過時は古いフレームを破棄します。 |
| `GLADIA_SEND_WS_CONFIG` | 任意 | `false` | Gladia 接続後に初期設定メッセージを送信するかどうか。`true/false` 文字列または boolean。 |
| `WS_RELAY_AUTH_TOKEN` | 任意 | なし | `/mb-input` WebSocket の認証トークン。設定するとクライアント側で一致する値が必要になります。 |

> 数値系の環境変数は文字列でも指定できます (例: `STREAM_RECONNECT_BASE_MS="5000"`)。`env.ts` で `zod` によるバリデーションが行われ、無効な値は起動時にエラーとなります。
