import { z } from "zod";

import { IsoDateString, NonEmptyTrimmedString } from "./common.js";

export const MinutesActionSchema = z
  .object({
    task: NonEmptyTrimmedString,
    owner: z.string().trim().min(1).optional(),
    due: IsoDateString.optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();

export type MinutesAction = z.infer<typeof MinutesActionSchema>;

export const MinutesDecisionSchema = z
  .object({
    summary: NonEmptyTrimmedString,
    decider: z.string().trim().min(1).optional(),
  })
  .strict();

export type MinutesDecision = z.infer<typeof MinutesDecisionSchema>;

export const MinutesQuestionSchema = z
  .object({
    question: NonEmptyTrimmedString,
    asked_by: z.string().trim().min(1).optional(),
  })
  .strict();

export type MinutesQuestion = z.infer<typeof MinutesQuestionSchema>;

export const Delta30sSchema = z
  .object({
    summaries: z.array(NonEmptyTrimmedString).min(1),
    actions: z.array(MinutesActionSchema),
    decisions: z.array(MinutesDecisionSchema),
    questions: z.array(MinutesQuestionSchema),
  })
  .strict();

export type Delta30s = z.infer<typeof Delta30sSchema>;

export const DEFAULT_LANGUAGE = "ja" as const;

export const Delta30sWindowSchema = z
  .object({
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine(
    ({ start, end }) => new Date(start).getTime() < new Date(end).getTime(),
    {
      message: "window.start must be earlier than window.end",
      path: ["end"],
    }
  );

export type Delta30sWindow = z.infer<typeof Delta30sWindowSchema>;
