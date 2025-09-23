import { z } from "zod";

const IsoDateStringSchema = z
  .string()
  .regex(/^(\d{4})-(\d{2})-(\d{2})$/, "Invalid date format, use YYYY-MM-DD");

export const MinutesActionSchema = z
  .object({
    owner: z.string().optional(),
    task: z.string().min(1, "Action task is required"),
    due: z.union([IsoDateStringSchema, z.null()]).optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();

export type MinutesAction = z.infer<typeof MinutesActionSchema>;

export const MinutesDecisionSchema = z
  .object({
    what: z.string().min(1, "Decision content is required"),
    reason: z.string().min(1, "Decision reason is required"),
  })
  .strict();

export type MinutesDecision = z.infer<typeof MinutesDecisionSchema>;

export const MinutesQuestionSchema = z
  .object({
    topic: z.string().min(1, "Question topic is required"),
    related_section_id: z.string().min(1).optional(),
    priority: z.enum(["low", "mid", "high"]).optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();

export type MinutesQuestion = z.infer<typeof MinutesQuestionSchema>;

export const Delta30sSchema = z
  .object({
    summaries: z.array(z.string().min(1)).min(1),
    actions: z.array(MinutesActionSchema),
    decisions: z.array(MinutesDecisionSchema).optional(),
    questions: z.array(MinutesQuestionSchema).optional(),
  })
  .strict();

export type Delta30s = z.infer<typeof Delta30sSchema>;

export const SectionStatusInputSchema = z.enum(["active", "provisional"]);
export type SectionStatusInput = z.infer<typeof SectionStatusInputSchema>;

export const SectionStatusOutputSchema = z.enum(["provisional", "active", "closed"]);
export type SectionStatusOutput = z.infer<typeof SectionStatusOutputSchema>;

export const SectionInputSchema = z
  .object({
    id: z.string().min(1, "Section id is required"),
    title: z.string().min(1, "Section title is required"),
    status: SectionStatusInputSchema,
    bullets: z.array(z.string().min(1)).min(1),
    actions: z.array(MinutesActionSchema).optional(),
  })
  .strict();

export type SectionInput = z.infer<typeof SectionInputSchema>;

export const CurrentSectionListSchema = z
  .object({
    meeting_id: z.string().min(1, "meeting_id is required"),
    sections: z.array(SectionInputSchema),
  })
  .strict();

export type CurrentSectionList = z.infer<typeof CurrentSectionListSchema>;

export const SectionOutputSchema = z
  .object({
    id: z.string().min(1, "Section id is required"),
    title: z.string().min(1, "Section title is required"),
    status: SectionStatusOutputSchema,
    bullets: z.array(z.string().min(1)).min(1),
    actions: z.array(MinutesActionSchema),
  })
  .strict();

export type SectionOutput = z.infer<typeof SectionOutputSchema>;

export const SectionChangeSummarySchema = z
  .object({
    created_sections: z.array(z.string()),
    updated_sections: z.array(z.string()),
    closed_sections: z.array(z.string()),
  })
  .strict();

export type SectionChangeSummary = z.infer<typeof SectionChangeSummarySchema>;

export const SectionUpdateResponseSchema = z
  .object({
    meeting_id: z.string().min(1, "meeting_id is required"),
    changed_sections: z.array(SectionOutputSchema),
    change_summary: SectionChangeSummarySchema,
  })
  .strict();

export type SectionUpdateResponse = z.infer<typeof SectionUpdateResponseSchema>;
