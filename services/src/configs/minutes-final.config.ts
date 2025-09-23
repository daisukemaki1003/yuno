// Configuration scaffold for the 30-second finalized minutes pipeline (Delta30s + section updates).
// TODO: Revisit thresholds once the Delta30s generator and section diff engine are implemented and we gather QA feedback.
export const MINUTES_FINAL_CONFIG = {
  DELTA_WINDOW_SEC: 30, // length of each transcript bucket in seconds
  DELTA_STEP_SEC: 30, // step size between buckets; keep equal to DELTA_WINDOW_SEC for non-overlapping segments
  MIN_DELTA_CHARS: 80, // minimum transcript characters required before generating a bucket
  FILLER_THRESHOLD: 0.4, // ratio of filler/noise tokens allowed before the bucket is discarded
  MAX_SUMMARIES: 4, // cap summaries per bucket to keep UI concise
  MAX_ACTIONS: 4,
  MAX_DECISIONS: 3,
  MAX_QUESTIONS: 3,
  LLM_RETRY_LIMIT: 1, // spec requires a single retry on JSON schema violation
  LLM_MODEL: "gemini-2.0-flash", // align with live minutes defaults until a slower model is approved
  SECTION_MAX_BULLETS: 5, // SectionUpdateResponse bullets upper-bound per spec (3–5)
  SECTION_IDLE_CLOSE_MIN: 6, // TODO: validate the idle duration that triggers section closure heuristics
  CHANGE_SUMMARY_KEYS: ["created_sections", "updated_sections", "closed_sections"] as const,
} as const;

export type MinutesFinalConfig = typeof MINUTES_FINAL_CONFIG;
