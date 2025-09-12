import { z } from 'zod';

/**
 * Vendor-specific schemas for Meeting BaaS v1
 * These schemas are permissive and use passthrough to handle vendor changes
 */

/**
 * Add bot response schema
 * Minimally validates required fields, passes through everything else
 */
export const VendorAddBotResponseSchema = z.object({
  // Different vendors might use different field names
  id: z.union([z.string(), z.number()]).optional(),
  botId: z.union([z.string(), z.number()]).optional(),
  bot_id: z.union([z.string(), z.number()]).optional(),
  // Capture any additional fields
}).passthrough().transform((data) => {
  // Normalize different field names to botId
  const botIdValue = data.botId || data.bot_id || data.id;
  if (!botIdValue) {
    throw new Error('No bot ID field found in response');
  }
  // Convert to string if it's a number
  const botId = String(botIdValue);
  return { ...data, botId };
});

/**
 * Generic vendor error schema
 */
export const VendorErrorSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
  code: z.string().optional(),
  details: z.unknown().optional(),
}).passthrough();

