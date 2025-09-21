import { z } from 'zod';
import * as dotenv from 'dotenv';

// Load .env file in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

/**
 * Environment variable schema definition
 */
const envSchema = z.object({
  PROJECT_ID: z.string().min(1, 'PROJECT_ID is required'),
  REGION: z.string().min(1, 'REGION is required'),
  KMS_KEY_NAME: z.string().min(1, 'KMS_KEY_NAME is required'),
  MEETING_BAAS_BASE_URL: z.string().url('MEETING_BAAS_BASE_URL must be a valid URL'),
  FIRESTORE_EMULATOR_HOST: z.string().optional(),
  
  // Meeting BaaS configuration
  MEETING_BAAS_TIMEOUT_REQUEST_MS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0)
    .default(15000)
    .optional()
    .or(z.number().optional()),
  MEETING_BAAS_TIMEOUT_STREAM_MS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0)
    .default(600000)
    .optional()
    .or(z.number().optional()),
  // Gladia configuration (required for WebSocket relay)
  GLADIA_API_KEY: z.string().min(1, 'GLADIA_API_KEY is required'),
  PUBLIC_WS_BASE: z.string().min(1, 'PUBLIC_WS_BASE is required'),
  // Gemini(Google AI) を叩くための API キー
  GOOGLE_GENAI_API_KEY: z.string().min(1, 'GOOGLE_GENAI_API_KEY is required'),
  
  // WebSocket relay configuration
  STREAM_RECONNECT_BASE_MS: z
    .union([
      z.string().transform((val) => parseInt(val, 10)),
      z.number()
    ])
    .refine((val) => !isNaN(val) && val > 0)
    .default(5000)
    .optional(),
  STREAM_BACKPRESSURE_MAX_BUFFER: z
    .union([
      z.string().transform((val) => parseInt(val, 10)),
      z.number()
    ])
    .refine((val) => !isNaN(val) && val > 0)
    .default(5242880) // 5MB
    .optional(),
  GLADIA_SEND_WS_CONFIG: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((val) => val === 'true' || val === true)
    .default(false)
    .optional(),
  
  // WebSocket relay security
  WS_RELAY_AUTH_TOKEN: z.string().optional(),
});

/**
 * Type definition for environment variables
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Parsed and validated environment variables
 * Throws an error at startup if required environment variables are missing or invalid
 */
export const env = (() => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
      throw new Error(
        `Environment variable validation failed:\n${missingVars.join('\n')}`
      );
    }
    throw error;
  }
})();
