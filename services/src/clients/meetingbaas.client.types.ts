/**
 * Domain types for Meeting BaaS
 * These types are vendor-agnostic and represent our domain model
 */

/**
 * Meeting identifier
 */
export type MeetingId = string;

/**
 * Bot identifier
 */
export type BotId = string;

/**
 * Bot status in our domain model
 */
export type BotStatus = 'joining' | 'joined' | 'leaving' | 'left' | 'error';

/**
 * Recording frame types representing different data from the meeting
 */
export type RecordingFrame =
  | { kind: 'audio'; ts: number; codec?: string; bytes: Uint8Array; vendorRaw?: unknown }
  | { kind: 'transcript'; ts: number; text: string; lang?: string; isFinal?: boolean; vendorRaw?: unknown }
  | { kind: 'event'; ts: number; name: string; payload?: unknown; vendorRaw?: unknown };