import { z } from 'zod';
/**
 * HTTP v1 API schemas for request/response validation
 */
// Common schemas
export const UserIdSchema = z.string().min(1, 'userId is required');
export const MeetingIdSchema = z.string().min(1, 'meetingId is required');
export const BotIdSchema = z.string().min(1, 'botId is required');
// POST /v1/bots request
export const AddBotRequestSchema = z.object({
    userId: UserIdSchema,
    meetingUrl: z.string().url('meetingUrl must be a valid URL'),
    botName: z.string().optional().default('Meeting Bot'),
    options: z.object({
        language: z.string().optional(),
        model: z.string().optional(),
    }).optional(),
});
// POST /v1/bots response
export const AddBotResponseSchema = z.object({
    botId: BotIdSchema,
    meetingId: MeetingIdSchema,
    status: z.string(),
});
// DELETE /v1/bots/:botId params & query
export const LeaveBotParamsSchema = z.object({
    botId: BotIdSchema,
});
export const LeaveBotQuerySchema = z.object({
    userId: UserIdSchema,
});
// GET /v1/meetings/:meetingId/stream params & query
export const StreamParamsSchema = z.object({
    meetingId: MeetingIdSchema,
});
export const StreamModeSchema = z.enum(['raw', 'normalized']).default('raw');
export const StreamTypeSchema = z.enum(['audio', 'transcript', 'event']);
export const StreamQuerySchema = z.object({
    userId: UserIdSchema,
    mode: StreamModeSchema,
    types: z.string().optional().transform((val) => {
        if (!val)
            return new Set(['audio', 'transcript', 'event']);
        const types = val.split(',').map(t => t.trim()).filter(Boolean);
        return new Set(types);
    }),
});
// SSE event formats
export const SseEventSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('ping'),
        timestamp: z.number(),
    }),
    z.object({
        type: z.literal('audio'),
        data: z.any(),
        timestamp: z.number(),
    }),
    z.object({
        type: z.literal('transcript'),
        data: z.any(),
        timestamp: z.number(),
    }),
    z.object({
        type: z.literal('event'),
        data: z.any(),
        timestamp: z.number(),
    }),
    z.object({
        type: z.literal('error'),
        message: z.string(),
        timestamp: z.number(),
    }),
    z.object({
        type: z.literal('end'),
        timestamp: z.number(),
    }),
]);
//# sourceMappingURL=http.v1.js.map