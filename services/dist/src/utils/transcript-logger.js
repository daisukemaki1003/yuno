import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
/**
 * Transcript logger for saving transcripts to file
 */
export class TranscriptLogger {
    logDir;
    logFile;
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
    logTranscript(data) {
        const logEntry = {
            ...data,
            loggedAt: new Date().toISOString(),
        };
        try {
            // Append as JSON Lines format (one JSON object per line)
            appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
        }
        catch (error) {
            console.error('Failed to write transcript to log file:', error);
        }
    }
    /**
     * Log error to file
     */
    logError(error, context) {
        const logEntry = {
            type: 'error',
            error: error.message || error,
            context,
            timestamp: new Date().toISOString(),
        };
        try {
            appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
        }
        catch (err) {
            console.error('Failed to write error to log file:', err);
        }
    }
    /**
     * Get log file path
     */
    getLogFilePath() {
        return this.logFile;
    }
}
// Singleton instance
export const transcriptLogger = new TranscriptLogger();
//# sourceMappingURL=transcript-logger.js.map