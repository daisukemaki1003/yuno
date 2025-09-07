import type { MeetingBaasPort, RecordingStream } from './meetingbaas.client.port.js';
import type { MeetingId, BotId, BotStatus, RecordingFrame } from './meetingbaas.client.types.js';
import type { MeetingBaasConfig } from './meetingbaas.config.js';
import { HttpClient, SseStream, WsStream } from './http.client.js';
import { Logger } from '@/utils/logger.js';
import { badRequest, internal } from '@/utils/errors.js';
import {
  VendorAddBotResponseSchema,
  VendorBotStatusResponseSchema,
  parseVendorStreamEvent,
  VendorAudioEventSchema,
  VendorTranscriptEventSchema,
} from '@/schemas/vendor/meetingbaas.v1.js';
import { createParser } from 'eventsource-parser';

/**
 * Create Meeting BaaS adapter with given configuration
 * @param cfg - Meeting BaaS configuration
 * @param apiKey - API key for authentication
 * @returns Meeting BaaS port implementation
 */
export function createMeetingBaasAdapter(
  cfg: MeetingBaasConfig,
  apiKey: string
): MeetingBaasPort {
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
    this.logger = new Logger('meeting-baas-adapter');
    this.http = new HttpClient(this.logger);
  }

  async addBot(meetingId: MeetingId): Promise<{ botId: BotId }> {
    const url = this.buildUrl(this.config.endpoints.addBot.path, { meetingId });
    const headers = this.buildHeaders();

    try {
      const response = await this.http.fetchJson(url, {
        method: this.config.endpoints.addBot.method,
        headers,
        body: { meetingId },
        timeoutMs: this.config.timeouts.requestMs,
      });

      const parsed = VendorAddBotResponseSchema.parse(response);
      return { botId: parsed.botId };
    } catch (err) {
      this.logger.error('Failed to add bot', { meetingId, error: err });
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
        body: this.config.endpoints.leaveBot.method === 'POST' ? { meetingId } : undefined,
        timeoutMs: this.config.timeouts.requestMs,
      });
    } catch (err) {
      this.logger.error('Failed to leave bot', { meetingId, botId, error: err });
      throw this.mapError(err);
    }
  }

  async getBotStatus(botId: BotId): Promise<{ status: BotStatus }> {
    const url = this.buildUrl(this.config.endpoints.botStatus.path, { botId });
    const headers = this.buildHeaders();

    try {
      const response = await this.http.fetchJson(url, {
        method: this.config.endpoints.botStatus.method,
        headers,
        timeoutMs: this.config.timeouts.requestMs,
      });

      const parsed = VendorBotStatusResponseSchema.parse(response);
      const domainStatus = this.mapStatus(parsed.status);
      
      return { status: domainStatus };
    } catch (err) {
      this.logger.error('Failed to get bot status', { botId, error: err });
      throw this.mapError(err);
    }
  }

  async openRecordingStream(
    meetingId: MeetingId,
    opts?: { normalized?: boolean }
  ): Promise<RecordingStream> {
    const url = this.buildUrl(this.config.endpoints.stream.path, { meetingId });
    const headers = this.buildHeaders();
    const normalized = opts?.normalized ?? false;

    try {
      if (this.config.endpoints.stream.protocol === 'sse') {
        const stream = await this.http.openSse(url, headers, this.config.timeouts.streamMs);
        return this.createSseRecordingStream(stream, normalized);
      } else {
        const stream = await this.http.openWebSocket(url, headers);
        await stream.waitForOpen();
        return this.createWsRecordingStream(stream, normalized);
      }
    } catch (err) {
      this.logger.error('Failed to open recording stream', { meetingId, error: err });
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
      if (scheme === 'Bearer') {
        headers[this.config.auth.header] = `Bearer ${this.apiKey}`;
      } else if (scheme === 'ApiKey') {
        headers[this.config.auth.header] = `ApiKey ${this.apiKey}`;
      } else if (scheme === 'Basic') {
        headers[this.config.auth.header] = `Basic ${this.apiKey}`;
      } else if (scheme === 'None') {
        headers[this.config.auth.header] = this.apiKey;
      }
    }

    return headers;
  }

  private mapStatus(vendorStatus: string): BotStatus {
    const mapped = this.config.maps.status[vendorStatus];
    if (!mapped) {
      this.logger.warn('Unknown vendor status', { vendorStatus });
      return 'error';
    }
    return mapped;
  }

  private mapError(err: unknown): Error {
    if (err instanceof Error) {
      // Check if it's an HTTP error with details
      if ('details' in err && typeof err.details === 'object' && err.details) {
        const details = err.details as any;
        if (details.status === 400) {
          return badRequest('VENDOR_ERROR', err.message, details);
        }
      }
      return err;
    }
    return internal('UNKNOWN_ERROR', 'An unknown error occurred');
  }

  private createSseRecordingStream(
    stream: SseStream,
    normalized: boolean
  ): RecordingStream {
    const handlers = {
      data: new Set<(frame: RecordingFrame) => void>(),
      error: new Set<(err: Error) => void>(),
      close: new Set<() => void>(),
    };

    // SSE parser for handling event stream
    const parser = createParser({
      onEvent: (event) => {
        if (event.data) {
          try {
            const data = JSON.parse(event.data);
            const frame = this.parseStreamEvent(data, normalized);
            handlers.data.forEach(h => h(frame));
          } catch (err) {
            this.logger.error('Failed to parse SSE event', { error: err });
            handlers.error.forEach(h => h(err as Error));
          }
        }
      },
    });

    stream.on('data', (data) => parser.feed(data));
    stream.on('error', (err) => handlers.error.forEach(h => h(err)));
    stream.on('close', () => handlers.close.forEach(h => h()));

    return {
      close: () => stream.close(),
      onData: (cb) => { handlers.data.add(cb); },
      onError: (cb) => { handlers.error.add(cb); },
      onClose: (cb) => { handlers.close.add(cb); },
    };
  }

  private createWsRecordingStream(
    stream: WsStream,
    normalized: boolean
  ): RecordingStream {
    const handlers = {
      data: new Set<(frame: RecordingFrame) => void>(),
      error: new Set<(err: Error) => void>(),
      close: new Set<() => void>(),
    };

    stream.on('data', (data) => {
      try {
        const parsed = JSON.parse(data);
        const frame = this.parseStreamEvent(parsed, normalized);
        handlers.data.forEach(h => h(frame));
      } catch (err) {
        this.logger.error('Failed to parse WebSocket message', { error: err });
        handlers.error.forEach(h => h(err as Error));
      }
    });

    stream.on('error', (err) => handlers.error.forEach(h => h(err)));
    stream.on('close', () => handlers.close.forEach(h => h()));

    return {
      close: () => stream.close(),
      onData: (cb) => { handlers.data.add(cb); },
      onError: (cb) => { handlers.error.add(cb); },
      onClose: (cb) => { handlers.close.add(cb); },
    };
  }

  private parseStreamEvent(data: unknown, normalized: boolean): RecordingFrame {
    const { eventType, timestamp, raw } = parseVendorStreamEvent(
      data,
      this.config.maps.streamEvent
    );

    // In non-normalized mode, pass through as generic event
    if (!normalized) {
      return {
        kind: 'event',
        ts: timestamp,
        name: eventType,
        payload: raw,
        vendorRaw: raw,
      };
    }

    // In normalized mode, try to parse specific event types
    const maps = this.config.maps.streamEvent;
    
    // Check if it's an audio event
    if (eventType === 'audio' || eventType === 'audio_data') {
      try {
        const parsed = VendorAudioEventSchema.parse(raw);
        const audioData = parsed[maps?.audioField || 'audio'] || parsed.data;
        
        if (audioData) {
          // Convert audio data to Uint8Array
          let bytes: Uint8Array;
          if (typeof audioData === 'string') {
            // Base64 encoded
            bytes = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
          } else if (audioData instanceof ArrayBuffer) {
            bytes = new Uint8Array(audioData);
          } else if (audioData instanceof Uint8Array) {
            bytes = audioData;
          } else {
            // Unknown format, pass as event
            return {
              kind: 'event',
              ts: timestamp,
              name: eventType,
              payload: raw,
              vendorRaw: raw,
            };
          }

          return {
            kind: 'audio',
            ts: timestamp,
            bytes,
            codec: typeof parsed.codec === 'string' ? parsed.codec : undefined,
            vendorRaw: raw,
          };
        }
      } catch (err) {
        this.logger.warn('Failed to parse audio event', { error: err });
      }
    }

    // Check if it's a transcript event
    if (eventType === 'transcript' || eventType === 'transcription' || eventType === 'speech_to_text') {
      try {
        const parsed = VendorTranscriptEventSchema.parse(raw);
        const textFieldValue = parsed[maps?.textField || 'text'] || parsed.transcript;
        const text = typeof textFieldValue === 'string' ? textFieldValue : '';
        
        if (text) {
          return {
            kind: 'transcript',
            ts: timestamp,
            text,
            lang: typeof parsed.lang === 'string' ? parsed.lang : typeof parsed.language === 'string' ? parsed.language : undefined,
            isFinal: typeof parsed.is_final === 'boolean' ? parsed.is_final : typeof parsed.isFinal === 'boolean' ? parsed.isFinal : typeof parsed.final === 'boolean' ? parsed.final : undefined,
            vendorRaw: raw,
          };
        }
      } catch (err) {
        this.logger.warn('Failed to parse transcript event', { error: err });
      }
    }

    // Default: pass through as generic event
    return {
      kind: 'event',
      ts: timestamp,
      name: eventType,
      payload: raw,
      vendorRaw: raw,
    };
  }
}