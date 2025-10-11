import { z } from "zod";

import { NonEmptyTrimmedString } from "./common.js";
import { CurrentSectionListSchema } from "./sections.schema.js";
import { Delta30sSchema, Delta30sWindowSchema } from "./delta30s.schema.js";

export const MeetingIdParamSchema = NonEmptyTrimmedString;
export type MeetingIdParam = z.infer<typeof MeetingIdParamSchema>;

const languageSchema = z
  .string()
  .trim()
  .min(2)
  .max(8);

export const Delta30sRouteBodySchema = z
  .object({
    transcript: z.string().trim().min(1),
    window: Delta30sWindowSchema,
    language: languageSchema.optional(),
    currentSectionList: CurrentSectionListSchema.optional(),
  })
  .strict();

export type Delta30sRouteBody = z.infer<typeof Delta30sRouteBodySchema>;

export const SectionDiffInputSchema = z
  .object({
    delta: Delta30sSchema,
    current: CurrentSectionListSchema,
  })
  .strict();

export type SectionDiffInput = z.infer<typeof SectionDiffInputSchema>;
