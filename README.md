# Yuno - AI Meeting Assistant

Yuno（ユノ）は、オンラインミーティングをより効率的にする AI アシスタントサービスです。Meeting BaaS API を活用して Google Meet などのビデオ会議にボットを参加させ、リアルタイムでの文字起こしや議事録作成を行います。

## 🌟 主な機能

- **リアルタイム文字起こし**: 会議の音声をリアルタイムでテキストに変換
- **自動議事録作成**: 会議内容を構造化された議事録として自動生成
- **Bot による会議参加**: Google Meet などのオンライン会議にボットとして参加
- **テンプレート機能**: 議事録テンプレートのカスタマイズ
- **履歴管理**: 過去の議事録の検索・閲覧

## 🏗 プロジェクト構成

```
yuno/
├── apps/        # フロントエンドアプリケーション (Next.js)
├── services/    # バックエンドサービス (Hono)
└── docs/        # ドキュメント
```

### フロントエンド (`apps/`)

- **フレームワーク**: Next.js v15 + React v19
- **認証**: Firebase Authentication + NextAuth
- **スタイリング**: Tailwind CSS
- **状態管理**: Zustand
- **UI**: Radix UI + Lucide Icons

### バックエンド (`services/`)

- **フレームワーク**: Hono (軽量 Web フレームワーク)
- **リアルタイム通信**: WebSocket
- **バリデーション**: Zod
- **アーキテクチャ**: クリーンアーキテクチャ（ヘキサゴナルアーキテクチャ）

## 🚀 クイックスタート

### 前提条件

- Node.js 16.0.0 以上
- pnpm（推奨）または npm

### セットアップ

1. リポジトリをクローン

```bash
git clone <repository-url>
cd yuno
```

2. Claude Code CLI をインストール（開発補助ツール）

```bash
npm install -g @anthropic-ai/claude-code
claude --dangerously-skip-permissions
```

3. 依存関係をインストール

フロントエンド:

```bash
cd apps
pnpm install
```

バックエンド:

```bash
cd services
pnpm install
```

### 環境変数の設定

#### フロントエンド (`apps/.env.local`)

```env
# Firebase設定
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# NextAuth設定
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=

# バックエンドAPI
NEXT_PUBLIC_API_URL=http://localhost:8080
```

#### バックエンド (`services/.env`)

```env
# Meeting BaaS API設定
PROJECT_ID=
REGION=
MEETING_BAAS_API_KEY=

# WebSocketリレー認証（オプション）
WS_RELAY_AUTH_TOKEN=

# サーバー設定
PORT=8080
NODE_ENV=development
```

### 開発サーバーの起動

フロントエンド:

```bash
cd apps
pnpm dev
# http://localhost:3000
```

バックエンド:

```bash
cd services
pnpm dev
# http://localhost:8080
```

## 📖 開発ガイド

### プロジェクトのアーキテクチャ

このプロジェクトは**モノレポ構造**を採用し、フロントエンドとバックエンドを分離しています。

#### バックエンド設計思想

- **クリーンアーキテクチャ**: ビジネスロジックと外部依存を分離
- **ポート＆アダプターパターン**: 外部サービスの実装詳細を隠蔽
- **ドメイン駆動設計**: Meeting BaaS の実装に依存しないドメインモデル

#### フロントエンド設計思想

- **App Router**: Next.js 13+の App Router を活用
- **Server Components**: パフォーマンス最適化のためのサーバーコンポーネント活用
- **認証ガード**: Firebase Authentication による保護されたルート

### 主要な API

#### ボット管理

- `POST /v1/bots` - 会議にボットを追加
- `DELETE /v1/bots/:id` - ボットを会議から退出
- `GET /v1/bots/:id/status` - ボットのステータス確認

#### ストリーミング

- `WebSocket /mb-input` - Meeting BaaS からのリアルタイムデータ受信
- `GET /v1/meetings/:id/stream/:streamId/recording` - 録画データの取得

### テスト

フロントエンド:

```bash
cd apps
pnpm test
```

バックエンド:

```bash
cd services
pnpm test
```

### ビルド

フロントエンド:

```bash
cd apps
pnpm build
```

バックエンド:

```bash
cd services
pnpm build
```

## 📚 ドキュメント

- [アーキテクチャ設計](./ARCHITECTURE.md)
- [バックエンドアーキテクチャ](./services/docs/architecture-report.md)
- [Meeting BaaS 実装ガイド](./services/docs/meetingbaas-implementation-guide.md)
- [テストガイド](./services/docs/testing-guide.md)

## 🛠 技術スタック

### フロントエンド

- Next.js 15.3.3
- React 19.0.0
- TypeScript 5
- Firebase 11.9.1
- Tailwind CSS 4
- Zustand 5.0.5

### バックエンド

- Hono 4.9.6
- TypeScript 5.9.2
- WebSocket (ws) 8.18.3
- Zod 4.1.5
- Jest 30.1.3

## 🤝 コントリビューション

1. Feature ブランチを作成 (`git checkout -b feature/amazing-feature`)
2. 変更をコミット (`git commit -m 'Add some amazing feature'`)
3. ブランチにプッシュ (`git push origin feature/amazing-feature`)
4. Pull Request を作成

## 📝 ライセンス

This project is proprietary software. All rights reserved.

## 🙏 謝辞

- [Meeting BaaS](https://meetingbaas.com/) - ビデオ会議統合 API
- [Hono](https://hono.dev/) - 軽量 Web フレームワーク
- [Next.js](https://nextjs.org/) - React フレームワーク
