import type { MeetingBaasPort } from "./meetingbaas.client.port.js";
import type { MeetingId, BotId } from "./meetingbaas.client.types.js";
import type { MeetingBaasConfig } from "./meetingbaas.config.js";
import { HttpClient } from "./http.client.js";
import { Logger } from "@/utils/logger.js";
import { badRequest, internal } from "@/utils/errors.js";
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

    const requestBody = {
      bot_name: botName || "Meeting Bot",
      meeting_url: meetingUrl,
      reserved: false,
      recording_mode: "speaker_view",
      entry_message: "I am a good meeting bot :)",
      automatic_leave: {
        waiting_room_timeout: 600,
      },
      streaming: {
        audio_frequency: "16khz",
        input: `${env.PUBLIC_WS_BASE}/mb-input`,
        output: null,
        // output: `${env.PUBLIC_WS_BASE}/mb-input`,
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
      this.logger.error("Failed to add bot", {
        meetingUrl,
        botName,
        error: err,
        requestBody,
        url,
        headers: Object.keys(headers).reduce((acc, key) => {
          acc[key] = key.toLowerCase().includes("key") ? "***" : headers[key];
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
        body: this.config.endpoints.leaveBot.method === "POST" ? { meetingId } : undefined,
        timeoutMs: this.config.timeouts.requestMs,
      });
    } catch (err) {
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
    const headers: Record<string, string> = {};

    // Add auth header if not using query param
    if (!this.config.auth.queryParam) {
      const scheme = this.config.auth.scheme;
      if (scheme === "Bearer") {
        headers[this.config.auth.header] = `Bearer ${this.apiKey}`;
      } else if (scheme === "ApiKey") {
        headers[this.config.auth.header] = `ApiKey ${this.apiKey}`;
      } else if (scheme === "Basic") {
        headers[this.config.auth.header] = `Basic ${this.apiKey}`;
      } else if (scheme === "None") {
        headers[this.config.auth.header] = this.apiKey;
      }
    }

    return headers;
  }

  private mapError(err: unknown): Error {
    if (err instanceof Error) {
      // Check if it's an HTTP error with details
      if ("details" in err && typeof err.details === "object" && err.details) {
        const details = err.details as any;
        if (details.status === 400) {
          return badRequest("VENDOR_ERROR", err.message, details);
        }
      }
      return err;
    }
    return internal("UNKNOWN_ERROR", "An unknown error occurred");
  }
}
