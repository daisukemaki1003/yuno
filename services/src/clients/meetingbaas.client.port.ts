/**
 * Meeting BaaS Port Interface
 * This is the stable interface that domain/application layer depends on
 * Vendor implementations should adapt to this interface
 */

import type { MeetingId, BotId, BotStatus, RecordingFrame } from './meetingbaas.client.types.js';

/**
 * Recording stream interface for real-time data
 */
export interface RecordingStream {
  /**
   * Close the stream
   */
  close(): void;

  /**
   * Register callback for incoming data frames
   */
  onData(cb: (frame: RecordingFrame) => void): void;

  /**
   * Register callback for errors
   */
  onError(cb: (err: Error) => void): void;

  /**
   * Register callback for stream closure
   */
  onClose(cb: () => void): void;
}

/**
 * Meeting BaaS Port - stable interface for bot operations
 */
export interface MeetingBaasPort {
  /**
   * Add a bot to a meeting
   * @param meetingUrl - The meeting URL to join
   * @param botName - The name of the bot
   * @returns Bot identifier
   */
  addBot(meetingUrl: string, botName?: string): Promise<{ botId: BotId }>;

  /**
   * Remove a bot from a meeting
   * @param meetingId - The meeting identifier
   * @param botId - The bot to remove
   */
  leaveBot(meetingId: MeetingId, botId: BotId): Promise<void>;

  /**
   * Get bot status
   * @param botId - The bot identifier
   * @returns Current bot status
   */
  getBotStatus(botId: BotId): Promise<{ status: BotStatus }>;

  /**
   * Open a recording stream for a meeting
   * @param meetingId - The meeting to stream
   * @param opts - Stream options
   * @param opts.normalized - If true, normalize vendor events to standard format
   * @returns Recording stream interface
   */
  openRecordingStream(
    meetingId: MeetingId, 
    opts?: { normalized?: boolean }
  ): Promise<RecordingStream>;
}