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