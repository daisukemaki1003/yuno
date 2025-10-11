# セクション差分（SectionDiffService）の挙動まとめ

`services/src/services/section-diff.service.ts` は、最新の 30 秒要約 (`Delta30s`) と「現在のセクション一覧 (`CurrentSectionList`)」を突き合わせ、変化のあったセクションのみを返すためのサービスです。このドキュメントではアルゴリズムの主要ステップを解説します。

## 入出力の整理

| 名前 | 型 (省略形) | 説明 |
|------|-------------|------|
| `Delta30s` | `summaries: string[]`, `actions[]`, `decisions[]`, `questions[]` | LLM が 30 秒の transcript から生成した要約結果。重複除去・整形済み。 |
| `CurrentSectionList` | `sections: { id, title, summary, status, ... }[]` | 直近までにフロントへ表示していたアクティブ／暫定セクション。`closed` は含まない。 |
| `SectionUpdateResponse` | `changed_sections[]`, `change_summary` | 生成結果。変化のあるセクションのみ含まれ、SSE で配信される。 |

## 処理の流れ

1. **ドラフト生成**  
   - `CurrentSectionList` を `SectionDraft` へ変換し、mutable なワークコピーを作成します。  
   - 各ドラフトは `created=false`, `changed=false` で初期化され、後段で更新フラグを付けます。

2. **summary のマッチング (`applySummaries`)**  
   - Delta30s の `summaries` を順に処理。  
   - 類似度（トークン一致＋ 2 文字 N-gram、一致/包含チェック）を計算し、しきい値 (`SUMMARY_MATCH_THRESHOLD=0.2`) を超えた最良のセクションに紐付けます。  
   - 一致しなければ `createSectionDraft` で provisional セクションを新規作成。  
   - 既存セクションに一致した場合は `summary` を上書きし、`provisional→active` の昇格を行い、`changed=true` にします。

3. **actions / decisions / questions の統合**  
   - いずれも `findBestTextMatch` でテキスト類似度を求め（`TEXT_MATCH_THRESHOLD=0.2`）、適切なセクションへ追加します。マッチしなければ直近で作成したセクション or 先頭セクションに帰属させます。  
   - 追加前に重複チェック：
     - actions: `task.toLowerCase()` + `owner` + `due` のキー  
     - decisions: `summary.toLowerCase()`  
     - questions: `question.toLowerCase()`  
   - 重複が存在する場合はスキップ。新規追加時のみ `changed=true` を立てます。

4. **レスポンス生成 (`buildResponse`)**  
   - `created=true` のドラフトを `change_summary.created_sections` に、`changed=true` のドラフトを `updated_sections` に積み上げます。  
   - 各セクションは `SectionSchema` (Zod) で strict に検証されたうえで `changed_sections` 配列へ格納されます。

## 類似度アルゴリズムの詳細

- **トークン化**: 英数字＋日本語 (Hiragana/Katakana/Han) を対象に正規化したトークンを生成。  
- **N-gram**: 2 文字ずつ切り出して類似度を補強。短い summary の場合でも包含関係が高スコアになるようにしています。  
- **特別扱い**: 完全一致・包含関係 (`summary.includes(section.title)` など) がある場合は高スコア (最大 1.0) を付与し、確実にマッチさせます。

## ステータス管理

- `CurrentSectionList` には `provisional` / `active` のみが入ります。Delta30s で再度同じ主題が触れられると `provisional → active` に昇格。  
- `SectionUpdateResponse` では `provisional` / `active` / `closed` のフルセットに対応していますが、閉じるロジックは別途 (idle 判定 TODO) で拡張予定です。

## ログ連携

- Delta30s と SectionUpdateResponse は `minutesLogWriter` によって `logs/<UTC日付>_<UTC時刻>/` 以下に JSONL 保存されるため、`tail -f` で毎回の差分が追跡できます。  
- SSE (`/v1/meetings/:id/stream`) では `minutes.sections` イベントに `delta` と `update` がそのまま流れるため、デバッグ時は SSE クライアント側で確認し、差分が期待通りかを比較すると効果的です。

---

何か不明点や改善したい挙動があれば、`SectionDiffService` 内のコメントやテスト (`services/tests/services/section-diff.service.test.ts`) と併せて参照してください。
