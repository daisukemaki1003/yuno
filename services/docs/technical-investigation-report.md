# 技術調査レポート - Yuno WebSocketリレーサービス

## 目次
1. [プロジェクト基盤](#プロジェクト基盤)
2. [テスト対象の機能一覧](#テスト対象の機能一覧)
3. [外部APIとの契約](#外部APIとの契約)
4. [ストリーム＆ログ仕様](#ストリームログ仕様)
5. [エラーハンドリングと期待挙動](#エラーハンドリングと期待挙動)
6. [実行方法・レポート](#実行方法レポート)
7. [実サンプル確認手順](#実サンプル確認手順)

---

## プロジェクト基盤

### A. 基本情報

| 項目 | 内容 |
|------|------|
| **ランタイム** | Node.js（推奨: 16以上）※package.jsonに明示的なバージョン指定なし |
| **言語とモジュール** | TypeScript 5.9.2 + ESM (ES Modules) |
| **テストランナー** | Jest 30.1.3（ts-jest 29.4.1でTypeScriptサポート） |
| **HTTPフレームワーク** | Hono v4.9.6（@hono/node-server 1.19.1） |
| **パッケージマネージャ** | pnpm |

### 依存関係の概要

- **WebSocket**: `ws@8.18.3`
- **HTTP関連**: undici/cross-fetch は未使用
- **テスト関連**: msw は未使用、Jest のみ
- **その他主要ライブラリ**:
  - `@google-cloud/functions-framework@4.0.0`
  - `zod@4.1.5`（スキーマバリデーション）
  - `eventsource-parser@3.0.6`（SSEパーサー）

---

## テスト対象の機能一覧

### B. ルートとメソッド（すべて実装済み）

| エンドポイント | メソッド | 実装状態 | 認証 | 説明 |
|---------------|---------|---------|------|------|
| `/healthz` | GET | ✅ 実装済み | なし | ヘルスチェック、`wsRelay.activeSessions`を含む |
| `/v1/bots` | POST | ✅ 実装済み | Bearer + APIキー | ボット追加、冪等性サポート |
| `/v1/bots/:botId` | DELETE | ✅ 実装済み | Bearer + APIキー | ボット削除（注：パラメータ名は`:botId`） |
| `/v1/meetings/:meetingId/stream` | GET | ✅ 実装済み | Bearer + APIキー | SSEでトランスクリプト配信 |
| `/mb-input` | WS | ✅ 実装済み | オプション | WebSocketリレー（開発環境のみ） |

### ミドルウェア

- **Bearer認証**: `Authorization: Bearer {token}` ヘッダーの検証
- **Meeting BaaS APIキー**: `x-meeting-baas-api-key` ヘッダーの抽出
- **リクエストID付与**: 自動的にUUIDを生成
- **エラーハンドリング**: 統一されたエラーレスポンス形式

---

## 外部APIとの契約

### C. Meeting BaaS API

**ベースURL**: 環境変数 `MEETING_BAAS_BASE_URL` で設定

| エンドポイント | メソッド | 認証ヘッダー |
|---------------|---------|-------------|
| `/bots/` | POST | `x-meeting-baas-api-key: {key}` |
| `/bots/:botId` | DELETE | `x-meeting-baas-api-key: {key}` |

**リクエスト例（ボット追加）**:
```json
{
  "bot_name": "Meeting Bot",
  "meeting_url": "https://example.com/meeting",
  "reserved": false,
  "recording_mode": "speaker_view",
  "entry_message": "I am a good meeting bot :)",
  "speech_to_text": {
    "provider": "Default"
  },
  "automatic_leave": {
    "waiting_room_timeout": 600
  },
  "streaming": {
    "audio_frequency": "16khz",
    "input": "wss://your-domain.com/mb-input",
    "output": "wss://your-domain.com/mb-input"
  }
}
```

**レスポンスステータスマッピング**:
- `created`, `joining` → `joining`
- `joined`, `ready` → `joined`
- `leaving` → `leaving`
- `left` → `left`
- `error`, `failed` → `error`

### Gladia Live API

**初期化エンドポイント**: `POST https://api.gladia.io/v2/live`

**認証**: `X-Gladia-Key: {GLADIA_API_KEY}`

**接続フロー**:
1. POSTリクエストで初期化（音声形式を指定）
2. レスポンスのWebSocket URLに接続
3. オプションで設定メッセージを送信
4. 音声データの送信とトランスクリプト受信

---

## ストリーム＆ログ仕様

### D. SSEイベント形式

**形式**: 標準SSE形式
```
event: {イベント名}
data: {JSONデータ}

```

**イベントタイプ**:
- `transcript`: トランスクリプトデータ
- `ping`: キープアライブ（20秒間隔）
- `error`: エラー通知

### トランスクリプトイベントのフィールド

```typescript
{
  type: 'transcript',
  data: {
    kind: 'transcript',
    text: string,      // トランスクリプトテキスト
    lang: string,      // 言語コード
    isFinal: boolean,  // 最終確定フラグ
    ts: number,        // タイムスタンプ（ミリ秒）
    confidence?: number // 信頼度スコア（オプション）
  },
  timestamp: number    // イベントタイムスタンプ（ミリ秒）
}
```

### ログ出力仕様

**ファイル形式**: JSON Lines (`.jsonl`)  
**ファイル名**: `logs/transcripts-YYYY-MM-DD.jsonl`

**ログエントリ例**:
```json
{
  "meetingId": "meeting-123",
  "text": "こんにちは、会議を始めましょう",
  "language": "ja",
  "isFinal": true,
  "confidence": 0.95,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "loggedAt": "2024-01-15T10:30:00.123Z"
}
```

**フィルタリング**:
- コンソールログ: `isFinal === true` のみ出力
- ファイルログ: すべてのトランスクリプトを記録

### タイムアウト・リトライ設定

| 項目 | 設定値 | 環境変数 |
|------|--------|----------|
| Meeting BaaSリクエストタイムアウト | 15秒 | `MEETING_BAAS_TIMEOUT_REQUEST_MS` |
| Meeting BaaSストリーミングタイムアウト | 600秒 | `MEETING_BAAS_TIMEOUT_STREAM_MS` |
| WebSocket再接続基本遅延 | 5秒 | `STREAM_RECONNECT_BASE_MS` |
| 最大再接続遅延 | 60秒 | ハードコード |
| キープアライブ間隔 | 20秒 | ハードコード |

### 同時セッション管理

- **セッション上限**: 明示的な上限なし（メモリ制限まで）
- **重複防止**: 同一meetingIdの既存セッションがある場合、新規接続を拒否
- **バックプレッシャー制御**: 音声キューの最大サイズ5MB（`STREAM_BACKPRESSURE_MAX_BUFFER`）

---

## エラーハンドリングと期待挙動

### E. HTTPステータスコードのマッピング

| Meeting BaaS レスポンス | APIレスポンス | ログ出力 |
|------------------------|--------------|----------|
| 401 Unauthorized | 401 | エラーログ（詳細なし） |
| 403 Forbidden | 403 | エラーログ（詳細なし） |
| 5xx エラー | 500 | スタックトレース付きエラーログ |

### SSEエラーハンドリング

- **接続エラー**: `error`イベントを送信後、接続を閉じる
- **データ破損**: エラーログを記録し、処理を継続
- **タイムアウト**: クライアント側で`retry: 5000`により自動再接続

### エラーレスポンス形式

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid API key",
    "details": {}
  }
}
```

---

## 実行方法・レポート

### F. プロジェクト実行

| 項目 | コマンド |
|------|---------|
| パッケージマネージャー | pnpm |
| 依存関係インストール | `pnpm install` |
| 開発サーバー起動 | `pnpm dev` |
| 本番ビルド | `pnpm build` |
| テスト実行 | `pnpm test` |

### テスト設定

- **テストランナー**: Jest 30.1.3
- **カバレッジ閾値**: 未設定（推奨: 80%以上）
- **CI連携**: 未実装

---

## 実サンプル確認手順

### 1. 環境準備

```bash
# 1. 依存関係のインストール
cd services
pnpm install

# 2. 環境変数の設定
cp .env.example .env
# .envファイルを編集し、必要な値を設定
```

### 2. モックサーバーの起動（開発環境）

```bash
# Meeting BaaSモックサーバーを起動
pnpm mock:mb

# 別ターミナルでメインサーバーを起動
pnpm dev
```

### 3. WebSocket接続テスト

```bash
# wscat がインストールされていない場合
npm install -g wscat

# WebSocket接続
wscat -c "ws://localhost:8000/mb-input?meetingId=test-meeting-001"

# 認証が必要な場合
wscat -c "ws://localhost:8000/mb-input?meetingId=test-meeting-001&auth=your-token"
```

### 4. ボット追加とストリーミングテスト

```bash
# 1. ボットを追加
curl -X POST http://localhost:8000/v1/bots \
  -H "Authorization: Bearer test-token" \
  -H "x-meeting-baas-api-key: test-key" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_url": "https://example.com/meeting",
    "bot_name": "Test Bot"
  }'

# 2. SSEストリームに接続
curl -N http://localhost:8000/v1/meetings/test-meeting-001/stream?types=transcript \
  -H "Authorization: Bearer test-token" \
  -H "x-meeting-baas-api-key: test-key"
```

### 5. ログ確認

```bash
# リアルタイムログの確認
tail -f logs/transcripts-$(date +%Y-%m-%d).jsonl

# 特定のmeetingIdのログを抽出
grep '"meetingId":"test-meeting-001"' logs/transcripts-*.jsonl
```

### 6. 実データサンプルの収集

実際のSSEイベントとログエントリを収集するには：

1. **SSEイベントのキャプチャ**:
```bash
# curlの出力をファイルに保存
curl -N http://localhost:8000/v1/meetings/{meetingId}/stream?types=transcript \
  -H "Authorization: Bearer {token}" \
  -H "x-meeting-baas-api-key: {key}" \
  > sse-events-sample.txt
```

2. **JSONLログの確認**:
```bash
# 最新のログから5行を取得
tail -n 5 logs/transcripts-$(date +%Y-%m-%d).jsonl | jq .
```

3. **WebSocket音声データの記録**（開発用）:
```javascript
// Node.jsスクリプト例
const WebSocket = require('ws');
const fs = require('fs');

const ws = new WebSocket('ws://localhost:8000/mb-input?meetingId=test-001');
const audioStream = fs.createWriteStream('audio-sample.raw');

ws.on('open', () => console.log('Connected'));
ws.on('message', data => audioStream.write(data));
ws.on('close', () => audioStream.end());
```

### 7. 検証ポイント

- [ ] WebSocket接続が確立されること
- [ ] 音声データがGladia APIに転送されること
- [ ] トランスクリプトがSSEで配信されること
- [ ] ログファイルに正しい形式で記録されること
- [ ] エラー時の再接続が機能すること
- [ ] 同一meetingIdの重複接続が拒否されること

---

## 付録: 推奨される改善点

1. **テストカバレッジの向上**
   - 現在2つのテストファイルのみ
   - 統合テストの追加が必要

2. **CI/CD設定**
   - GitHub Actionsワークフローの作成
   - 自動テストとカバレッジレポート

3. **監視とアラート**
   - メトリクスの収集（Prometheus形式など）
   - エラー率の監視

4. **ドキュメント**
   - API仕様書（OpenAPI）の作成
   - デプロイメント手順の文書化