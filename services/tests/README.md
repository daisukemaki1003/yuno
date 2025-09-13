# テストスイート実行ガイド

## 概要
このテストスイートは、SSE（Server-Sent Events）を除く全ての既存機能の健全性を保証するためのものです。

## テスト対象
- ✅ HTTPルート: healthz, bots (POST/DELETE)
- ✅ WebSocketルート: /mb-input
- ✅ サービス: Meeting BaaS クライアント、JSONLロガー
- ✅ ミドルウェア: 認証、エラーハンドリング
- ❌ SSE: GET /v1/meetings/:meetingId/stream（スコープ外）

## セットアップ

### 1. 依存関係のインストール
```bash
pnpm install
```

### 2. 環境変数
テスト実行時は`tests/setup.ts`で自動的に設定されます：
- `MEETING_BAAS_BASE_URL`
- `MEETING_BAAS_TIMEOUT_REQUEST_MS`
- `PUBLIC_WS_BASE`
- `GLADIA_API_KEY`
- `WS_RELAY_AUTH_TOKEN`

## テストの実行

### 全テストを実行
```bash
pnpm test
```

### 監視モードで実行
```bash
pnpm test:watch
```

### カバレッジレポート付きで実行
```bash
pnpm test:coverage
```

### 特定のテストファイルのみ実行
```bash
pnpm test healthz.test.ts
```

### CI環境での実行
```bash
pnpm test -- --runInBand
```

## テスト構成

```
tests/
├── setup.ts                      # グローバルセットアップ
├── utils/
│   └── tmp-dir.ts               # 一時ディレクトリ管理
├── routes/
│   ├── healthz.test.ts          # GET /healthz
│   ├── bots.post.test.ts        # POST /v1/bots
│   ├── bots.delete.test.ts      # DELETE /v1/bots/:botId
│   └── ws.mb-input.test.ts      # WS /mb-input
├── services/
│   ├── meetingbaas.client.test.ts  # Meeting BaaS アダプタ
│   └── jsonlLogger.test.ts         # JSONL ロガー
└── fixtures/
    └── transcripts.sample.jsonl    # テストデータ
```

## カバレッジ目標
- Statements: 80%以上
- Branches: 80%以上
- Functions: 80%以上
- Lines: 80%以上

## トラブルシューティング

### ESMモジュールエラー
```bash
NODE_OPTIONS='--experimental-vm-modules' pnpm test
```

### WebSocketテストのタイムアウト
テストタイムアウトは30秒に設定されています。必要に応じて`jest.config.ts`で調整できます。

### 一時ファイルのクリーンアップ
テスト実行後、`.test-tmp`ディレクトリは自動的に削除されます。手動削除が必要な場合：
```bash
rm -rf .test-tmp
```

## 注意事項
- モックは完全に分離されており、実際のネットワーク呼び出しは行われません
- WebSocketテストはローカルサーバーを起動するため、ポート4001が利用可能である必要があります
- ファイルI/Oテストは一時ディレクトリを使用し、実際のログディレクトリには影響しません