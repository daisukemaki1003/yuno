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
    id: z.string().optional(),
    botId: z.string().optional(),
    bot_id: z.string().optional(),
    // Capture any additional fields
}).passthrough().transform((data) => {
    // Normalize different field names to botId
    const botId = data.botId || data.bot_id || data.id;
    if (!botId) {
        throw new Error('No bot ID field found in response');
    }
    return { ...data, botId };
});
/**
 * Bot status response schema
 * Maps vendor status strings to our domain model
 */
export const VendorBotStatusResponseSchema = z.object({
    // Status could be in different fields
    status: z.string().optional(),
    state: z.string().optional(),
    bot_status: z.string().optional(),
    // Capture any additional fields
}).passthrough().transform((data) => {
    // Find the status field
    const status = data.status || data.state || data.bot_status;
    if (!status) {
        throw new Error('No status field found in response');
    }
    return { ...data, status };
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
/**
 * Stream event schemas - very permissive for forward compatibility
 */
/**
 * Audio stream event
 */
export const VendorAudioEventSchema = z.object({
    type: z.string().optional(),
    event: z.string().optional(),
    kind: z.string().optional(),
    timestamp: z.number().optional(),
    ts: z.number().optional(),
    audio: z.any().optional(),
    data: z.any().optional(),
}).passthrough();
/**
 * Transcript stream event
 */
export const VendorTranscriptEventSchema = z.object({
    type: z.string().optional(),
    event: z.string().optional(),
    kind: z.string().optional(),
    timestamp: z.number().optional(),
    ts: z.number().optional(),
    text: z.string().optional(),
    transcript: z.string().optional(),
    lang: z.string().optional(),
    language: z.string().optional(),
    is_final: z.boolean().optional(),
    isFinal: z.boolean().optional(),
    final: z.boolean().optional(),
}).passthrough();
/**
 * Generic stream event - catch-all for unknown event types
 */
export const VendorGenericEventSchema = z.object({
    type: z.string().optional(),
    event: z.string().optional(),
    kind: z.string().optional(),
    timestamp: z.number().optional(),
    ts: z.number().optional(),
}).passthrough();
/**
 * Helper to parse vendor stream events
 * Returns normalized event type and raw data
 */
export function parseVendorStreamEvent(data, fieldMaps) {
    const parsed = VendorGenericEventSchema.parse(data);
    // Determine event type from various possible fields
    const kindField = fieldMaps?.kindField || 'type';
    const eventType = parsed[kindField] || parsed.type || parsed.event || parsed.kind || 'unknown';
    // Get timestamp from various possible fields
    const tsField = fieldMaps?.tsField || 'timestamp';
    const timestamp = parsed[tsField] || parsed.timestamp || parsed.ts || Date.now();
    return {
        eventType: String(eventType),
        timestamp: Number(timestamp),
        raw: parsed,
    };
}
//# sourceMappingURL=meetingbaas.v1.js.map