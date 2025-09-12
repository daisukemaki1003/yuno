# WebSocket Relay Setup Guide

このガイドでは、Meeting BaaS → 当サービス (WebSocket) → Gladia Live APIのリアルタイム音声中継システムのセットアップと検証方法を説明します。

## システム概要

当サービスは、Meeting BaaSからの音声ストリームをWebSocket経由で受信し、Gladia Live APIで文字起こしを行います。SSEモードは削除され、WebSocket relayが唯一の動作モードとなりました。

## 前提条件

- Node.js 18以上
- Gladia APIキー（[Gladia Console](https://console.gladia.io/)で取得）
- Meeting BaaS APIキー
- ngrok（ローカルテスト用）

## 環境変数の設定

`.env`ファイルに以下の環境変数を設定してください：

```bash
# 必須設定
PROJECT_ID=your-project-id
REGION=asia-northeast1
KMS_KEY_NAME=projects/YOUR_PROJECT/locations/YOUR_REGION/keyRings/YOUR_KEYRING/cryptoKeys/YOUR_KEY
MEETING_BAAS_BASE_URL=https://api.example.com

# Gladia API設定（必須）
GLADIA_API_KEY=your-gladia-api-key-here
PUBLIC_WS_BASE=wss://your-domain.com  # MBaaSが接続するWebSocket URL

# WebSocketリレー設定（オプション - デフォルト値使用可）
# STREAM_RECONNECT_BASE_MS=5000          # 再接続の基本待機時間（ms）
# STREAM_BACKPRESSURE_MAX_BUFFER=5242880 # バックプレッシャーの最大バッファサイズ（5MB）
```

## ローカルでのテスト手順

### 1. ngrokでローカルサーバーを公開

```bash
# ターミナル1: ngrokを起動
ngrok http 8080
```

ngrokが起動したら、表示されるHTTPS URLをメモしてください（例: `https://abc123.ngrok.io`）。

### 2. 環境変数を更新

`.env`ファイルのPUBLIC_WS_BASEを更新：

```bash
PUBLIC_WS_BASE=wss://abc123.ngrok.io  # ngrokのURLに置き換え
```

### 3. サーバーを起動

開発時は2つのオプションがあります：

#### オプション1: モックサーバーを使用（推奨）

```bash
# ターミナル2: モックサーバーと開発サーバーを同時起動
pnpm dev:mock
```

この場合、`.env`ファイルのMEETING_BAAS_BASE_URLを以下に設定：
```
MEETING_BAAS_BASE_URL=http://localhost:4010
```

#### オプション2: 実際のMeeting BaaSを使用

```bash
# ターミナル2: 開発サーバーのみ起動
pnpm dev
```

この場合、`.env`ファイルのMEETING_BAAS_BASE_URLを実際のURLに設定してください。

### 4. ヘルスチェック

サーバーが正常に起動したか確認：

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

### 5. APIキーの設定

テストを行う前に、Meeting BaaS APIキーを環境変数として設定するか、APIリクエストのヘッダーに含める必要があります。

## 動作確認

### 1. ボットの作成

当サービス経由でボットを作成します：

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

注意: 
- ヘッダー名は小文字の `x-meeting-baas-api-key` を使用してください
- リクエストボディには `userId` フィールドが必須です

このリクエストにより、当サービスがMeeting BaaSに以下の設定でボットを作成します：

```json
{
  "bot_name": "Test Bot",
  "meeting_url": "https://meet.google.com/xxx-yyyy-zzz",
  "streaming": {
    "audio_frequency": "16khz",
    "input": "wss://abc123.ngrok.io/mb-input",
    "output": "wss://abc123.ngrok.io/mb-input"
  }
}
```

### 2. ログ確認

WebSocket接続とGladia連携の状態をログで確認：

```bash
# 主要なログイベント
- "WebSocket upgrade request"     # MBaaSからの接続要求
- "WebSocket client connected"    # 接続成功
- "Initializing Gladia session"   # Gladia APIセッション初期化
- "Connected to Gladia WebSocket" # Gladia WebSocket接続成功
- "Received audio from MBaaS"     # 音声データ受信
- "Received transcript"           # 文字起こし結果受信
```

### 3. トランスクリプトストリームの受信

SSE形式でトランスクリプトをリアルタイムに受信します：

```bash
curl -N "http://localhost:8080/v1/meetings/YOUR_MEETING_ID/stream?userId=test&types=transcript" \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "x-meeting-baas-api-key: YOUR_MBAAS_API_KEY"
```

受信されるイベントの例：

```
event: ping
data: {"timestamp":1704067200000}

event: transcript
data: {"type":"transcript","data":{"kind":"transcript","text":"こんにちは","lang":"ja","isFinal":false,"ts":1704067201000},"timestamp":1704067201000}

event: transcript
data: {"type":"transcript","data":{"kind":"transcript","text":"こんにちは、本日の会議を始めます","lang":"ja","isFinal":true,"ts":1704067202000},"timestamp":1704067202000}
```

## トラブルシューティング

### Gladia APIキーエラー

```
Error: GLADIA_API_KEY is not configured
```

→ `.env`ファイルに有効なGLADIA_API_KEYを設定してください。

### WebSocket接続エラー

```
WebSocket upgrade rejected
```

→ 以下を確認してください：
- URLパスが正確に`/mb-input`であること
- ngrokのURLが`PUBLIC_WS_BASE`環境変数に正しく設定されていること
- Meeting BaaSからの接続がファイアウォールでブロックされていないこと

### Gladia接続タイムアウト

```
Gladia connection timeout
```

→ ネットワーク接続を確認し、Gladia APIのステータスを確認してください。

## 本番環境への展開

### Cloud Runの場合

1. WebSocketサポートを有効化：
   ```bash
   gcloud run deploy your-service \
     --allow-unauthenticated \
     --set-env-vars="GLADIA_API_KEY=your-key,PUBLIC_WS_BASE=wss://your-service.run.app" \
     --cpu=1 \
     --memory=512Mi \
     --timeout=3600 \
     --session-affinity
   ```

2. WebSocketのタイムアウト設定：
   - Cloud Runのデフォルトタイムアウト（60分）に注意
   - 長時間の会議には定期的な再接続が必要

3. 環境変数の設定：
   - Secret Managerを使用してAPIキーを安全に管理
   - PUBLIC_WS_BASEを本番環境のURLに設定

## モニタリング

### ヘルスエンドポイント

`/healthz`エンドポイントで以下の情報を確認可能：

- アクティブなセッション数
- 各セッションの接続状態
- キューに入っている音声フレーム数
- 再接続試行回数
- 最終アクティビティ時刻

### 構造化ログ

主要なイベントは構造化ログとして出力されます：

- `mb_input:connected/disconnected` - MBaaS WebSocket接続状態
- `gladia:open/close/error` - Gladia WebSocket状態
- `relay:audio_chunk:size` - 音声データの中継
- `transcript:{final|partial}` - 文字起こし結果

## システムアーキテクチャ

### データフロー

```
1. Meeting BaaS → WebSocket (/mb-input) → 当サービス
   - 音声データをバイナリストリームで受信
   
2. 当サービス → Gladia Live API
   - PCM形式（16kHz, 16bit, モノラル）で音声を転送
   - 自動再接続、バックプレッシャー制御付き
   
3. Gladia → 当サービス → クライアント
   - 文字起こし結果をSSE形式で配信
   - /v1/meetings/:meetingId/stream エンドポイント
```

### 主な特徴

- **自動再接続**: Gladia接続が切断された場合、指数バックオフで再接続
- **バックプレッシャー制御**: 音声バッファが5MBを超えると古いフレームを自動削除
- **複数言語対応**: Gladiaの言語自動検出機能を使用
- **リアルタイム配信**: partial/finalの両方のトランスクリプトを即座に配信