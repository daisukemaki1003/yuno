import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Transcript logger for saving transcripts to file
 */
export class TranscriptLogger {
  private logDir: string;
  private logFile: string;

  constructor() {
    // Create logs directory if it doesn't exist
    this.logDir = join(process.cwd(), 'logs');
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }

    // Create log file with timestamp
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    this.logFile = join(this.logDir, `transcripts-${timestamp}.jsonl`);
  }

  /**
   * Log transcript to file
   */
  logTranscript(data: {
    meetingId?: string;
    text: string;
    language: string;
    isFinal: boolean;
    confidence?: number;
    timestamp: string;
  }) {
    const logEntry = {
      ...data,
      loggedAt: new Date().toISOString(),
    };

    try {
      // Append as JSON Lines format (one JSON object per line)
      appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('Failed to write transcript to log file:', error);
    }
  }

  /**
   * Log error to file
   */
  logError(error: unknown, context?: unknown) {
    const logEntry = {
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
      context,
      timestamp: new Date().toISOString(),
    };

    try {
      appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
    } catch (err) {
      console.error('Failed to write error to log file:', err);
    }
  }

  /**
   * Get log file path
   */
  getLogFilePath(): string {
    return this.logFile;
  }
}

// Singleton instance
export const transcriptLogger = new TranscriptLogger();