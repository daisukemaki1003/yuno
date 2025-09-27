import type { MeetingBaasPort } from "./meetingbaas.client.port.js";
import type { MeetingId, BotId } from "./meetingbaas.client.types.js";
import type { MeetingBaasConfig } from "./meetingbaas.config.js";
import { HttpClient } from "./http.client.js";
import { Logger } from "@/utils/logger.js";
import { badRequest, internal, HttpError } from "@/utils/errors.js";
import { VendorAddBotResponseSchema } from "@/schemas/vendor/meetingbaas.v1.js";
import { env } from "@/configs/env.js";

/**
 * Create Meeting BaaS adapter with given configuration
 * @param cfg - Meeting BaaS configuration
 * @param apiKey - API key for authentication
 * @returns Meeting BaaS port implementation
 */
export function createMeetingBaasAdapter(cfg: MeetingBaasConfig, apiKey: string): MeetingBaasPort {
  return new MeetingBaasAdapterV1(cfg, apiKey);
}

/**
 * Meeting BaaS Adapter V1 implementation
 * Adapts vendor-specific API to our domain port interface
 */
class MeetingBaasAdapterV1 implements MeetingBaasPort {
  private config: MeetingBaasConfig;
  private apiKey: string;
  private http: HttpClient;
  private logger: Logger;

  constructor(config: MeetingBaasConfig, apiKey: string) {
    this.config = config;
    this.apiKey = apiKey;
    this.logger = new Logger("meeting-baas-adapter");
    this.http = new HttpClient(this.logger);
  }

  async addBot(meetingUrl: string, botName?: string): Promise<{ botId: BotId }> {
    const url = this.buildUrl(this.config.endpoints.addBot.path, {});
    const headers = this.buildHeaders();

    const meetingId = deriveMeetingId(meetingUrl);
    if (!meetingId) {
      this.logger.warn("Failed to derive meetingId from meetingUrl", { meetingUrl });
    }

    const streamingBase = meetingId
      ? `${env.PUBLIC_WS_BASE}/mb-input?meetingId=${encodeURIComponent(meetingId)}`
      : `${env.PUBLIC_WS_BASE}/mb-input`;

    const requestBody = {
      bot_name: botName || "Meeting Bot",
      meeting_url: meetingUrl,
      reserved: false,
      recording_mode: "speaker_view",
      entry_message: "I am a good meeting bot :)",
      speech_to_text: {
        provider: "Default",
      },
      automatic_leave: {
        waiting_room_timeout: 600,
      },
      streaming: {
        audio_frequency: "16khz", // Meeting BaaS uses "16khz", not sample_rate
        input: streamingBase,
        output: streamingBase, // Same endpoint for now
      },
    };

    try {
      const response = await this.http.fetchJson(url, {
        method: this.config.endpoints.addBot.method,
        headers,
        body: requestBody,
        timeoutMs: this.config.timeouts.requestMs,
      });

      const parsed = VendorAddBotResponseSchema.parse(response);
      return { botId: parsed.botId };
    } catch (err) {
      // If it's already an HttpError, just re-throw it
      if (err instanceof HttpError) {
        throw err;
      }
      this.logger.error("Failed to add bot", {
        meetingUrl,
        botName,
        error: err,
        requestBody,
        url,
        headers: Object.keys(headers).reduce((acc, key) => {
          const lowerKey = key.toLowerCase();
          if (
            lowerKey.includes("key") ||
            lowerKey.includes("authorization") ||
            lowerKey === "x-api-key"
          ) {
            acc[key] = "***";
          } else {
            acc[key] = headers[key];
          }
          return acc;
        }, {} as Record<string, string>),
      });
      throw this.mapError(err);
    }
  }

  async leaveBot(meetingId: MeetingId, botId: BotId): Promise<void> {
    const url = this.buildUrl(this.config.endpoints.leaveBot.path, { meetingId, botId });
    const headers = this.buildHeaders();

    try {
      await this.http.fetchJson(url, {
        method: this.config.endpoints.leaveBot.method,
        headers,
        // Don't send body for leaveBot
        timeoutMs: this.config.timeouts.requestMs,
      });
    } catch (err) {
      // If it's already an HttpError, just re-throw it
      if (err instanceof HttpError) {
        throw err;
      }
      this.logger.error("Failed to leave bot", { meetingId, botId, error: err });
      throw this.mapError(err);
    }
  }

  private buildUrl(pathTemplate: string, params: Record<string, string>): string {
    let path = pathTemplate;

    // Replace path parameters
    for (const [key, value] of Object.entries(params)) {
      path = path.replace(`:${key}`, encodeURIComponent(value));
    }

    // Build full URL
    const url = new URL(path, this.config.baseUrl);

    // Add auth to query if configured
    if (this.config.auth.queryParam) {
      url.searchParams.set(this.config.auth.queryParam, this.apiKey);
    }

    return url.toString();
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Add auth header (Meeting BaaS uses x-meeting-baas-api-key header)
    headers[this.config.auth.header] = this.apiKey;

    return headers;
  }

  private mapError(err: unknown): Error {
    if (err instanceof Error) {
      // Check if it's an HTTP error with details
      if ("details" in err && typeof err.details === "object" && err.details) {
        const details = err.details as { status?: number };
        if (details.status === 400) {
          return badRequest("VENDOR_ERROR", err.message, details);
        }
      }
      return err;
    }
    return internal("UNKNOWN_ERROR", "An unknown error occurred");
  }
}

function deriveMeetingId(meetingUrl: string): string | null {
  if (!meetingUrl) {
    return null;
  }

  try {
    const url = new URL(meetingUrl);
    const knownPattern = url.pathname.match(/[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}/i);
    if (knownPattern) {
      return knownPattern[0].toLowerCase();
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments.pop();
    return last ? last.toLowerCase() : null;
  } catch {
    const fallbackMatch = meetingUrl.match(/[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}/i);
    return fallbackMatch ? fallbackMatch[0].toLowerCase() : null;
  }
}
