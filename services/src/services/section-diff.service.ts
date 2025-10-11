import type { Delta30s } from "@/domain/minutes/delta30s.schema.js";
import {
  ActiveSectionSchema,
  type CurrentSectionList,
  CurrentSectionListSchema,
  type Section,
  SectionActionSchema,
  type SectionAction,
  SectionSchema,
  SectionUpdateResponseSchema,
  type SectionUpdateResponse,
} from "@/domain/minutes/index.js";

interface SectionDraft {
  section: Section;
  created: boolean;
  changed: boolean;
}

const SUMMARY_MATCH_THRESHOLD = 0.2;
const TEXT_MATCH_THRESHOLD = 0.2;

export class SectionDiffService {
  // Delta30s と最新セクション一覧から差分を生成するエントリーポイント
  diff(meetingId: string, delta: Delta30s, currentList?: CurrentSectionList | null): SectionUpdateResponse {
    const normalizedCurrent = this.normalizeCurrentList(meetingId, currentList);
    const drafts = this.buildInitialDrafts(normalizedCurrent.sections);

    this.applySummaries(drafts, delta.summaries);
    this.applyActions(drafts, delta.actions);
    this.applyDecisions(drafts, delta.decisions);
    this.applyQuestions(drafts, delta.questions);

    return this.buildResponse(normalizedCurrent.meeting_id, drafts);
  }

  private normalizeCurrentList(meetingId: string, currentList: CurrentSectionList | null | undefined): CurrentSectionList {
    if (!currentList) {
      return CurrentSectionListSchema.parse({ meeting_id: meetingId, sections: [] });
    }

    return CurrentSectionListSchema.parse(currentList);
  }

  // 現在のセクションをドラフト構造に変換（ここで mutable なワークコピーを作る）
  private buildInitialDrafts(sections: CurrentSectionList["sections"]): Map<string, SectionDraft> {
    const drafts = new Map<string, SectionDraft>();

    for (const section of sections) {
      const parsed = ActiveSectionSchema.parse(section);
      drafts.set(parsed.id, {
        section: {
          id: parsed.id,
          title: parsed.title,
          summary: parsed.summary,
          status: parsed.status === "provisional" ? "provisional" : "active",
          actions: parsed.actions ? [...parsed.actions] : [],
          decisions: parsed.decisions ? [...parsed.decisions] : [],
          questions: parsed.questions ? [...parsed.questions] : [],
        },
        created: false,
        changed: false,
      });
    }

    return drafts;
  }

  private applySummaries(drafts: Map<string, SectionDraft>, summaries: string[]): void {
    for (const summary of summaries) {
      const trimmed = summary.trim();
      if (!trimmed) {
        continue;
      }

      const match = this.findBestSectionMatch(trimmed, drafts);
      if (match && match.score >= SUMMARY_MATCH_THRESHOLD) {
        const draft = drafts.get(match.section.id);
        if (!draft) {
          continue;
        }

        // 要約が一致した既存セクションは最新 summary を上書きし、 provisional なら active に昇格
        if (draft.section.summary !== trimmed) {
          draft.section.summary = trimmed;
          draft.changed = true;
        }

        if (draft.section.status === "provisional") {
          draft.section.status = "active";
          draft.changed = true;
        }
      } else {
        const draft = this.createSectionDraft(trimmed, drafts);
        drafts.set(draft.section.id, draft);
      }
    }
  }

  // 行動項目・決定・質問はいずれもテキスト類似度で紐付け、重複を除去してから追加する
  private applyActions(drafts: Map<string, SectionDraft>, actions: Delta30s["actions"]): void {
    for (const action of actions) {
      const target = this.findBestTextMatch(action.task, drafts) ?? this.findMostRecentDraft(drafts);
      if (!target) {
        continue;
      }

      const sanitized = this.sanitiseAction(action);
      if (!sanitized) {
        continue;
      }

      target.section.actions ||= [];
      const existing = target.section.actions;
      if (!this.hasDuplicateAction(existing, sanitized)) {
        existing.push(sanitized);
        if (!target.created) {
          target.changed = true;
        }
      }
    }
  }

