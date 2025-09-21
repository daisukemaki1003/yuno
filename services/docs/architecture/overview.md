# Services Architecture Overview

## システム概要

`services` パッケージは、Meeting BaaS からの音声ストリームを受け取り、Gladia Live API を介してリアルタイムで文字起こしを行い、SSE でクライアントへ配信するバックエンドです。HTTP API は Hono ベースのサーバーで提供され、ローカル開発時には `src/index.ts` 内で WebSocket サーバーも同時に起動します。

### データフロー (リアルタイム文字起こし)
1. Meeting BaaS が `/mb-input` WebSocket に音声フレームを送信する。
2. `ws-relay.service.ts` が Gladia Live API と WebSocket 接続を確立し、音声を転送する。
3. Gladia から受信した transcript イベントを `transcriptEmitter` が SSE クライアントへ配信する。
4. SSE エンドポイント (`GET /v1/meetings/:meetingId/stream`) でクライアントがリアルタイム文字起こしを受け取る。

## ランタイムと主要依存関係
- **ランタイム**: Node.js (ESM)、`pnpm` を利用したワークスペース構成
- **Web フレームワーク**: [Hono](https://hono.dev/) (`src/index.ts`)
- **WebSocket**: `ws` パッケージによる低レベル実装 (`src/index.ts`, `src/services/ws-relay.service.ts`)
- **スキーマ検証**: `zod` (`src/schemas/http.v1.ts`)
- **ロギング**: 独自 `Logger` クラスおよびトランスクリプト用ファイルロガー (`src/utils/logger.ts`, `src/utils/transcript-logger.ts`)

Cloud Functions へのデプロイを想定しつつ、ローカルでは `tsx src/index.ts` で API + WebSocket を同時に起動できます。`helloGET` が GCF 用エクスポートです。

## ディレクトリ構成のハイライト
- `src/index.ts`: アプリケーションのエントリーポイント。HTTP サーバーと WebSocket サーバーの初期化、共通ミドルウェア、ルーターのマウントを担当します。
- `src/routes`: Hono ルーターの定義。`v1.router.ts` でバージョン別ルーティングをまとめ、個別ファイルでエンドポイントを管理しています。
- `src/controllers`: HTTP リクエストに対するアプリケーションロジック。Meeting BaaS ボット管理 (`bots.controller.ts`)、録音ストリーム (`streams.controller.ts`) を提供します。
- `src/services`: 外部サービス連携やドメインロジック。Meeting BaaS クライアント生成 (`meetingbaas.service.ts`)、WebSocket リレー (`ws-relay.service.ts`) など。
- `src/clients`: 外部 API 呼び出しを抽象化するアダプター層。Meeting BaaS 向けの設定／ポートインターフェースを定義します。
- `src/middlewares`: Bearer 認証や Meeting BaaS API キー抽出といった共通処理。
- `src/utils`: 汎用ユーティリティ (ロガー、トランスクリプトファイル保存、エラー生成など)。

## HTTP リクエスト処理パイプライン
1. `index.ts` のミドルウェアで `requestId` と `Logger` を生成し、全リクエストに付与します。
2. `bearerAuth` ミドルウェアが Authorization ヘッダーを検証し、`extractMeetingBaasApiKey` が `x-meeting-baas-api-key` ヘッダーを取得します。
3. コントローラー層で `zod` スキーマを用いたパラメーター検証を行います。
4. サービス層が Meeting BaaS への API 呼び出しや Gladia WebSocket との通信を担当します。
5. 最終的なレスポンスは Hono の `Context` から返却され、エラーは共通ハンドラーで整形されます。

## WebSocket リレーの構成
- `/mb-input` への接続を `setupWebSocketRelay` が受け取り、Meeting ID ごとにセッションを管理します。
- Gladia への接続はシングルユーストークンを前提に毎回再生成し、切断時には指数バックオフで再接続します。
- バックプレッシャー対策として音声バッファを保持し、許容量を超えた場合には古いフレームを間引きます。
- 受信した transcript は `transcriptEmitter` 経由で SSE クライアントへ配信し、同時に JSONL ファイルへ永続化します。

## モニタリングとヘルスチェック
- `GET /healthz` エンドポイントでは、HTTP レイヤーの状態と WebSocket リレーのセッション統計 (`getRelayStats`) を返します。
- ローカル開発時には `logs/transcripts-YYYY-MM-DD.jsonl` に文字起こし履歴が保存されます。

このドキュメントを更新する際は、ソースコードの責務や依存関係が変更された箇所を必ず反映してください。
