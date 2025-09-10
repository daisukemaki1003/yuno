import { z } from 'zod';

/**
 * Domain schemas for bot-related entities
 * These are minimal and stable schemas representing our domain
 */

/**
 * Bot status enum schema
 */
export const BotStatusSchema = z.enum([
  'joining',
  'joined', 
  'leaving',
  'left',
  'error'
]);

/**
 * Meeting ID schema
 */
export const MeetingIdSchema = z.string().min(1);

/**
 * Bot ID schema
 */
export const BotIdSchema = z.string().min(1);

/**
 * Audio frame schema
 */
export const AudioFrameSchema = z.object({
  kind: z.literal('audio'),
  ts: z.number(),
  codec: z.string().optional(),
  bytes: z.instanceof(Uint8Array),
  vendorRaw: z.unknown().optional(),
});

/**
 * Transcript frame schema
 */
export const TranscriptFrameSchema = z.object({
  kind: z.literal('transcript'),
  ts: z.number(),
  text: z.string(),
  lang: z.string().optional(),
  isFinal: z.boolean().optional(),
  vendorRaw: z.unknown().optional(),
});

/**
 * Event frame schema
 */
export const EventFrameSchema = z.object({
  kind: z.literal('event'),
  ts: z.number(),
  name: z.string(),
  payload: z.unknown().optional(),
  vendorRaw: z.unknown().optional(),
});

/**
 * Recording frame union schema
 */
export const RecordingFrameSchema = z.discriminatedUnion('kind', [
  AudioFrameSchema,
  TranscriptFrameSchema,
  EventFrameSchema,
]);