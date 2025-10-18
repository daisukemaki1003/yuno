import {
  API_AUTH_BEARER,
  API_DEFAULT_USER_ID,
  API_MEETING_BAAS_KEY,
  STREAM_BASE_URL,
  USE_API_MOCKS,
} from "@/lib/config";
import {
  mockMinutesEvents,
  mockTranscriptEvents,
} from "@/shared/mocks/meetings";
import type { MinutesSectionsEvent, TranscriptEvent } from "@/shared/types/meetings";

export type MeetingStreamHandlers = {
  onTranscript?: (event: TranscriptEvent) => void;
  onMinutes?: (event: MinutesSectionsEvent) => void;
  onError?: (error: Error) => void;
  onOpen?: () => void;
};

export type MeetingStreamOptions = {
  types?: Array<"minutes" | "transcript" | "audio" | "event">;
};

const DECODER = new TextDecoder();

function startMockStream(handlers: MeetingStreamHandlers, meetingId: string) {
  const disposers: Array<() => void> = [];

  handlers.onOpen?.();

  mockMinutesEvents.forEach((event, index) => {
    const timer = setTimeout(() => {
      handlers.onMinutes?.({
        ...event,
        meetingId,
        update: {
          ...event.update,
          meeting_id: meetingId,
        },
      });
    }, 700 * (index + 1));
    disposers.push(() => clearTimeout(timer));
  });

  mockTranscriptEvents.forEach((event, index) => {
    const timer = setTimeout(() => {
      handlers.onTranscript?.({
        ...event,
        data: {
          ...event.data,
          ts: Date.now(),
        },
      });
    }, 500 * (index + 1));
    disposers.push(() => clearTimeout(timer));
  });

  const pingTimer = setInterval(() => {
    // keep-alive noop for parity with real stream
  }, 20000);
  disposers.push(() => clearInterval(pingTimer));

  return () => disposers.splice(0).forEach((dispose) => dispose());
}

function parseSseChunk(
  chunk: string,
  handlers: MeetingStreamHandlers
) {
  const messages = chunk.split("\n\n");

  messages.forEach((message) => {
    if (!message.trim()) {
      return;
    }

    const lines = message.split("\n");
    let eventName = "message";
    const dataLines: string[] = [];

    lines.forEach((line) => {
      if (line.startsWith(":")) {
        return;
      }
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    });

    if (eventName === "ping" || eventName === "comment") {
      return;
    }

    if (eventName === "end") {
      handlers.onError?.(new Error("Stream ended"));
      return;
    }

    const dataString = dataLines.join("\n");
    if (!dataString) {
      return;
    }

    try {
      const payload = JSON.parse(dataString);
      if (eventName === "minutes.sections") {
        handlers.onMinutes?.(payload as MinutesSectionsEvent);
      } else if (eventName === "transcript") {
        handlers.onTranscript?.(payload as TranscriptEvent);
      }
    } catch (error) {
      console.error("Failed to parse SSE payload", error, { eventName, dataString });
    }
  });
}

export function subscribeMeetingStream(
  meetingId: string,
  handlers: MeetingStreamHandlers,
  options: MeetingStreamOptions = {}
) {
  if (USE_API_MOCKS) {
    return startMockStream(handlers, meetingId);
  }

  const types = options.types ?? ["minutes", "transcript"];
  const sanitizedStreamBase = STREAM_BASE_URL.replace(/\/$/, "");
  const url = new URL(
    `${sanitizedStreamBase}/v1/meetings/${encodeURIComponent(
      meetingId
    )}/stream?userId=${encodeURIComponent(API_DEFAULT_USER_ID)}&types=${encodeURIComponent(
      types.join(",")
    )}`
  );

  const headers: Record<string, string> = {
    Accept: "text/event-stream",
  };

  if (API_AUTH_BEARER) {
    headers.Authorization = `Bearer ${API_AUTH_BEARER}`;
  }

  if (API_MEETING_BAAS_KEY) {
    headers["x-meeting-baas-api-key"] = API_MEETING_BAAS_KEY;
  }

  const controller = new AbortController();

  let isClosed = false;
  let buffer = "";

  void fetch(url.toString(), {
    headers,
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok || !response.body) {
        throw new Error(`Stream connection failed (${response.status})`);
      }

      handlers.onOpen?.();

      const reader = response.body.getReader();

      while (!isClosed) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          buffer += DECODER.decode(value, { stream: true });
          const lastSeparatorIndex = buffer.lastIndexOf("\n\n");
          if (lastSeparatorIndex !== -1) {
            const complete = buffer.slice(0, lastSeparatorIndex + 2);
            buffer = buffer.slice(lastSeparatorIndex + 2);
            parseSseChunk(complete, handlers);
          }
        }
      }

      if (buffer.length > 0) {
        parseSseChunk(buffer, handlers);
      }
    })
    .catch((error) => {
      if (!isClosed) {
        handlers.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    });

  return () => {
    isClosed = true;
    controller.abort();
  };
}
