import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

import type { Delta30s } from "@/domain/minutes/delta30s.schema.js";
import type { SectionUpdateResponse } from "@/domain/minutes/index.js";

interface MeetingLogFiles {
  dir: string;
  transcriptPath: string;
  deltaPath: string;
  sectionsPath: string;
}

interface TranscriptLogPayload {
  text: string;
  language: string;
  isFinal: boolean;
  confidence?: number;
  timestamp: string;
}

interface DeltaLogPayload {
  window: {
    start: string;
    end: string;
  };
  delta: Delta30s;
  digestHash?: string;
}

export class MinutesLogWriter {
  private readonly rootDir: string;
  private readonly meetingFiles = new Map<string, MeetingLogFiles>();

  constructor() {
    this.rootDir = join(process.cwd(), "logs");
    if (!existsSync(this.rootDir)) {
      mkdirSync(this.rootDir, { recursive: true });
    }
  }

  logTranscript(meetingId: string, payload: TranscriptLogPayload): void {
    const files = this.ensureMeetingFiles(meetingId, new Date(payload.timestamp));
    this.appendJson(files.transcriptPath, {
      type: "transcript",
      meetingId,
      ...payload,
      loggedAt: new Date().toISOString(),
    });
  }

  logDelta(meetingId: string, payload: DeltaLogPayload): void {
    const files = this.ensureMeetingFiles(meetingId, new Date(payload.window.end));
    this.appendJson(files.deltaPath, {
      type: "delta30s",
      meetingId,
      ...payload,
      loggedAt: new Date().toISOString(),
    });
  }

  logSectionUpdate(meetingId: string, payload: SectionUpdateResponse): void {
    const files = this.ensureMeetingFiles(meetingId);
    this.appendJson(files.sectionsPath, {
      type: "sections",
      meetingId,
      update: payload,
      loggedAt: new Date().toISOString(),
    });
  }

  getRootDir(): string {
    return this.rootDir;
  }

  private ensureMeetingFiles(meetingId: string, seed?: Date): MeetingLogFiles {
    let files = this.meetingFiles.get(meetingId);
    if (files) {
      return files;
    }

    const timestamp = this.formatTimestamp(seed ?? new Date());
    const dir = join(this.rootDir, timestamp);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const safeMeetingId = this.sanitize(meetingId);

    files = {
      dir,
      transcriptPath: join(dir, `${safeMeetingId}-transcript.jsonl`),
      deltaPath: join(dir, `${safeMeetingId}-delta.jsonl`),
      sectionsPath: join(dir, `${safeMeetingId}-sections.jsonl`),
    };

    this.meetingFiles.set(meetingId, files);
    return files;
  }

  private appendJson(path: string, value: unknown): void {
    try {
      appendFileSync(path, `${JSON.stringify(value)}\n`);
    } catch (error) {
      console.error("Failed to write minutes log", { path, error });
    }
  }

  private formatTimestamp(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}_${hours}${minutes}`;
  }

  private sanitize(meetingId: string): string {
    return meetingId.replace(/[^a-zA-Z0-9-_]/g, "_");
  }
}

export const minutesLogWriter = new MinutesLogWriter();
