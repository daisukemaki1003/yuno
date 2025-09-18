# WebSocket Relay Production Patch - 安定稼働対応

## テスト手順

詳細なテスト手順については [testing-guide.md](./testing-guide.md) を参照してください。

## 概要

Meeting BaaS → WSリレー → Gladia Live APIのリアルタイム音声文字起こしを安定稼働させるための修正パッチです。

## 修正内容

### A) Gladia セッション初期化の改善
- ✅ `bit_depth: 16` をPOSTペイロードに追加
- ✅ URLのtokenパラメータをログでマスク
- ✅ X-Gladia-Key, Content-Type ヘッダを確実に設定

### B) Gladia WebSocket 接続の堅牢化
- ✅ `unexpected-response` イベントで403/4xxを捕捉し再接続
- ✅ 20秒間隔でping/pongによるKeep-Alive実装
- ✅ 接続世代管理で旧接続のハンドラを無効化
- ✅ `perMessageDeflate: false`, `handshakeTimeout: 10000` 設定
- ✅ transcript スキーマの正規化（utteranceオブジェクト対応）
- ✅ GLADIA_SEND_WS_CONFIG環境変数でconfig送信制御

### C) MBaaS → リレー送信の堅牢化
- ✅ ArrayBuffer/Buffer/TypedArrayの正規化処理
- ✅ O(1)計算量のバックプレッシャ管理（audioQueueBytes）
- ✅ 5MB超過時に古いフレームを間引き
- ✅ gladiaWs.bufferedAmount > 1MBでキューイング
- ✅ 音声受信ログをdebugレベルに変更

### D) MeetingBaaS アダプタの整合性
- ✅ Meeting BaaS用に `audio_frequency: "16khz"` を使用（Gladiaは `sample_rate: 16000`）
- ✅ streaming.outputフィールドを同じURLに設定
- ✅ Content-Type: application/json を常に付与
- ✅ `x-meeting-baas-api-key` ヘッダーで認証（Bearer形式ではない）
- ✅ leaveBot時の不要なボディ送信を削除
- ✅ ヘッダログのマスキング強化

### E) SSE配信の安定化
- ✅ retry: 5000 ディレクティブ送信
- ✅ 20秒間隔でkeep-aliveコメント（`: ping\n\n`）送信
- ✅ X-Accel-Buffering: no ヘッダ追加
- ✅ 32KB超のイベントデータを自動トランケート

### F) セキュリティ/運用の改善
- ✅ WS_RELAY_AUTH_TOKEN環境変数による認証
- ✅ 同一meetingIdの同時接続を1に制限
- ✅ HttpClientのログマスク機能実装

## 環境変数

```bash
# 必須
GLADIA_API_KEY=your-gladia-api-key
PUBLIC_WS_BASE=wss://your-domain.com
MEETING_BAAS_BASE_URL=https://api.example.com

# オプション
STREAM_RECONNECT_BASE_MS=5000          # 再接続基本遅延(ms)
STREAM_BACKPRESSURE_MAX_BUFFER=5242880 # バックプレッシャ最大バッファ(5MB)
GLADIA_SEND_WS_CONFIG=false            # WS接続後のconfig送信
WS_RELAY_AUTH_TOKEN=your-secret-token  # /mb-input認証トークン
MEETING_BAAS_TIMEOUT_REQUEST_MS=15000  # リクエストタイムアウト(ms)
MEETING_BAAS_TIMEOUT_STREAM_MS=600000  # ストリームタイムアウト(ms)
```

## 運用上の注意

### Cloud Run/Functions での運用
- アイドル切断対策のため、Keep-Aliveは必須
- セッションアフィニティを有効化
- タイムアウトを15分以上に設定

### 認証設定
`WS_RELAY_AUTH_TOKEN` を設定した場合、MBaaSからの接続時に以下のいずれかで認証が必要：
- クエリパラメータ: `?auth=your-secret-token`
- ヘッダ: `X-Auth-Token: your-secret-token`

### ログマスキング
以下の情報は自動的にマスクされます：
- URLのtokenパラメータ
- authorization, x-api-key, x-gladia-keyなどのヘッダ
- 認証トークン

## テスト方法

```bash
# 1. 403エラー再現テスト
# Gladiaの無効なトークンで接続し、自動再接続を確認

# 2. Keep-Aliveテスト
# 5分以上接続を維持し、切断されないことを確認

# 3. バックプレッシャテスト
# 大量の音声データを送信し、メモリ使用量が制限内に収まることを確認

# 4. 認証テスト
export WS_RELAY_AUTH_TOKEN=test-token
# 認証なし/誤った認証で401エラーを確認
```

## 主要な変更箇所

### 1. ws-relay.service.ts
- Gladia初期化に`bit_depth: 16`追加
- tokenマスク関数実装
- unexpected-responseハンドラ追加
- 接続世代管理
- Keep-Alive（ping/pong）実装
- ArrayBuffer正規化
- O(1)バックプレッシャ管理

### 2. meetingbaas.adapter.v1.ts
- streaming設定の修正
- Content-Typeヘッダ追加
- auth.scheme === "None"の処理修正
- ログマスキング強化

### 3. streams.controller.ts
- SSE retry ディレクティブ
- Keep-Aliveコメント送信
- X-Accel-Bufferingヘッダ
- 大きなイベントのトランケート

### 4. http.client.ts
- センシティブヘッダのマスク機能

### 5. index.ts
- /mb-input認証実装
- 404/401レスポンス改善

### 6. env.ts
- GLADIA_SEND_WS_CONFIG追加
- WS_RELAY_AUTH_TOKEN追加
- Meeting BaaS認証設定の環境変数を削除（固定値に変更）

## 完了条件の達成状況

✅ 403/4xx ハンドシェイク時に自動でセッション再発行＆再接続される
✅ 5分以上の無操作でも接続が維持される（切断時は指数バックオフで復帰）
✅ 大量データでもCPUスパイク/メモリ肥大がなく、キュー総量が O(1) 計測で制御される
✅ 機微情報（token, authorization）のログ露出ゼロ
✅ 既存API/イベント契約（外部インターフェース）に破壊的変更なし