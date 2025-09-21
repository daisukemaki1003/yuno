// minutes サービス全体で参照する閾値・Gemini 設定
export const MINUTES_CONFIG = {
  CONF_MIN: 0.55,
  MERGE_GAP_MS: 1200,
  WINDOW_SEC: 45,
  EMIT_INTERVAL_SEC: 10,
  MAX_SUMMARY: 5,
  MAX_ACTIONS: 3,
  STATE_TTL_MIN: 30,
  DEFAULT_GEMINI_MODEL: "gemini-2.0-flash",
  MAX_TOKENS: 320,
  TEMPERATURE: 0.2,
  REQUEST_TIMEOUT_MS: 4000,
};

// 文字起こしから軽く除去するフィラー語
export const FILLER_WORDS = [
  "えー",
  "あの",
  "その",
  "なんか",
  "はい",
  "えっと",
  "ですね",
];

// LLM へ渡すダイジェスト文字数の上限
export const MAX_DIGEST_LENGTH = 450;
