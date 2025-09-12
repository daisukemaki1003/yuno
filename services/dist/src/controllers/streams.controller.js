import { stream } from 'hono/streaming';
import { StreamParamsSchema, StreamQuerySchema, } from '@/schemas/http.v1.js';
import { badRequest } from '@/utils/errors.js';
import { transcriptEmitter } from '@/services/ws-relay.service.js';
/**
 * SSE recording stream handler - WebSocket relay mode only
 */
export async function recordingSse(c) {
    const logger = c.get('logger');
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
    c.header('X-Accel-Buffering', 'no'); // Disable Nginx buffering
    return stream(c, async (stream) => {
        let pingInterval = null;
        let gladiaListener = null;
        try {
            logger.info('Using WebSocket relay mode for streaming');
            // In ws-relay mode, we listen to Gladia events
            gladiaListener = (data) => {
                // Only forward transcript events for now
                if (data.meetingId === meetingId && types.has('transcript')) {
                    const event = {
                        type: 'transcript',
                        data: {
                            kind: 'transcript',
                            text: data.text,
                            lang: data.language,
                            isFinal: data.isFinal,
                            ts: new Date(data.timestamp).getTime(),
                            confidence: data.confidence
                        },
                        timestamp: new Date(data.timestamp).getTime(),
                    };
                    // Ensure we don't exceed SSE line length limits
                    const eventData = JSON.stringify(event);
                    if (eventData.length > 32768) {
                        logger.warn('SSE event data too large, truncating', {
                            originalLength: eventData.length,
                            meetingId
                        });
                        const truncatedEvent = { ...event, data: { ...event.data, text: event.data.text.substring(0, 10000) + '...[truncated]' } };
                        stream.write(`event: transcript\ndata: ${JSON.stringify(truncatedEvent)}\n\n`);
                    }
                    else {
                        stream.write(`event: transcript\ndata: ${eventData}\n\n`);
                    }
                }
            };
            // Subscribe to Gladia transcript events
            transcriptEmitter.on('transcript', gladiaListener);
            // Send retry directive
            await stream.write(`retry: 5000\n\n`);
            // Set up ping interval (20 seconds) with keep-alive comment
            pingInterval = setInterval(() => {
                // Send keep-alive comment
                stream.write(`: ping\n\n`);
                // Also send ping event
                stream.write(`event: ping\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
            }, 20000);
            // Send initial ping
            await stream.write(`: ping\n\n`);
            await stream.write(`event: ping\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
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
        }
        finally {
            // Clean up
            if (pingInterval) {
                clearInterval(pingInterval);
            }
            if (gladiaListener) {
                transcriptEmitter.removeListener('transcript', gladiaListener);
            }
        }
    });
}
//# sourceMappingURL=streams.controller.js.map