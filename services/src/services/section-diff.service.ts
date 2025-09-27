import { MINUTES_FINAL_CONFIG } from "@/configs/minutes-final.config.js";
import {
  type Delta30s,
  type MinutesAction,
  type CurrentSectionList,
  type SectionOutput,
  type SectionUpdateResponse,
  SectionUpdateResponseSchema,
} from "@/domain/minutes/index.js";

type SectionMatch = {
  section: SectionOutput;
  created: boolean;
};

const SUMMARY_SIMILARITY_THRESHOLD = 0.25;
const ACTION_SIMILARITY_THRESHOLD = 0.2;

export class SectionDiffEngine {
  diff(
    current: CurrentSectionList,
    delta: Delta30s
  ): SectionUpdateResponse {
    const normalizedSections = current.sections.map((section) =>
      cloneSection(section)
    );

    const sectionMap = new Map<string, SectionMatch>();
    normalizedSections.forEach((section) =>
      sectionMap.set(section.id, { section, created: false })
    );

    const createdSections: SectionOutput[] = [];
    const updatedSections = new Set<string>();

    for (const summary of delta.summaries) {
      const cleanedSummary = summary.trim();
      if (!cleanedSummary) {
        continue;
      }

      const match = findBestSectionMatch(cleanedSummary, sectionMap);
      if (match && match.score >= SUMMARY_SIMILARITY_THRESHOLD) {
        const { section } = match;
        if (!section.bullets.includes(cleanedSummary)) {
          section.bullets.push(cleanedSummary);
          trimArray(section.bullets, MINUTES_FINAL_CONFIG.SECTION_MAX_BULLETS);
        }
        updatedSections.add(section.id);
      } else {
        const newSection = createSectionFromSummary(
          cleanedSummary,
          sectionMap
        );
        createdSections.push(newSection);
      }
    }

    const allSections = [...sectionMap.values()].map((entry) => entry.section);
    const assignableSections = [...allSections, ...createdSections];

    for (const action of delta.actions) {
      const targetSection = findSectionForAction(
        action,
        assignableSections,
        createdSections
      );
      (targetSection.actions ||= []);
      if (!targetSection.actions.some((existing) => existing.task === action.task)) {
        targetSection.actions.push(normalizeAction(action));
      }

      if (!createdSections.includes(targetSection)) {
        updatedSections.add(targetSection.id);
      }
    }

    if (delta.decisions) {
      for (const decision of delta.decisions) {
        const bullet = `決定: ${decision.what}`;
        const target = findSectionByPriority(assignableSections);
        if (!target.bullets.includes(bullet)) {
          target.bullets.push(bullet);
          trimArray(target.bullets, MINUTES_FINAL_CONFIG.SECTION_MAX_BULLETS);
        }
        if (!createdSections.includes(target)) {
          updatedSections.add(target.id);
        }
      }
    }

    if (delta.questions) {
      for (const question of delta.questions) {
        const bullet = `未解決: ${question.topic}`;
        const target = findSectionByPriority(assignableSections, question.related_section_id);
        if (!target.bullets.includes(bullet)) {
          target.bullets.push(bullet);
          trimArray(target.bullets, MINUTES_FINAL_CONFIG.SECTION_MAX_BULLETS);
        }
        if (!createdSections.includes(target)) {
          updatedSections.add(target.id);
        }
      }
    }

    const updatedSectionOutputs = [...updatedSections]
      .map((id) => sectionMap.get(id)?.section)
      .filter((section): section is SectionOutput => Boolean(section));

    const changedSections: SectionOutput[] = [
      ...updatedSectionOutputs,
      ...createdSections,
    ];

    const response: SectionUpdateResponse = {
      meeting_id: current.meeting_id,
      changed_sections: changedSections,
      change_summary: {
        created_sections: createdSections.map((section) => section.id),
        updated_sections: updatedSectionOutputs.map((section) => section.id),
        closed_sections: [],
      },
    };

    return SectionUpdateResponseSchema.parse(response);
  }
}

function cloneSection(section: CurrentSectionList["sections"][number]): SectionOutput {
  return {
    id: section.id,
    title: section.title,
    status: section.status,
    bullets: [...section.bullets],
    actions: section.actions ? [...section.actions] : [],
  };
}

function normalizeAction(action: MinutesAction): MinutesAction {
  return {
    task: action.task.trim(),
    owner: action.owner?.trim() || undefined,
    due: action.due ?? undefined,
    confidence: action.confidence,
  };
}

function findBestSectionMatch(
  summary: string,
  sections: Map<string, SectionMatch>
): { section: SectionOutput; score: number } | null {
  let best: { section: SectionOutput; score: number } | null = null;
  for (const entry of sections.values()) {
    const baseText = `${entry.section.title} ${entry.section.bullets.join(" ")}`;
    let score = computeSimilarity(summary, baseText);
    if (
      summary.includes(entry.section.title) ||
      entry.section.title.includes(summary) ||
      entry.section.bullets.some((bullet) => summary.includes(bullet) || bullet.includes(summary))
    ) {
      score = Math.max(score, 1);
    }
    if (!best || score > best.score) {
      best = { section: entry.section, score };
    }
  }
  return best;
}

function createSectionFromSummary(
  summary: string,
  sections: Map<string, SectionMatch>
): SectionOutput {
  const id = generateSectionId(summary, sections);
  const section: SectionOutput = {
    id,
    title: generateSectionTitle(summary),
    status: "provisional",
    bullets: [summary],
    actions: [],
  };
  sections.set(id, { section, created: true });
  return section;
}

function generateSectionId(summary: string, sections: Map<string, SectionMatch>): string {
  const base = slugify(summary || "new-section");
  let candidate = `sec_${base}`;
  let suffix = 1;
  while (sections.has(candidate)) {
    candidate = `sec_${base}_${suffix++}`;
  }
  return candidate;
}

function generateSectionTitle(summary: string): string {
  const words = summary.split(/\s+/).slice(0, 4);
  return words.join(" ");
}

function slugify(text: string): string {
  const normalized = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return normalized.slice(0, 32) || "topic";
}

function computeSimilarity(a: string, b: string): number {
  if (!a || !b) {
    return 0;
  }

  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));

  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
    }
  }

  return intersection / Math.max(setA.size, setB.size);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]+/u)
    .filter(Boolean);
}

function trimArray<T>(array: T[], maxLength: number): void {
  if (array.length > maxLength) {
    array.splice(0, array.length - maxLength);
  }
}

function findSectionForAction(
  action: MinutesAction,
  sections: SectionOutput[],
  createdSections: SectionOutput[]
): SectionOutput {
  let best: { section: SectionOutput; score: number } | null = null;
  for (const section of sections) {
    const score = computeSimilarity(action.task, `${section.title} ${section.bullets.join(" ")}`);
    if (!best || score > best.score) {
      best = { section, score };
    }
  }

  if (best && best.score >= ACTION_SIMILARITY_THRESHOLD) {
    return best.section;
  }

  if (createdSections.length > 0) {
    return createdSections[createdSections.length - 1];
  }

  return sections[0];
}

function findSectionByPriority(
  sections: SectionOutput[],
  preferredId?: string
): SectionOutput {
  if (preferredId) {
    const preferred = sections.find((section) => section.id === preferredId);
    if (preferred) {
      return preferred;
    }
  }

  const active = sections.find((section) => section.status === "active");
  return active ?? sections[0];
}
