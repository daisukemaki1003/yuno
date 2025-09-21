import type { Context } from "hono";
import { stream } from "hono/streaming";
import { StreamParamsSchema, StreamQuerySchema } from "@/schemas/http.v1.js";
import { badRequest } from "@/utils/errors.js";
import type { Logger } from "@/utils/logger.js";
import { transcriptEmitter } from "@/services/ws-relay.service.js";
import {
  getLastLiveMinutes,
  onLiveMinutes,
  offLiveMinutes,
  type MinutesEvent,
} from "@/services/live-minutes.service.js";

/**
 * SSE recording stream handler - WebSocket relay mode only
 */
export async function recordingSse(c: Context): Promise<Response> {
  const logger = c.get("logger") as Logger;

  // Validate params
  const paramsResult = StreamParamsSchema.safeParse(c.req.param());
  if (!paramsResult.success) {
    throw badRequest("INVALID_ARGUMENT", paramsResult.error.issues[0].message);
  }

  // Validate and parse query
  const queryResult = StreamQuerySchema.safeParse(c.req.query());
  if (!queryResult.success) {
    throw badRequest("INVALID_ARGUMENT", queryResult.error.issues[0].message);
  }

  const { meetingId } = paramsResult.data;
  const { userId, mode, types } = queryResult.data;

  logger.info("Opening recording stream", { meetingId, userId, mode, types: Array.from(types) });

  // Set SSE headers
  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");
  c.header("X-Accel-Buffering", "no"); // Disable Nginx buffering

  return stream(c, async (stream) => {
    let pingInterval: NodeJS.Timeout | null = null;
    let gladiaListener: ((data: unknown) => void) | null = null;
    let minutesListener: ((event: MinutesEvent) => void) | null = null;

    try {
      logger.info("Using WebSocket relay mode for streaming");

      // In ws-relay mode, we listen to Gladia events
      gladiaListener = (data: unknown) => {
        // Type guard for transcript data
        const transcriptData = data as {
          meetingId?: string;
          text?: string;
          language?: string;
          isFinal?: boolean;
          timestamp?: string;
        };

        // Only forward transcript events for now
        if (transcriptData.meetingId === meetingId && types.has("transcript")) {
          const event = {
            type: "transcript",
            data: {
              kind: "transcript",
              text: transcriptData.text,
              lang: transcriptData.language,
              isFinal: transcriptData.isFinal,
              ts: transcriptData.timestamp
                ? new Date(transcriptData.timestamp).getTime()
                : Date.now(),
              confidence: (transcriptData as { confidence?: number }).confidence,
            },
            timestamp: transcriptData.timestamp
              ? new Date(transcriptData.timestamp).getTime()
              : Date.now(),
          };

          // Ensure we don't exceed SSE line length limits
          const eventData = JSON.stringify(event);
          if (eventData.length > 32768) {
            logger.warn("SSE event data too large, truncating", {
              originalLength: eventData.length,
              meetingId,
            });
            const truncatedEvent = {
              ...event,
              data: {
                ...event.data,
                text: event.data.text?.substring(0, 10000) + "...[truncated]",
              },
            };
            stream.write(`event: transcript\ndata: ${JSON.stringify(truncatedEvent)}\n\n`);
          } else {
            stream.write(`event: transcript\ndata: ${eventData}\n\n`);
          }
        }
      };

      // Subscribe to Gladia transcript events
      transcriptEmitter.on("transcript", gladiaListener);

      if (types.has("minutes")) {
        // 接続直後に最新の minutes を 1 度返しておく
        const lastLive = getLastLiveMinutes(meetingId);
        if (lastLive) {
          await stream.write(
            `event: minutes.partial\ndata: ${JSON.stringify(lastLive)}\n\n`
          );
        }

        minutesListener = (event: MinutesEvent) => {
          if (event.meetingId !== meetingId) {
            return;
          }

          // new minutes が生成される度に push 配信
          void stream.write(
            `event: minutes.partial\ndata: ${JSON.stringify(event.live)}\n\n`
          );
        };

        onLiveMinutes(minutesListener);
      }

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
          logger.info("Client disconnected from stream", { meetingId });
          resolve(undefined);
        });
      });
    } catch (err) {
      logger.error("Failed to open recording stream", { error: err });

      const errorEvent = {
        type: "error",
        message: "Failed to open stream",
        timestamp: Date.now(),
      };

      await stream.write(`event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`);
    } finally {
      // Clean up
      if (pingInterval) {
        clearInterval(pingInterval);
      }

      if (gladiaListener) {
        transcriptEmitter.removeListener("transcript", gladiaListener);
      }

      if (minutesListener) {
        offLiveMinutes(minutesListener);
      }
    }
  });
}
