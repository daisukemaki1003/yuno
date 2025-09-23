# TODO：議事録自動生成とセクション生成

## 背景
- `services/docs/features/議事録自動生成 IO仕様.md` に定義された **Delta30s**（30秒ディジェスト）と **SectionUpdateResponse**（セクション更新差分）を実装する。
- 現状は transcript から minutes.partial を生成するリアルタイム SSE 実装（`services/docs/prompts/実装依頼ドキュメント：リアルタイム議事録（SSE）.md`）のみ。今回の TODO は minutes の「確定版」側 I/O を段階的に作ることが目的。
- 既存処理では **15秒ごと**に WebSocket transcript を要約しているため、まずは **30秒サイクル**に改修してから新機能を積み上げる。

## 進め方ポリシー
- 各タスクは「既存機能の改修」と「新規機能の実装」に分けて進め、検証観点を明確化する。
- **1 タスクの実装が完了したら一旦停止し、検証（レビュー・動作確認）を受けてから次のタスクに着手する。**
- 進捗報告はタスク単位で行い、検証フィードバックを TODO に反映する。

## 参照資料
- I/O 仕様: `services/docs/features/議事録自動生成 IO仕様.md`
- リアルタイム minutes SSE: `services/docs/prompts/実装依頼ドキュメント：リアルタイム議事録（SSE）.md`
- 既存 transcript パイプ: `services/src/services/ws-relay.service.ts`, `services/src/routes/`

## 小タスク一覧（検証待ちポイント付き）

### 既存機能の改修
- [ ] **30秒サイクル化**: transcript 集約間隔・タイマーを 15秒 → 30秒 に変更し、関連定数/テストを更新。`minutes` SSE や state 管理の副作用を確認。
  - 検証: 実運転想定で 30秒ごとに minutes.partial が出ること。
- [ ] **設定整備**: 30秒化に伴う定数（`EMIT_INTERVAL_SEC`, バッファ TTL など）を見直し、`live-minutes` 側の設定コメントを更新。
  - 検証: 設定値が 30秒前提で矛盾しないこと、ドキュメント整合。

### 新規機能の実装
- [ ] **ドメイン型 / スキーマ定義**: `Delta30s`, `Action`, `Decision`, `Question`, `CurrentSectionList`, `SectionUpdateResponse` を TypeScript + Zod で定義し、`services/src/domain/minutes`（新設）に配置。
  - 検証: 型・スキーマが仕様書と一致し、テスト通過。
- [ ] **設定ファイル雛形**: 30秒窓やしきい値を管理する `services/src/config/minutes-final.config.ts` を追加し、調整可能な値に TODO コメントを付与。
  - 検証: 新設定が既存コードと競合しないこと。
- [ ] **Delta30s 生成サービス**: transcript (`TranscriptChunk`) を 30秒窓で集計し、summaries/actions/decisions/questions を構築するサービスを実装。LLM or ルール処理は抽象化し、JSON Schema に準拠。
  - 検証: 代表入力で Delta30s のフィールドが揃うこと、リトライ戦略が機能。
- [ ] **Section 差分エンジン**: `CurrentSectionList` と最新 `Delta30s` を突き合わせて差分（新規/更新/クローズ + `change_summary`）を算出するロジックを実装。
  - 検証: フィクスチャで差分判定が期待どおり動作。
- [ ] **I/O 露出（API またはサービス）**: Hono ルート or サービス公開関数を追加し、`Delta30s` と `SectionUpdateResponse` を取得できるようにする。認証やバリデーションを実装。
  - 検証: HTTP / サービス呼び出しで正しいレスポンス。
- [ ] **テスト & ドキュメント**: 30秒窓ロジック、差分エンジン、API のユニット/統合テストを追加し、関連ドキュメント（runbook / testing guide）を更新。
  - 検証: テスト通過、ドキュメント反映確認。

## 未決事項メモ
- Delta30s の要約/抽出に LLM を使うか、軽量ルールベースで始めるか（PoC の判断待ち）。
- Section ID の採番ポリシー（自動生成 or UI 側指定）とステータス遷移ルール。
- 発話のソース（Gladia 以外が混ざる可能性）のハンドリング方針。
