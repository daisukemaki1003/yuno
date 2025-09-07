# Meeting BaaS Mock Server

Meeting BaaS（上流ベンダー）のローカルモックサーバーです。本番APIへの課金を避けながら開発・テストができます。

## 機能

- 本番と同じAPIエンドポイントを提供
- 複数のシナリオ（正常系、エラー系、遅延など）を切替可能
- SSEによるストリーミングをサポート
- Idempotency-Key対応
- 認証チェック（シナリオによる）

## エンドポイント

- `POST /v1/bots` - 新規ボット作成
- `POST|DELETE /v1/bots/:botId/leave` - ボット退出
- `GET /v1/meetings/:meetingId/recording` - SSEストリーム

## 起動方法

```bash
# モックサーバーを起動（デフォルトポート: 4010）
pnpm mock:meetingbaas

# 環境変数でシナリオを指定
MOCK_SCENARIO=rate_limit pnpm mock:meetingbaas

# 本体アプリをモックに向けて起動
pnpm dev:mock
```

## シナリオ

| シナリオ | 説明 | 環境変数 |
|---------|------|----------|
| `default` | 正常系（すべて成功） | - |
| `rate_limit` | 最初のN回は429エラー | `MOCK_RATE_LIMIT_N=2` |
| `flaky` | 最初のK回は503エラー | `MOCK_FLAKY_K=1` |
| `slow` | 3秒の遅延を追加 | - |
| `auth_required` | 認証ヘッダーを要求 | - |

## 環境変数

```env
MOCK_PORT=4010                    # モックサーバーのポート
MOCK_SCENARIO=default            # 使用するシナリオ
MOCK_RATE_LIMIT_N=2              # rate_limitシナリオで429を返す回数
MOCK_FLAKY_K=1                   # flakyシナリオで503を返す回数
MOCK_STREAM_DURATION_MS=60000    # SSEストリームの継続時間（ミリ秒）
```

## SSEイベント

ストリーミングエンドポイントは以下のイベントを送信します：

- `transcript` - 2秒ごとに送信される文字起こしデータ
- `audio` - 5秒ごとに送信される音声データ（ダミー）
- `ping` - 30秒ごとに送信されるキープアライブ
- `end` - ストリーム終了時
- `error` - エラー発生時（flakyシナリオ）

## 開発のヒント

1. **Idempotency-Key**: 同じキーで再送すると同じ応答が返ります
2. **認証**: `auth_required`シナリオでは`Authorization`または`X-API-Key`ヘッダーが必要
3. **データ**: `data/transcripts.ndjson`を編集してカスタムトランスクリプトを追加可能
4. **ログ**: 構造化ログがコンソールに出力されます