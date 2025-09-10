# WebSocket Relay Setup Guide

このガイドでは、MBaaS → 当方WebSocket → Gladia Live APIのリアルタイム音声中継システムのセットアップ方法を説明します。

## 前提条件

- Node.js 18以上
- Gladia APIキー（[Gladia Console](https://console.gladia.io/)で取得）
- ngrok（ローカルテスト用）

## 環境変数の設定

`.env`ファイルに以下の環境変数を設定してください：

```bash
# ストリームプロトコルをws-relayモードに設定
MEETING_BAAS_STREAM_PROTOCOL=ws-relay

# Gladia API設定
GLADIA_API_KEY=your-gladia-api-key-here
PUBLIC_WS_BASE=wss://your-domain.com  # 本番環境のWebSocket URL

# WebSocketリレー設定（オプション）
STREAM_RECONNECT_BASE_MS=5000          # 再接続の基本待機時間（ms）
STREAM_BACKPRESSURE_MAX_BUFFER=5242880 # バックプレッシャーの最大バッファサイズ（5MB）
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

```bash
# ターミナル2: 開発サーバーを起動
pnpm dev
```

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

## 動作確認

### 1. ボット作成時の設定

MBaaSでボットを作成する際、`streaming`パラメータに以下を指定：

```json
{
  "streaming": {
    "audio_frequency": "16khz",
    "input": "wss://abc123.ngrok.io/mb-input",
    "output": null
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

### 3. SSEクライアントでの確認

既存のSSEクライアントでtranscriptイベントを受信できることを確認：

```bash
curl -N "http://localhost:8080/v1/meetings/YOUR_MEETING_ID/stream?userId=test&types=transcript"
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

→ URLパスが正確に`/mb-input`であることを確認してください。

### Gladia接続タイムアウト

```
Gladia connection timeout
```

→ ネットワーク接続を確認し、Gladia APIのステータスを確認してください。

## 本番環境への展開

1. Cloud Runまたは同等のサービスにデプロイ
2. WebSocketサポートを有効化
3. 環境変数を本番用に設定
4. PUBLIC_WS_BASEを本番環境のWebSocket URLに更新

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

## 既存システムとの互換性

- SSE配信は維持されるため、既存のクライアントは変更不要
- `MEETING_BAAS_STREAM_PROTOCOL=sse`に設定することで即座に旧実装にロールバック可能
- transcriptイベントの形式は既存と互換性を維持