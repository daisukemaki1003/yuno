# Services フォルダ アーキテクチャ設計レポート

## 概要

本レポートは、`services` フォルダのアーキテクチャ設計、ディレクトリ構成、および開発に必要な情報をまとめたものです。

## アーキテクチャ概要

### 採用されているアーキテクチャパターン

本サービスは **クリーンアーキテクチャ（ヘキサゴナルアーキテクチャ）** パターンを採用しており、以下の特徴を持ちます：

- **ポートとアダプターパターン**: ビジネスロジックと外部システムの依存関係を分離
- **レイヤードアーキテクチャ**: 責務ごとに明確な層の分離
- **ドメイン駆動設計（DDD）**: ドメインモデルをベンダー固有の実装から分離

### アーキテクチャの利点

1. **ベンダー非依存**: Meeting BaaS APIの仕様変更に柔軟に対応可能
2. **テスタビリティ**: 各層が独立しているため、単体テストが容易
3. **拡張性**: 新しいベンダーや機能の追加が既存コードへの影響を最小限に

## ディレクトリ構成

```
services/
├── src/                    # ソースコード
│   ├── clients/           # 外部サービス統合（アダプター）
│   │   ├── http.client.ts                    # 共通HTTPクライアント
│   │   ├── meetingbaas.adapter.v1.ts        # Meeting BaaS API実装
│   │   ├── meetingbaas.client.port.ts       # インターフェース定義
│   │   ├── meetingbaas.client.types.ts      # 型定義
│   │   └── meetingbaas.config.ts            # 設定インターフェース
│   │
│   ├── configs/           # 設定管理
│   │   └── env.ts                           # 環境変数バリデーション
│   │
│   ├── controllers/       # HTTPリクエストハンドラー
│   │   ├── bots.controller.ts               # Bot操作のコントローラー
│   │   └── streams.controller.ts            # ストリーミングコントローラー
│   │
│   ├── middlewares/       # ミドルウェア
│   │   └── auth.ts                          # 認証ミドルウェア
│   │
│   ├── realtime/          # リアルタイム機能
│   │   └── ws-relay.ts                      # WebSocketリレー実装
│   │
│   ├── routes/            # ルート定義
│   │   ├── _router.ts                       # メインルーター
│   │   ├── v1.router.ts                     # v1 APIルーター
│   │   ├── bots.add.ts                      # Bot追加エンドポイント
│   │   ├── bots.leave.ts                    # Bot退出エンドポイント
│   │   └── streams.recording.ts             # レコーディングエンドポイント
│   │
│   ├── schemas/           # データバリデーションと型
│   │   ├── domain/                          # ドメインモデル
│   │   │   └── bot.ts                       # Botエンティティ
│   │   ├── http.v1.ts                       # HTTP APIスキーマ
│   │   └── vendor/                          # ベンダー固有スキーマ
│   │
│   ├── services/          # ビジネスロジック層
│   │   └── meetingbaas.service.ts           # Meeting BaaSサービス
│   │
│   ├── utils/             # ユーティリティ
│   │   ├── errors.ts                        # エラーハンドリング
│   │   └── logger.ts                        # ロギング
│   │
│   └── index.ts          # アプリケーションエントリポイント
│
├── test/                  # テストファイル
│   ├── unit/             # 単体テスト
│   └── hoge/             # その他のテスト
│
├── mocks/                # モックサーバー
│   └── meetingbaas/      # Meeting BaaS APIモック
│       ├── scenarios/    # テストシナリオ
│       ├── data/         # モックデータ
│       └── server.ts     # モックサーバー実装
│
├── docs/                 # ドキュメント
│   ├── realtime-audit.md        # ストリーミング実装監査
│   └── ws-relay-setup.md        # WebSocketリレー設定ガイド
│
└── 設定ファイル
    ├── package.json      # プロジェクト設定
    ├── tsconfig.json     # TypeScript設定
    └── jest.config.cjs   # Jest設定
```

## コンポーネント関係図

```
┌─────────────┐     ┌──────────────┐     ┌──────────┐     ┌─────────────┐
│   Routes    │ ──> │ Controllers  │ ──> │ Services │ ──> │  Adapters   │
└─────────────┘     └──────────────┘     └──────────┘     └─────────────┘
      │                    │                    │                  │
      ↓                    ↓                    ↓                  ↓
┌─────────────┐     ┌──────────────┐     ┌──────────┐     ┌─────────────┐
│  Schemas    │     │ Middlewares  │     │  Domain  │     │External APIs│
└─────────────┘     └──────────────┘     └──────────┘     └─────────────┘
```

### 依存関係の流れ

1. **Routes**: HTTPエンドポイントを定義し、コントローラーをマウント
2. **Controllers**: HTTPリクエストを処理し、入力検証を行い、サービスを呼び出す
3. **Services**: ビジネスロジックを実装し、アダプター間の調整を行う
4. **Adapters**: 外部サービス（Meeting BaaS API）との統合を担当

## 主要な設計原則

### 1. 依存性逆転の原則（DIP）

- コアビジネスロジックは実装ではなくインターフェースに依存
- `MeetingBaasPort` インターフェースにより実装の切り替えが可能

### 2. 単一責任の原則（SRP）

