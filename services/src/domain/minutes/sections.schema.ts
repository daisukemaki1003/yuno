import { z } from "zod";

import { NonEmptyTrimmedString } from "./common.js";
import {
  MinutesActionSchema,
  MinutesDecisionSchema,
  MinutesQuestionSchema,
} from "./delta30s.schema.js";

export const SectionStatusSchema = z.enum(["provisional", "active", "closed"]);
export type SectionStatus = z.infer<typeof SectionStatusSchema>;

export const SectionActionSchema = MinutesActionSchema.omit({ confidence: true });
export type SectionAction = z.infer<typeof SectionActionSchema>;

export const SectionDecisionSchema = MinutesDecisionSchema.omit({ decider: true });
export type SectionDecision = z.infer<typeof SectionDecisionSchema>;

export const SectionQuestionSchema = MinutesQuestionSchema.omit({ asked_by: true });
export type SectionQuestion = z.infer<typeof SectionQuestionSchema>;

const sectionCoreFields = {
  id: NonEmptyTrimmedString,
  title: NonEmptyTrimmedString,
  summary: NonEmptyTrimmedString,
  actions: z.array(SectionActionSchema).optional(),
  decisions: z.array(SectionDecisionSchema).optional(),
  questions: z.array(SectionQuestionSchema).optional(),
} as const;

export const SectionSchema = z
  .object({
    ...sectionCoreFields,
    status: SectionStatusSchema,
  })
  .strict();

export type Section = z.infer<typeof SectionSchema>;

export const ActiveSectionSchema = z
  .object({
    ...sectionCoreFields,
    status: z.enum(["provisional", "active"]),
  })
  .strict();

export type ActiveSection = z.infer<typeof ActiveSectionSchema>;

export const CurrentSectionListSchema = z
  .object({
    meeting_id: NonEmptyTrimmedString,
    sections: z.array(ActiveSectionSchema),
  })
  .strict();

export type CurrentSectionList = z.infer<typeof CurrentSectionListSchema>;

export const SectionChangeSummarySchema = z
  .object({
    created_sections: z.array(NonEmptyTrimmedString),
    updated_sections: z.array(NonEmptyTrimmedString),
    closed_sections: z.array(NonEmptyTrimmedString),
  })
  .strict();

export type SectionChangeSummary = z.infer<typeof SectionChangeSummarySchema>;

export const SectionUpdateResponseSchema = z
  .object({
    meeting_id: NonEmptyTrimmedString,
    changed_sections: z.array(SectionSchema),
    change_summary: SectionChangeSummarySchema,
  })
  .strict();

export type SectionUpdateResponse = z.infer<typeof SectionUpdateResponseSchema>;