  private applyDecisions(drafts: Map<string, SectionDraft>, decisions: Delta30s["decisions"]): void {
    for (const decision of decisions) {
      const target = this.findBestTextMatch(decision.summary, drafts) ?? this.findMostRecentDraft(drafts);
      if (!target) {
        continue;
      }

      target.section.decisions ||= [];
      const normalized = decision.summary.trim();
      if (!normalized) {
        continue;
      }

      if (!target.section.decisions.some((d) => d.summary.toLowerCase() === normalized.toLowerCase())) {
        target.section.decisions.push({ summary: normalized });
        if (!target.created) {
          target.changed = true;
        }
      }
    }
  }

  private applyQuestions(drafts: Map<string, SectionDraft>, questions: Delta30s["questions"]): void {
    for (const question of questions) {
      const target = this.findBestTextMatch(question.question, drafts) ?? this.findMostRecentDraft(drafts);
      if (!target) {
        continue;
      }

      target.section.questions ||= [];
      const normalized = question.question.trim();
      if (!normalized) {
        continue;
      }

      if (!target.section.questions.some((q) => q.question.toLowerCase() === normalized.toLowerCase())) {
        target.section.questions.push({ question: normalized });
        if (!target.created) {
          target.changed = true;
        }
      }
    }
  }

  private buildResponse(meetingId: string, drafts: Map<string, SectionDraft>): SectionUpdateResponse {
    const changedSections: Section[] = [];
    const createdIds: string[] = [];
    const updatedIds: string[] = [];

    for (const draft of drafts.values()) {
      if (draft.created) {
        createdIds.push(draft.section.id);
        changedSections.push(this.compactSection(draft.section));
      } else if (draft.changed) {
        updatedIds.push(draft.section.id);
        changedSections.push(this.compactSection(draft.section));
      }
    }

    const response = {
      meeting_id: meetingId,
      changed_sections: changedSections,
      change_summary: {
        created_sections: createdIds,
        updated_sections: updatedIds,
        closed_sections: [],
      },
    } satisfies SectionUpdateResponse;

    return SectionUpdateResponseSchema.parse(response);
  }

  private findBestSectionMatch(summary: string, drafts: Map<string, SectionDraft>): { section: Section; score: number } | null {
    let best: { section: Section; score: number } | null = null;
    for (const draft of drafts.values()) {
      const score = this.computeSummaryScore(summary, draft.section);
      if (!best || score > best.score) {
        best = { section: draft.section, score };
      }
    }
    return best;
  }

  private createSectionDraft(summary: string, drafts: Map<string, SectionDraft>): SectionDraft {
    const id = this.generateSectionId(summary, drafts);
    const title = this.generateSectionTitle(summary);
    return {
      section: {
        id,
        title,
        summary,
        status: "provisional",
        actions: [],
        decisions: [],
        questions: [],
      },
      created: true,
      changed: true,
    };
  }

  private findBestTextMatch(text: string, drafts: Map<string, SectionDraft>): SectionDraft | null {
    let best: { draft: SectionDraft; score: number } | null = null;
    for (const draft of drafts.values()) {
      const score = this.computeTextScore(text, draft.section);
      if (!best || score > best.score) {
        best = { draft, score };
      }
    }

    if (best && best.score >= TEXT_MATCH_THRESHOLD) {
      return best.draft;
    }

    return null;
  }

  private findMostRecentDraft(drafts: Map<string, SectionDraft>): SectionDraft | null {
    const createdDrafts = Array.from(drafts.values()).filter((draft) => draft.created);
    if (createdDrafts.length > 0) {
      return createdDrafts[createdDrafts.length - 1];
    }
    return drafts.values().next().value ?? null;
  }