- 各モジュールは明確で焦点を絞った目的を持つ
- コントローラーはHTTP、サービスはビジネスロジック、アダプターは外部APIを担当

### 3. 開放閉鎖の原則

- 新しいベンダー統合は既存コードを変更せずに追加可能
- 設定駆動アプローチによりコード変更なしで動作を変更可能

## 開発環境セットアップ

### 必要な環境変数

```env
# 基本設定
NODE_ENV=development
LOG_LEVEL=debug

# Meeting BaaS API設定
MEETINGBAAS_MOCK_ENABLED=true
MEETINGBAAS_MOCK_BASE_URL=http://localhost:8089
MEETINGBAAS_API_KEY=your-api-key

# ストリーミング設定
STREAM_PROTOCOL=sse  # または ws-relay
GLADIA_API_KEY=your-gladia-key  # ws-relayモード時
WS_RELAY_URL=wss://api.gladia.io/v2/live  # ws-relayモード時
```

### 開発用スクリプト

```bash
# 開発環境起動（モックサーバー含む）
pnpm local

# 開発サーバーのみ起動
pnpm dev

# テスト実行
pnpm test

# リント実行
pnpm lint

# ビルド
pnpm build
```

## テスト戦略

### テスト構成

- **フレームワーク**: Jest with TypeScript
- **単体テスト**: `test/unit/` ディレクトリ
- **モックサーバー**: 完全なAPIシミュレーション

### モックシナリオ

開発時に以下のシナリオをテスト可能：

- `default`: 正常動作
- `rate_limit`: レート制限
- `flaky`: 不安定な接続
- `slow`: 遅いレスポンス
- `auth_required`: 認証エラー

## 認証とセキュリティ

### 認証メカニズム

1. **Bearer Token認証**: 存在チェックのみ（検証は未実装）
2. **Meeting BaaS APIキー**: カスタムヘッダー `X-MeetingBaas-ApiKey`

### セキュリティ考慮事項

- 環境変数による機密情報管理
- リクエストIDによるトレーサビリティ
- 構造化ログによる監査証跡

## エラーハンドリング

### エラー体系

- カスタム `HttpError` クラスによる統一的なエラー処理
- HTTPステータスコードに対応したヘルパー関数
- 一貫したエラーレスポンスフォーマット

### エラーレスポンス例

```json
{
  "code": "BAD_REQUEST",
  "message": "Invalid request parameters",
  "details": {
    "field": "botId",
    "reason": "Required field is missing"
  }
}
```

## ロギング

### ロギング機能

- リクエストID追跡
- 構造化JSONフォーマット
- 開発環境でのカラー出力
- ログレベル: debug, info, warn, error

### ログ出力例

```json
{
  "level": "info",
  "message": "Bot added successfully",
  "timestamp": "2025-01-10T12:34:56.789Z",
  "requestId": "abc123",
  "metadata": {
    "botId": "bot-123",
    "meetingId": "meeting-456"
  }
}
```

## リアルタイムストリーミング

### サポートされるプロトコル

1. **SSE（Server-Sent Events）**: デフォルトモード
2. **WebSocket Relay**: Gladia APIとの統合用

### ストリーミングアーキテクチャ

```
Client <──> Service <──> Meeting BaaS API
              │
              └──> WebSocket Relay ──> Gladia API
```

## デプロイメント

### Google Cloud Functions対応

- `@google-cloud/functions-framework` 統合
- ハンドラーエクスポート対応
- 環境変数による設定管理

### ビルドとパッケージング

```bash
# プロダクションビルド
pnpm build:all

# distフォルダが生成され、デプロイ可能な状態に
```

## 開発のベストプラクティス

### コーディング規約

1. **TypeScript**: 厳格な型チェックを使用
2. **Zod**: ランタイム検証でデータの整合性を保証
3. **ESLint**: コード品質の維持

### Git フロー

1. フィーチャーブランチでの開発
2. プルリクエストによるコードレビュー
3. mainブランチへのマージ

### 推奨される開発フロー

1. `pnpm local` で開発環境を起動
2. モックサーバーでAPIの動作を確認
3. 実装を行い、単体テストを作成
4. `pnpm lint` と `pnpm test` で品質確認
5. コミットしてプルリクエストを作成

## 今後の拡張ポイント

### 検討事項

1. **認証の強化**: Key Storeとの統合
2. **モニタリング**: メトリクスとトレーシングの追加
3. **キャッシング**: パフォーマンス向上のためのキャッシュ層
4. **API バージョニング**: v2, v3への拡張準備

### 拡張しやすい設計

- 新しいベンダーの追加は新しいアダプターの実装のみ
- 新しいエンドポイントはルーターとコントローラーの追加
- 設定駆動により環境ごとの調整が容易

## まとめ

このサービスアーキテクチャは、Meeting BaaS APIとのインテグレーションを柔軟かつ保守しやすい形で実現しています。クリーンアーキテクチャの採用により、ビジネスロジックと外部依存の分離が達成され、テスタビリティと拡張性が確保されています。

開発者は、充実したモックサーバー、構造化ログ、型安全性により、効率的に開発を進めることができます。また、リアルタイムストリーミングのサポートにより、音声処理などの高度な機能も実装可能です。