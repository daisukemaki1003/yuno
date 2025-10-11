import { z } from "zod";

export const NonEmptyTrimmedString = z.string().trim().min(1, "Value cannot be empty");

export const IsoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Invalid date format. Use YYYY-MM-DD");