  private sanitiseAction(action: Delta30s["actions"][number]): SectionAction | null {
    const parsed = SectionActionSchema.safeParse({
      task: action.task.trim(),
      owner: action.owner?.trim() || undefined,
      due: action.due,
    });

    if (!parsed.success) {
      return null;
    }

    return parsed.data;
  }

  private hasDuplicateAction(actions: SectionAction[] | undefined, incoming: SectionAction): boolean {
    if (!actions || actions.length === 0) {
      return false;
    }

    const key = this.actionKey(incoming);
    return actions.some((action) => this.actionKey(action) === key);
  }

  private actionKey(action: SectionAction): string {
    const owner = action.owner?.toLowerCase() ?? "";
    const due = action.due ?? "";
    return `${action.task.toLowerCase()}|${owner}|${due}`;
  }

  private compactSection(section: Section): Section {
    const compacted: Section = {
      id: section.id,
      title: section.title,
      summary: section.summary,
      status: section.status,
    };

    if (section.actions && section.actions.length > 0) {
      compacted.actions = section.actions;
    }

    if (section.decisions && section.decisions.length > 0) {
      compacted.decisions = section.decisions;
    }

    if (section.questions && section.questions.length > 0) {
      compacted.questions = section.questions;
    }

    return SectionSchema.parse(compacted);
  }

  private computeSummaryScore(summary: string, section: Section): number {
    if (!summary || !section.summary) {
      return 0;
    }

    if (summary === section.summary) {
      return 1;
    }

    if (section.summary.includes(summary) || summary.includes(section.summary)) {
      return 1;
    }

    if (section.title.includes(summary) || summary.includes(section.title)) {
      return 0.9;
    }

    const summaryTokens = this.tokenize(summary);
    const titleTokens = this.tokenize(section.title);
    const sectionTokens = this.tokenize(section.summary);
    const summaryNgrams = this.generateNgrams(summary);
    const sectionNgrams = this.generateNgrams(section.summary);

    const overlapWithSummary = this.computeOverlap(summaryTokens, sectionTokens);
    const overlapWithTitle = this.computeOverlap(summaryTokens, titleTokens);
    const overlapWithNgrams = this.computeOverlap(summaryNgrams, sectionNgrams);

    return Math.max(overlapWithSummary, overlapWithTitle, overlapWithNgrams);
  }

  private computeTextScore(text: string, section: Section): number {
    const tokensA = this.tokenize(text);
    const tokensB = this.tokenize(`${section.title} ${section.summary}`);
    const ngramsA = this.generateNgrams(text);
    const ngramsB = this.generateNgrams(`${section.title} ${section.summary}`);
    return Math.max(this.computeOverlap(tokensA, tokensB), this.computeOverlap(ngramsA, ngramsB));
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/u)
      .filter(Boolean);
  }

  private generateNgrams(text: string, size = 2): string[] {
    const normalized = text.replace(/\s+/g, "");
    if (normalized.length <= size) {
      return normalized ? [normalized] : [];
    }

    const ngrams: string[] = [];
    for (let i = 0; i <= normalized.length - size; i++) {
      ngrams.push(normalized.slice(i, i + size));
    }
    return ngrams;
  }

  private computeOverlap(tokensA: string[], tokensB: string[]): number {
    if (tokensA.length === 0 || tokensB.length === 0) {
      return 0;
    }

    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    let intersection = 0;
    for (const token of setA) {
      if (setB.has(token)) {
        intersection += 1;
      }
    }

    return intersection / Math.max(setA.size, setB.size);
  }

  private generateSectionId(summary: string, drafts: Map<string, SectionDraft>): string {
    const base = summary
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40) || "topic";

    let candidate = `sec_${base}`;
    let suffix = 1;
    while (drafts.has(candidate)) {
      candidate = `sec_${base}_${suffix++}`;
    }
    return candidate;
  }

  private generateSectionTitle(summary: string): string {
    const tokens = summary.split(/\s+/);
    return tokens.slice(0, 6).join(" ");
  }
}
