# API Reference

`services` が提供する API 一覧です。すべての HTTP エンドポイントは `src/routes` 配下で定義され、SSE/ WebSocket は `src/controllers` および `src/services` で実装されています。

## HTTP Endpoints
| Method | Path | 説明 | 認証 | ハンドラー |
| --- | --- | --- | --- | --- |
| `GET` | `/healthz` | サービスのヘルスチェック。WebSocket リレーの統計を含む JSON を返します。 | 不要 | `routes/_router.ts` |
| `POST` | `/v1/bots` | Meeting BaaS にボット参加を要求します。 | `Authorization: Bearer <token>` + `x-meeting-baas-api-key` | `controllers/bots.controller.ts::addBot` |
| `DELETE` | `/v1/bots/:botId?userId=` | Meeting BaaS からボット離脱を要求します。 | `Authorization: Bearer <token>` + `x-meeting-baas-api-key` | `controllers/bots.controller.ts::leaveBot` |
| `GET` | `/v1/meetings/:meetingId/stream` | SSE によるリアルタイム transcript 配信。クエリで `userId`、`mode`、`types` を指定します。 | `Authorization: Bearer <token>` + `x-meeting-baas-api-key` | `controllers/streams.controller.ts::recordingSse` |

### SSE クエリパラメーター
- `userId` (必須): Meeting BaaS 認証に利用するユーザー ID。
- `mode` (任意): `raw` または `normalized`。現在の実装では `raw` を想定しています。
- `types` (任意): `audio,transcript,event` のカンマ区切り。未指定時は 3 種類すべてを購読します。

SSE では 20 秒ごとに `event: ping` を送信し、`event: transcript` に文字起こしデータが格納されます。文字列長が 32 KB を超える場合はサーバー側でテキストをトリミングします。

#### `curl` でのストリーム購読例
```bash
curl -N \
  -H "Accept: text/event-stream" \
  -H "Cache-Control: no-cache" \
  -H "Authorization: Bearer <token>" \
  -H "x-meeting-baas-api-key: <api-key>" \
  "http://localhost:8787/v1/meetings/<meetingId>/stream?userId=<userId>&mode=raw&types=transcript"
```
- `-N` (`--no-buffer`) でバッファリングを無効化し、イベントをリアルタイムに表示します。
- SSE は永続接続のため、コマンドは受信待機を継続します。`types` を絞ることで不要なイベントを省けます。
- 認証が不要なローカル実行環境では該当ヘッダーを省略してください。

## WebSocket Endpoint
| Path | 説明 | 認証 | ハンドラー |
| --- | --- | --- | --- |
| `/mb-input` | Meeting BaaS からの音声ストリーム入力。バイナリ音声を受け取り Gladia へ転送します。 | `WS_RELAY_AUTH_TOKEN` をクエリ `auth` またはヘッダー `x-auth-token` で指定 (未設定時は不要) | `services/ws-relay.service.ts::setupWebSocketRelay` |

### 接続時の挙動
- 接続成功後、サーバーは `{"type":"ready"}` を送信します。
- クエリに `meetingId` を指定するとセッションが紐づけられ、SSE フィルタリングに利用されます。
- テキストメッセージで `{"meetingId": "..."}` を再送するとミーティング ID を更新できます。
- 切断時やエラー時には自動的にセッションがクリーンアップされます。

## 認証とヘッダー
- Bearer 認証は形式のみを検証しています (トークン内容の検証は未実装)。
- Meeting BaaS API キーは `x-meeting-baas-api-key` で送信します。将来的には Key Store 経由で取得する予定です。
- すべてのレスポンスには `X-Request-Id` が付与され、ログとトレースを紐づけることができます。
