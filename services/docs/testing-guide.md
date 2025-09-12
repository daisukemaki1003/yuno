# WebSocket Relay テストガイド

このガイドでは、Meeting BaaS → WebSocket Relay → Gladia Live APIの音声文字起こしシステムをテストする手順を説明します。

## 必要な準備

1. **環境変数の設定** (`.env` ファイル)
   ```bash
   # 必須
   GLADIA_API_KEY=your-gladia-api-key
   PUBLIC_WS_BASE=wss://your-domain.com
   MEETING_BAAS_BASE_URL=https://api.meetingbaas.com
   ```

2. **ngrok のセットアップ** (ローカルテスト用)
   ```bash
   # 別ターミナルで実行
   ngrok http 8080
   ```
   表示されるHTTPS URLをメモし、`.env` の `PUBLIC_WS_BASE` を更新：
   ```
   PUBLIC_WS_BASE=wss://abc123.ngrok-free.app
   ```

## テスト手順

### 1. サーバーを起動

```bash
# 開発サーバーを起動
pnpm dev

# または、モックMeeting BaaSと一緒に起動
pnpm dev:mock
```

起動時に以下の情報が表示されます：
- ポート番号
- WebSocketパス (`/mb-input`)
- **文字起こしログファイルのパス** (`logs/transcripts-YYYY-MM-DD.jsonl`)

### 2. ヘルスチェック

```bash
curl http://localhost:8080/healthz
```

期待される応答：
```json
{
  "status": "ok",
  "streamMode": "ws-relay",
  "wsRelay": {
    "activeSessions": 0,
    "sessions": []
  }
}
```

### 3. ボットを追加

```bash
curl -X POST http://localhost:8080/v1/bots \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "x-meeting-baas-api-key: YOUR_MBAAS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "meetingUrl": "https://meet.google.com/xxx-yyyy-zzz",
    "botName": "Test Bot"
  }'
```

成功レスポンス例：
```json
{
  "botId": "bot_123456",
  "meetingId": "https://meet.google.com/xxx-yyyy-zzz",
  "status": "joining"
}
```

### 4. リアルタイム文字起こしを確認

#### 方法1: SSEストリームで確認

```bash
# 付属のスクリプトを使用
./test-stream.sh <MEETING_ID> <USER_TOKEN> <API_KEY>

# または直接curlで
curl -N "http://localhost:8080/v1/meetings/${MEETING_ID}/stream?userId=test&types=transcript" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "x-meeting-baas-api-key: ${API_KEY}" \
  -H "Accept: text/event-stream"
```

#### 方法2: コンソールログで確認

サーバーのコンソールに以下のような形式で最終的な文字起こし結果が表示されます：

```
📝 Transcript {
  text: "こんにちは、本日の会議を始めます",
  language: "ja",
  confidence: 0.95
}
```

**注意**: コンソールには最終的な文字起こし（`isFinal: true`）のみが表示されます。

### 5. ログファイルで詳細を確認

#### すべての文字起こしを確認

```bash
# 今日の最終文字起こしのみを表示
./view-transcripts.sh

# すべての文字起こし（部分的なものも含む）を表示
cat logs/transcripts-$(date +%Y-%m-%d).jsonl | jq

# 特定の言語のみ表示
cat logs/transcripts-$(date +%Y-%m-%d).jsonl | jq 'select(.language == "ja")'

# 最終文字起こしのみ表示
cat logs/transcripts-$(date +%Y-%m-%d).jsonl | jq 'select(.isFinal == true)'
```

#### エラーを確認

```bash
# エラーのみを表示
cat logs/transcripts-$(date +%Y-%m-%d).jsonl | jq 'select(.type == "error")'
```

#### ログファイルの形式

各行は1つのJSONオブジェクト（JSON Lines形式）：

```json
{
  "meetingId": "meeting_123",
  "text": "こんにちは",
  "language": "ja",
  "isFinal": false,
  "confidence": 0.85,
  "timestamp": "2025-09-12T10:30:00.000Z",
  "loggedAt": "2025-09-12T10:30:00.100Z"
}
```

### 6. ボットを削除

```bash
curl -X DELETE "http://localhost:8080/v1/bots/${BOT_ID}?userId=test-user" \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "x-meeting-baas-api-key: YOUR_MBAAS_API_KEY"
```

## トラブルシューティング

### 文字起こしが表示されない場合

1. **ログファイルを確認**
   ```bash
   # 最新のログを確認
   tail -f logs/transcripts-$(date +%Y-%m-%d).jsonl | jq
   ```

2. **WebSocket接続を確認**
   ```bash
   curl http://localhost:8080/healthz | jq '.wsRelay'
   ```

3. **エラーログを確認**
   ```bash
   cat logs/transcripts-$(date +%Y-%m-%d).jsonl | jq 'select(.type == "error")'
   ```

### よくある問題

- **401エラー**: Meeting BaaS APIキーが正しく設定されているか確認
- **403エラー**: Gladia APIキーが正しく設定されているか確認
- **文字起こしが遅い**: 音声データが十分に蓄積されるまで1-2秒待つ
- **文字起こしがない**: 実際に音声が含まれているか、無音でないか確認

## ログファイルの管理

- ログファイルは `logs/` ディレクトリに日付ごとに保存されます
- ファイル名: `transcripts-YYYY-MM-DD.jsonl`
- 古いログファイルは手動で削除する必要があります
- `.gitignore` に含まれているため、Gitには追加されません

## 開発のヒント

1. **部分的な文字起こしも確認したい場合**
   ```bash
   # ws-relay.service.ts を編集して、部分的な文字起こしもログに出力
   # isFinal のチェックを削除
   ```

2. **特定の会議のログのみ表示**
   ```bash
   cat logs/transcripts-$(date +%Y-%m-%d).jsonl | jq 'select(.meetingId == "YOUR_MEETING_ID")'
   ```

3. **リアルタイムでログを監視**
   ```bash
   tail -f logs/transcripts-$(date +%Y-%m-%d).jsonl | jq
   ```