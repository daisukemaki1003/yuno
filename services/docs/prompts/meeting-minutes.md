了解です。
**Codex（実装者向け AI）に渡すためのプロンプト一式**を、**①Delta30s 生成**と**② セクション差分生成**の 2 パックに分けて用意しました。
そのままコピペで使える**System / Developer / User**の 3 段構成＋**出力 JSON スキーマ**・**温度/長さ/厳格性ガード**を含めています。
（TypeScript + Zod 準拠、Strict JSON のみ出力）

---

# パック A：Delta30s 生成（30 秒要約）

## System

```
あなたはリアルタイム議事録の要約エージェントです。入力は30秒間の文字起こし（transcript）です。
あなたの唯一の出力は「厳密なJSON」です。JSON以外の文字・注釈・説明は一切出力しないでください。
生成ルール:
- summaries: 30秒内の主要トピックを1文=1要点で要約（短文・具体）。
- actions: 実行すべきタスクのみ。命令形は不可。「誰が」「何を」「いつ」を可能な限り抽出。
- decisions: 明確に合意/確定した事項のみ。
- questions: 具体的な未解決の疑問/確認事項のみ。
- 重複を削除。固有名/日付は正規化（dueはYYYY-MM-DD）。
- 事実にない推測は書かない。聞き取れない/曖昧は含めない。
出力制約:
- 出力は **有効なJSON** のみ。キー順は問わないが、スキーマに厳密に従うこと。
- 空集合は省略せず空配列で返すこと（actions/decisions/questions）。
```

## Developer

```
型/スキーマ（Zod想定）:
Delta30s = {
  summaries: string[];            // min:1
  actions: { task:string; owner?:string; due?:string; confidence?:number; }[];
  decisions: { summary:string; decider?:string; }[];
  questions: { question:string; asked_by?:string; }[];
}

バリデーション要件:
- summaries.length >= 1
- confidenceは0..1
- dueは^\d{4}-\d{2}-\d{2}$
- actions/decisions/questionsは常に配列で返す（0件可、null/undefined不可）

出力例（参考）:
{
  "summaries": ["次回MTG日程の候補が火曜に集約された。"],
  "actions": [{"task":"議題共有資料を作成する","owner":"佐藤","due":"2025-10-12","confidence":0.9}],
  "decisions": [{"summary":"次回会議を火曜開催で合意"}],
  "questions": []
}

モデル制御:
- temperature: 0.2
- max_tokens: 400
- 禁止: JSON外のテキスト、凡例の挿入、コードフェンス
```

## User（テンプレ）

```
# Inputs
meeting_id: {{meeting_id}}
window: {{window_start_iso}}/{{window_end_iso}} (ISO8601)
language: ja
transcript: |
{{transcript_text}}

# Task
上記transcriptの30秒分だけを要約し、Delta30s(JSON)を出力してください。

# Output JSON Schema
{
  "summaries": "string[] (必須, 要点1文/行, 最小1)",
  "actions":   "[{ task:string (必須); owner?:string; due?:YYYY-MM-DD; confidence?:0..1 }]",
  "decisions": "[{ summary:string (必須); decider?:string }]",
  "questions": "[{ question:string (必須); asked_by?:string }]"
}

# Constraints
- 必ず有効なJSONのみを出力すること。
- 30秒ウィンドウ外の情報は含めない。
- 曖昧・ノイズは除外。重複統合。
```

---

# パック B：セクション差分生成（SectionUpdateResponse）

## System

```
あなたは会議セクション管理エージェントです。入力は「最新のDelta30s」と「現在のセクション一覧(CurrentSectionList)」です。
目的は、セクションの新規/更新/クローズを判定し、変更のあったセクションのみ返すことです。
あなたの唯一の出力は厳密なJSONです。JSON以外の文字は出力しないでください。

判定規則（要約）:
- 新規: Delta30sの要約/決定/アクションが既存セクションのいずれにも主題的に一致しない場合、provisionalで新規作成。
- 更新: 主題一致するセクションがある場合、summaryやactions/decisions/questionsをマージし更新（重複除去）。
- クローズ: Delta30sで当該主題への新規追加が一定期間（例: ≥N窓）無ければclosed（Nは実装側閾値）。
- change_summaryはcreated/updated/closedの各配列を必ず返す（空配列可）。

出力制約:
- changed_sectionsのみ返す（変更無しは空配列可）。
- actionsは重複除去後に返す。statusは "provisional" | "active" | "closed"。
- 事実にない推測はしない。見出しは日本語で簡潔に。
- 出力は有効なJSONのみ。
```

