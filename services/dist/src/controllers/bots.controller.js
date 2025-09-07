import { getMeetingBaasForUser } from "@/services/meetingbaas.service.js";
import { AddBotRequestSchema, LeaveBotParamsSchema, LeaveBotQuerySchema, GetBotStatusParamsSchema, GetBotStatusQuerySchema, } from "@/schemas/http.v1.js";
import { badRequest, notFound, internal } from "@/utils/errors.js";
// Simple in-memory idempotency cache (5 minutes TTL)
const idempotencyCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
// Clean up old cache entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of idempotencyCache.entries()) {
        if (now - value.timestamp > CACHE_TTL_MS) {
            idempotencyCache.delete(key);
        }
    }
}, 60 * 1000); // Run every minute
/**
 * Add a bot to a meeting
 */
export async function addBot(c) {
    const logger = c.get("logger");
    const apiKey = c.get("meetingBaasApiKey");
    logger.info("===================== addBot =====================");
    // Check idempotency key
    const idempotencyKey = c.req.header("Idempotency-Key");
    if (idempotencyKey) {
        const cached = idempotencyCache.get(idempotencyKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            logger.info("Returning cached response for idempotency key", { idempotencyKey });
            return c.json(cached.response);
        }
    }
    // Validate request body
    const bodyResult = await c.req.json().catch(() => null);
    if (!bodyResult) {
        throw badRequest("INVALID_JSON", "Invalid JSON in request body");
    }
    const validationResult = AddBotRequestSchema.safeParse(bodyResult);
    if (!validationResult.success) {
        throw badRequest("INVALID_ARGUMENT", validationResult.error.issues[0].message);
    }
    const { userId, meetingUrl, botName, options } = validationResult.data;
    logger.info("Adding bot to meeting", { userId, meetingUrl, botName, options });
    try {
        // Get Meeting BaaS client for user
        const baas = await getMeetingBaasForUser(userId, apiKey);
        // Add bot to meeting
        const result = await baas.addBot(meetingUrl, botName);
        // Get initial status
        const statusResult = await baas.getBotStatus(result.botId);
        const response = {
            botId: result.botId,
            meetingId: meetingUrl, // Using meetingUrl for backward compatibility
            status: statusResult.status,
        };
        logger.info("response", { response });
        // Cache response if idempotency key provided
        if (idempotencyKey) {
            idempotencyCache.set(idempotencyKey, {
                response,
                timestamp: Date.now(),
            });
        }
        logger.info("Bot added successfully", { botId: result.botId, status: statusResult.status });
        return c.json(response);
    }
    catch (err) {
        logger.error("Failed to add bot", { error: err });
        // Map vendor errors to our error codes
        if (err instanceof Error) {
            if (err.message.includes("not found")) {
                throw notFound("MEETING_NOT_FOUND", "Meeting not found");
            }
            if (err.message.includes("conflict") || err.message.includes("already")) {
                throw badRequest("CONFLICT", "Bot already exists in meeting");
            }
        }
        throw internal("UPSTREAM_ERROR", "Failed to add bot to meeting");
    }
}
/**
 * Remove a bot from a meeting
 */
export async function leaveBot(c) {
    const logger = c.get("logger");
    const apiKey = c.get("meetingBaasApiKey");
    // Validate params
    const paramsResult = LeaveBotParamsSchema.safeParse(c.req.param());
    if (!paramsResult.success) {
        throw badRequest("INVALID_ARGUMENT", paramsResult.error.issues[0].message);
    }
    // Validate query
    const queryResult = LeaveBotQuerySchema.safeParse(c.req.query());
    if (!queryResult.success) {
        throw badRequest("INVALID_ARGUMENT", queryResult.error.issues[0].message);
    }
    const { botId } = paramsResult.data;
    const { userId } = queryResult.data;
    logger.info("Removing bot from meeting", { botId, userId });
    try {
        // Get Meeting BaaS client for user
        const baas = await getMeetingBaasForUser(userId, apiKey);
        // Get bot info first to get meetingId
        const statusResult = await baas.getBotStatus(botId);
        // Leave bot
        // Note: We need meetingId for the leave operation
        // In a real implementation, we might store bot->meeting mapping
        // For now, we'll pass empty meetingId and rely on botId
        await baas.leaveBot("", botId);
        logger.info("Bot removed successfully", { botId });
        return c.body(null, 204);
    }
    catch (err) {
        logger.error("Failed to remove bot", { error: err });
        if (err instanceof Error) {
            if (err.message.includes("not found")) {
                throw notFound("BOT_NOT_FOUND", "Bot not found");
            }
        }
        throw internal("UPSTREAM_ERROR", "Failed to remove bot from meeting");
    }
}
/**
 * Get bot status
 */
export async function getStatus(c) {
    const logger = c.get("logger");
    const apiKey = c.get("meetingBaasApiKey");
    // Validate params
    const paramsResult = GetBotStatusParamsSchema.safeParse(c.req.param());
    if (!paramsResult.success) {
        throw badRequest("INVALID_ARGUMENT", paramsResult.error.issues[0].message);
    }
    // Validate query
    const queryResult = GetBotStatusQuerySchema.safeParse(c.req.query());
    if (!queryResult.success) {
        throw badRequest("INVALID_ARGUMENT", queryResult.error.issues[0].message);
    }
    const { botId } = paramsResult.data;
    const { userId } = queryResult.data;
    logger.info("Getting bot status", { botId, userId });
    try {
        // Get Meeting BaaS client for user
        const baas = await getMeetingBaasForUser(userId, apiKey);
        // Get bot status
        const result = await baas.getBotStatus(botId);
        const response = {
            botId,
            status: result.status,
            meetingId: "", // Would need to store bot->meeting mapping
            // Include vendor raw data if available
            vendorRaw: result.vendorRaw,
        };
        logger.info("Bot status retrieved", { botId, status: result.status });
        return c.json(response);
    }
    catch (err) {
        logger.error("Failed to get bot status", { error: err });
        if (err instanceof Error) {
            if (err.message.includes("not found")) {
                throw notFound("BOT_NOT_FOUND", "Bot not found");
            }
        }
        throw internal("UPSTREAM_ERROR", "Failed to get bot status");
    }
}
//# sourceMappingURL=bots.controller.js.map