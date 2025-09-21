# Meeting BaaS Bot Management

Meeting BaaS のボットを会議へ参加／離脱させる HTTP API の実装をまとめます。実装コードは `src/controllers/bots.controller.ts`、`src/routes/bots.*.ts`、`src/services/meetingbaas.service.ts` および `src/clients/meetingbaas.*` に分割されています。

## 提供エンドポイント
| Method | Path | 認証 | 説明 |
| --- | --- | --- | --- |
| `POST` | `/v1/bots` | Bearer 認証 + `x-meeting-baas-api-key` | ボットを会議に参加させる |
| `DELETE` | `/v1/bots/:botId?userId=` | Bearer 認証 + `x-meeting-baas-api-key` | 会議からボットを離脱させる |

- いずれも `bearerAuth` と `extractMeetingBaasApiKey` ミドルウェアを通過し、Authorization ヘッダーと Meeting BaaS API キーを検証します。
- `userId` はリクエスト body (`POST`) またはクエリ (`DELETE`) で指定し、将来的なキー管理 (Key Store) へ引き継ぐための識別子として利用します。

## リクエスト処理フロー
1. `v1.router.ts` で `/v1/bots` パスが add/remove ルーターへ委譲されます。
2. コントローラー (`bots.controller.ts`) が `AddBotRequestSchema` / `LeaveBot*Schema` によるバリデーションを実施します。
3. `meetingbaas.service.ts` の `getMeetingBaasForUser` が一時的にプレーンな API キーを用いてアダプター (`createMeetingBaasAdapter`) を生成します。
4. アダプターは `meetingbaas.client.port.ts` で定義したポートインターフェースを通じて実装され、`meetingbaas.config.ts` の設定に従って Meeting BaaS API を呼び出します。
5. `POST /v1/bots` は Meeting BaaS のレスポンスから botId を取得し、ステータスを `joining` として返却します。Idempotency-Key ヘッダーが指定された場合は応答をキャッシュして重複リクエストに対応します。
6. `DELETE /v1/bots/:botId` は Meeting BaaS の離脱 API を呼び出し、成功時は 204 No Content を返します (Meeting ID との紐づけは将来の実装予定)。

## エラーハンドリング
- Meeting BaaS から返る代表的なエラー (`not found`, `conflict` など) をアプリケーション固有のエラーコードへマッピングしています。
- 未処理の例外は `utils/errors.ts` の `internal` を通じて 500 番台レスポンスに統一されます。
- リクエストバリデーション失敗時は 400 エラー (`INVALID_ARGUMENT`) が返ります。

## ロギングと監視
- 全リクエストには `Logger` が紐づき、ボット参加／離脱の操作ログやエラーが構造化ログとして出力されます。
- `Idempotency-Key` が指定された場合はキャッシュヒット時にもログを残します。

## 今後の拡張ポイント
- `meetingbaas.service.ts` には Key Store 連携の TODO があり、API キーの暗号化管理へ移行する予定です。
- Meeting ID と botId のマッピングを保持し、`leaveBot` 実行時に Meeting BaaS へ正確なコンテキストを提供できるよう改善する計画があります。
