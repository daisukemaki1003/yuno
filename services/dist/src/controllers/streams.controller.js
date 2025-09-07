import { stream } from 'hono/streaming';
import { getMeetingBaasForUser } from '@/services/meetingbaas.service.js';
import { StreamParamsSchema, StreamQuerySchema, } from '@/schemas/http.v1.js';
import { badRequest, internal } from '@/utils/errors.js';
/**
 * SSE recording stream handler
 */
export async function recordingSse(c) {
    const logger = c.get('logger');
    const apiKey = c.get('meetingBaasApiKey');
    // Validate params
    const paramsResult = StreamParamsSchema.safeParse(c.req.param());
    if (!paramsResult.success) {
        throw badRequest('INVALID_ARGUMENT', paramsResult.error.issues[0].message);
    }
    // Validate and parse query
    const queryResult = StreamQuerySchema.safeParse(c.req.query());
    if (!queryResult.success) {
        throw badRequest('INVALID_ARGUMENT', queryResult.error.issues[0].message);
    }
    const { meetingId } = paramsResult.data;
    const { userId, mode, types } = queryResult.data;
    logger.info('Opening recording stream', { meetingId, userId, mode, types: Array.from(types) });
    // Set SSE headers
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    return stream(c, async (stream) => {
        let baasStream = null;
        let pingInterval = null;
        try {
            // Get Meeting BaaS client for user
            const baas = await getMeetingBaasForUser(userId, apiKey);
            // Open recording stream
            baasStream = await baas.openRecordingStream(meetingId, {
                normalized: mode === 'normalized',
            });
            // Set up ping interval (30 seconds)
            pingInterval = setInterval(() => {
                stream.write(`event: ping\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
            }, 30000);
            // Send initial ping
            await stream.write(`event: ping\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
            // Handle incoming frames
            baasStream.onData((frame) => {
                // Filter by requested types
                if (!types.has(frame.kind)) {
                    return;
                }
                // Format SSE event
                const event = {
                    type: frame.kind,
                    data: frame,
                    timestamp: frame.ts || Date.now(),
                };
                stream.write(`event: ${frame.kind}\ndata: ${JSON.stringify(event)}\n\n`);
            });
            // Handle errors
            baasStream.onError((err) => {
                logger.error('Recording stream error', { error: err });
                const errorEvent = {
                    type: 'error',
                    message: err.message || 'Stream error occurred',
                    timestamp: Date.now(),
                };
                stream.write(`event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`);
                stream.close();
            });
            // Handle stream closure
            baasStream.onClose(() => {
                logger.info('Recording stream closed', { meetingId });
                const endEvent = {
                    type: 'end',
                    timestamp: Date.now(),
                };
                stream.write(`event: end\ndata: ${JSON.stringify(endEvent)}\n\n`);
                stream.close();
            });
            // Keep the stream open
            await new Promise((resolve) => {
                stream.onAbort(() => {
                    logger.info('Client disconnected from stream', { meetingId });
                    resolve(undefined);
                });
            });
        }
        catch (err) {
            logger.error('Failed to open recording stream', { error: err });
            const errorEvent = {
                type: 'error',
                message: 'Failed to open stream',
                timestamp: Date.now(),
            };
            await stream.write(`event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`);
            throw internal('STREAM_ERROR', 'Failed to open recording stream');
        }
        finally {
            // Clean up
            if (pingInterval) {
                clearInterval(pingInterval);
            }
            if (baasStream) {
                try {
                    baasStream.close();
                }
                catch (err) {
                    logger.error('Error closing BaaS stream', { error: err });
                }
            }
        }
    });
}
//# sourceMappingURL=streams.controller.js.map