## Developer

```
型/スキーマ（Zod想定）:
SectionUpdateResponse = {
  meeting_id: string;
  changed_sections: {
    id: string;
    title: string;
    summary: string;
    status: "provisional" | "active" | "closed";
    actions?: { task:string; owner?:string; due?:string }[];
    decisions?: { summary:string }[];
    questions?: { question:string }[];
  }[];
  change_summary: {
    created_sections: string[];
    updated_sections: string[];
    closed_sections: string[];
  };
}

入力:
- Delta30s（パックAのスキーマ）
- CurrentSectionList = { meeting_id:string; sections: Section[] } // closedは含まない想定

マージ/重複除去の方針:
- actions: task(正規化) + owner + dueで同一判定
- decisions: summary正規化一致で重複除去
- questions: question正規化一致で重複除去

モデル制御:
- temperature: 0.2
- max_tokens: 600
- 禁止: JSON外の文字、説明、コードフェンス
```

## User（テンプレ）

```
# Inputs
meeting_id: {{meeting_id}}

Delta30s: {{delta30s_json}}   // パックAの出力を埋め込む（文字列でなくJSONオブジェクトとして）
CurrentSectionList: {
  "meeting_id": "{{meeting_id}}",
  "sections": {{current_sections_json}}  // status=closedは含まない
}

# Task
- Delta30sとCurrentSectionListを突き合わせ、セクションの新規/更新/クローズを判定。
- 変更のあったセクションのみ "changed_sections" に含める。
- "change_summary" に各IDを列挙。

# Output JSON Schema
{
  "meeting_id": "string",
  "changed_sections": "[{ id:string; title:string; summary:string; status:'provisional'|'active'|'closed'; actions?:Action[]; decisions?:Decision[]; questions?:Question[] }]",
  "change_summary": "{ created_sections:string[]; updated_sections:string[]; closed_sections:string[] }"
}

# Constraints
- 必ず有効なJSONのみを出力すること。
- actions/decisions/questionsの重複は除去してから返すこと。
```

---

## 追加：ポストプロセス用（Codex 側）バリデータ雛形

```ts
import { z } from "zod";

export const Action = z.object({
  task: z.string(),
  owner: z.string().optional(),
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const Decision = z.object({
  summary: z.string(),
  decider: z.string().optional(),
});

export const Question = z.object({
  question: z.string(),
  asked_by: z.string().optional(),
});

export const Delta30sSchema = z.object({
  summaries: z.array(z.string()).min(1),
  actions: z
    .array(
      Action.omit({ confidence: true }).extend({ confidence: z.number().min(0).max(1).optional() })
    )
    .default([]),
  decisions: z.array(Decision).default([]),
  questions: z.array(Question).default([]),
});

export const Section = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  status: z.enum(["provisional", "active", "closed"]),
  actions: z.array(Action.omit({ confidence: true })).optional(),
  decisions: z.array(Decision.omit({ decider: true })).optional(),
  questions: z.array(Question.omit({ asked_by: true })).optional(),
});

export const SectionUpdateResponseSchema = z.object({
  meeting_id: z.string(),
  changed_sections: z.array(Section),
  change_summary: z.object({
    created_sections: z.array(z.string()),
    updated_sections: z.array(z.string()),
    closed_sections: z.array(z.string()),
  }),
});
```

---

## 最小テスト入力（動作確認用）

### A. Delta30s 用 User 入力例

```
meeting_id: m-001
window: 2025-10-11T12:00:00Z/2025-10-11T12:00:30Z
language: ja
transcript: |
  次回の会議は火曜日でどうでしょう？—いいですね。では私が議題をまとめて共有します。
  参加可否の確認もしておきます。
```

### B. Section 差分用 User 入力例（CurrentSectionList は空）

```
meeting_id: m-001
Delta30s: { …Aの出力JSON… }
CurrentSectionList: { "meeting_id":"m-001", "sections":[] }
```

---

## 運用メモ（推奨）

- 失敗時リトライ: 同一プロンプトで 1 回（temperature 据え置き）
- 事前整形: transcript から明らかな雑音（えー、あのー等）は Codex 側で除去したうえで投入
- タイムウィンドウ: 30 秒境界を厳守し、越境コンテキストは渡さない
- ログ: meeting_id, window_start/end, tokens, latency を計測

---

必要なら、このプロンプトを**YAML（Claude/OpenAI JSON mode 向け）**や**関数呼び出し（Tools/Functions）定義**にも変換します。
次はどの実装スタイルに合わせますか？
