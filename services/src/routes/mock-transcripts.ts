import { Hono } from "hono";
import { bearerAuth, extractMeetingBaasApiKey } from "@/middlewares/auth.js";
import { transcriptEmitter } from "@/services/ws-relay.service.js";
import { Logger } from "@/utils/logger.js";

const app = new Hono();
const logger = new Logger("mock-transcripts");

const isProduction = process.env.NODE_ENV === "production";

type MockTranscriptInput = {
  meetingId?: string;
  text?: string;
  language?: string;
  isFinal?: boolean;
  confidence?: number;
  timestamp?: string;
};

app.post("/:meetingId/mock-transcripts", bearerAuth, extractMeetingBaasApiKey, async (c) => {
  if (isProduction) {
    return c.json(
      {
        message: "Mock transcript endpoint is disabled in production",
      },
      403
    );
  }

  const meetingIdParam = c.req.param("meetingId");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch (error) {
    logger.warn("Invalid JSON payload for mock transcripts", { error });
    return c.json(
      {
        message: "Request body must be valid JSON",
      },
      400
    );
  }

  const items = Array.isArray(body) ? body : [body];

  const entries = items.filter((entry): entry is MockTranscriptInput => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    return true;
  });

  if (entries.length === 0) {
    logger.warn("No valid transcript entries provided", { meetingId: meetingIdParam });
    return c.json(
      {
        message: "No valid transcript entries provided",
      },
      400
    );
  }

  let emitted = 0;

  entries.forEach((entry, index) => {
    const meetingId = entry.meetingId ?? meetingIdParam;
    if (!meetingId) {
      logger.warn("Skipping transcript without meetingId", { entry });
      return;
    }

    const timestamp = entry.timestamp
      ? new Date(entry.timestamp).toISOString()
      : new Date(Date.now() + index * 1500).toISOString();

    transcriptEmitter.emit("transcript", {
      meetingId,
      text: entry.text ?? "",
      language: entry.language ?? "ja",
      isFinal: entry.isFinal ?? true,
      confidence: entry.confidence ?? 0.9,
      timestamp,
    });

    emitted += 1;
  });

  logger.info("Mock transcripts emitted", {
    meetingId: meetingIdParam,
    count: emitted,
  });

  return c.json({
    ok: true,
    emitted,
  });
});

export default app;
