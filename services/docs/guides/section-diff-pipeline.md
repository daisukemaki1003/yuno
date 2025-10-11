# セクション生成パイプラインの概要

このドキュメントでは、Google Meet の文字起こしから `minutes.sections` SSE を配信するまでの処理をまとめます。実装は `services` パッケージ内で完結しており、Delta30s 要約とセクション差分生成を段階的に行います。

## フロー全体

1. **文字起こし受信**  
   - `services/src/services/ws-relay.service.ts` が Gladia からの WebSocket メッセージを受信。  
   - `transcriptEmitter` へ `final` チャンクを流し、`transcriptLogger` / `minutesLogWriter` で JSONL として永続化します。  
   - ログ配置: `logs/<UTC日付>_<UTC時刻>/<meetingId>-transcript.jsonl`。

2. **バケット化・Delta30s 生成**  
   - `services/src/services/live-minutes.service.ts` が `transcriptEmitter` を購読。発話を 30 秒単位でバケット化し、Gemini (LLM) へプロンプトを送信します。  
   - 呼び出しは `Delta30sBuilderService` (`services/src/services/delta30s-builder.service.ts`) を介し、Strict JSON を Zod (`services/src/domain/minutes/delta30s.schema.ts`) で検証。  
   - 成功した Delta30s は `logs/<timestamp>/<meetingId>-delta.jsonl` に追記され、次段階へ渡されます。

3. **セクション差分の算出**  
   - `SectionDiffService` (`services/src/services/section-diff.service.ts`) が Delta30s と `CurrentSectionList` を突き合わせます。  
   - 類似度判定 (トークン + N-gram) で既存セクションを更新し、未マッチ要約は provisional セクションとして新規作成。  
   - 行動・決定・質問は `task/owner/due`, `summary`, `question` で重複排除。  
   - 結果は Zod (`services/src/domain/minutes/sections.schema.ts`) で整形し `logs/<timestamp>/<meetingId>-sections.jsonl` に保存されます。

4. **SSE 配信**  
   - `services/src/controllers/streams.controller.ts` が `minutes.sections` イベントを購読し、SSE (`/v1/meetings/:id/stream`) へ `SectionUpdateResponse` と Delta30s を JSON のまま配信します。  
   - `types` クエリ未指定でも `minutes` イベントが購読対象に含まれるようデフォルト値を拡張しています。

## 主要エントリーポイント

- Transcript ログ: `ws-relay.service.ts` 内 `minutesLogWriter.logTranscript`
- Delta30s 生成: `Delta30sBuilderService.build`
- セクション差分: `SectionDiffService.diff`
- SSE ハンドラ: `stream.controller.ts` (`recordingSse`)

## ログ確認の Tips

```
# セクション更新の tail 例
ls logs
tail -f logs/2025-10-11_2235/fvt-dfmo-jpx-sections.jsonl

# Delta30s の確認
jq '.' logs/2025-10-11_2235/fvt-dfmo-jpx-delta.jsonl
```

- それぞれの JSON 行には `loggedAt` が付与されているため、生成タイミングが追跡できます。
- バケットが生成されない場合、`logs/...-delta.jsonl` にレコードが追加されていないかを確認し、LLM エラーは `minutes` ロガーに WARN として出力されます。
