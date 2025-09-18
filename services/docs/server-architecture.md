# サーバーサイド構成ドキュメント

## 概要

このドキュメントは、新人エンジニアが本プロジェクトのサーバーサイドの構成を理解するために作成されています。本サーバーはNode.js (TypeScript) で実装され、Meeting BaaS と連携して会議の録音・文字起こし機能を提供します。

## 技術スタック

- **ランタイム**: Node.js (ES2022)
- **言語**: TypeScript
- **フレームワーク**: Hono (軽量なWebフレームワーク)
- **パッケージマネージャー**: pnpm
- **テスト**: Jest
- **ビルドツール**: TypeScript Compiler (tsc), tsx
- **デプロイ先**: Google Cloud Functions

## ディレクトリ構成

```
services/
├── src/                    # ソースコード
│   ├── clients/           # 外部APIクライアント
│   ├── configs/           # 設定ファイル
│   ├── controllers/       # HTTPコントローラー
│   ├── crypto/           # 暗号化関連（将来実装）
│   ├── middlewares/       # ミドルウェア
│   ├── realtime/         # リアルタイム処理（WebSocket）
│   ├── routes/           # ルーティング定義
│   ├── schemas/          # データスキーマ定義
│   ├── services/         # ビジネスロジック層
│   ├── utils/            # ユーティリティ
│   └── index.ts          # エントリーポイント
├── test/                  # テストファイル
├── mocks/                 # 開発用モックサーバー
├── docs/                  # ドキュメント
├── dist/                  # ビルド成果物
├── package.json          # プロジェクト設定
├── tsconfig.json         # TypeScript設定
├── .env.example          # 環境変数サンプル
└── pnpm-lock.yaml        # 依存関係ロックファイル
```

## アーキテクチャ詳細

### レイヤー構成

本システムは以下のレイヤードアーキテクチャを採用しています：

```
[クライアント] 
     ↓ HTTPリクエスト
[Routes] → ルーティング定義
     ↓
[Middlewares] → 認証、ロギング等
     ↓
[Controllers] → リクエスト/レスポンス処理
     ↓
[Services] → ビジネスロジック
     ↓
[Clients/Adapters] → 外部API連携
```

### 主要モジュールの責務

#### 1. エントリーポイント（src/index.ts）
- Honoアプリケーションの初期化
- ミドルウェアの登録
- ルーターのマウント
- HTTPサーバーとWebSocketサーバーの起動
- Google Cloud Functions用のエクスポート

#### 2. ルーティング（src/routes/）
- **_router.ts**: メインルーター（ヘルスチェック等）
- **v1.router.ts**: v1 APIのルート集約
- **bots.add.ts**: ボット追加エンドポイント
- **bots.leave.ts**: ボット削除エンドポイント
- **streams.recording.ts**: ストリーミングエンドポイント

#### 3. コントローラー（src/controllers/）
- **bots.controller.ts**: ボット管理のHTTPハンドリング
- **streams.controller.ts**: ストリーミング制御（SSE/WebSocket）

#### 4. サービス層（src/services/）
- **meetingbaas.service.ts**: Meeting BaaS連携のビジネスロジック

#### 5. クライアント/アダプター（src/clients/）
- **meetingbaas.adapter.v1.ts**: Meeting BaaS APIアダプター
- **meetingbaas.client.port.ts**: クライアントインターフェース
- **http.client.ts**: HTTP通信の基盤クラス

#### 6. リアルタイム処理（src/realtime/）
- **ws-relay.ts**: WebSocketリレーサーバー（音声認識連携）

## API エンドポイント

### ヘルスチェック
```
GET /healthz
```

### ボット管理 API (v1)
```
POST   /v1/bots          # ボットを会議に追加
DELETE /v1/bots/:botId   # ボットを会議から削除
```

### ストリーミング API (v1)
```
GET /v1/meetings/:meetingId/stream  # 録音データのストリーミング（SSE）
```

### WebSocket エンドポイント
```
WS /mb-input  # Meeting BaaSからの音声データ受信用
```

## 環境変数

主要な環境変数（詳細は`.env.example`参照）：

```bash
# プロジェクト設定
PROJECT_ID=your-project-id
REGION=asia-northeast1

# Meeting BaaS設定
MEETING_BAAS_BASE_URL=https://api.example.com
MEETING_BAAS_STREAM_PROTOCOL=ws-relay  # または sse

# 音声認識サービス設定
GLADIA_API_KEY=your-gladia-api-key
PUBLIC_WS_BASE=wss://your-domain.com

# 開発環境用
MOCK_PORT=4010
MOCK_SCENARIO=default
```

## 開発環境のセットアップ

### 1. 依存関係のインストール
```bash
pnpm install
```

### 2. 環境変数の設定
```bash
cp .env.example .env
# .env ファイルを編集して必要な値を設定
```

### 3. 開発サーバーの起動
```bash
# モックサーバーと一緒に起動
pnpm dev:mock

# または個別に起動
pnpm mock:start  # モックサーバー
pnpm dev         # 開発サーバー
```

### 4. テストの実行
```bash
pnpm test
```

### 5. ビルド
```bash
pnpm build
```

## データフローの例

### ボット追加のフロー
1. クライアントが `POST /v1/bots` にリクエスト
2. 認証ミドルウェアでトークン検証
3. `bots.controller` でリクエスト検証
4. `meetingbaas.service` でビジネスロジック実行
5. `meetingbaas.adapter` で外部API呼び出し
6. レスポンスをクライアントに返却

### 音声ストリーミングのフロー（WebSocketリレーモード）
1. Meeting BaaSが `/mb-input` WebSocketに接続
2. 音声データを受信し、Gladia APIにリレー
3. Gladiaからトランスクリプト結果を受信
4. クライアントにSSE経由でトランスクリプトを配信

## 認証とセキュリティ

- Bearer Token認証を使用
- Meeting BaaS APIキーは環境変数または将来的にはkey-storeサービスから取得
- すべてのAPIエンドポイントで認証が必要

## エラーハンドリング

各レイヤーで適切なエラーハンドリングを実装：
- HTTPステータスコードの適切なマッピング
- エラーメッセージの標準化
- ロギングによる問題追跡

## モニタリングとログ

- リクエストIDによるトレーサビリティ
- 構造化ログ（JSON形式）
- ヘルスチェックエンドポイントによる死活監視

## デプロイ

1. ビルドとパッケージング
```bash
pnpm build:all
```

2. Google Cloud Functionsへのデプロイ
```bash
# CI/CDパイプラインで自動実行される
```

## トラブルシューティング

### よくある問題

1. **モックサーバーが起動しない**
   - ポートが使用中の場合: `pnpm mock:stop` を実行
   - 環境変数を確認

2. **TypeScriptのパスエイリアスが解決されない**
   - `tsconfig.json` の `paths` 設定を確認
   - IDEの設定を確認

3. **WebSocket接続が失敗する**
   - `MEETING_BAAS_STREAM_PROTOCOL` が正しく設定されているか確認
   - ファイアウォール設定を確認

## 参考資料

- [Hono公式ドキュメント](https://hono.dev/)
- [TypeScript公式ドキュメント](https://www.typescriptlang.org/)
- [Google Cloud Functions ドキュメント](https://cloud.google.com/functions/docs)
- 内部ドキュメント:
  - [WebSocketリレーセットアップ](./ws-relay-setup.md)
  - [リアルタイム音声ストリーミング監査レポート](./realtime-audit.md)

## 連絡先

不明な点がある場合は、チームのSlackチャンネルまたは先輩エンジニアにご相談ください。