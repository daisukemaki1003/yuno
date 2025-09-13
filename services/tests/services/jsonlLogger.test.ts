// Jest globals are available without import
import { readFileSync, existsSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { TranscriptLogger } from "../../src/utils/transcript-logger.js";
import { useTempDir } from "../utils/tmp-dir.js";

describe("JSONL Logger", () => {
  const tempDir = useTempDir("jsonl-logger");
  let logger: TranscriptLogger;
  let originalCwd: string;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    // Save original cwd
    originalCwd = process.cwd();

    // Mock process.cwd to return temp directory
    jest.spyOn(process, "cwd").mockReturnValue(tempDir.path);

    // Spy on console.error
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    // Create new logger instance (it will use mocked cwd)
    logger = new TranscriptLogger();
  });

  afterEach(() => {
    // Restore original cwd
    jest.spyOn(process, "cwd").mockReturnValue(originalCwd);
    jest.restoreAllMocks();
  });

  describe("File Creation", () => {
    it("should create logs directory if it does not exist", () => {
      const logsDir = join(tempDir.path, "logs");
      expect(existsSync(logsDir)).toBe(true);
    });

    it("should create log file with correct date format", () => {
      const today = new Date().toISOString().split("T")[0];
      const expectedFile = join(tempDir.path, "logs", `transcripts-${today}.jsonl`);

      expect(logger.getLogFilePath()).toBe(expectedFile);
    });
  });

  describe("Transcript Logging", () => {
    it("should append transcript as single JSON line", () => {
      const transcript = {
        meetingId: "meeting-123",
        text: "Hello world",
        language: "en",
        isFinal: true,
        confidence: 0.95,
        timestamp: "2025-09-13T04:54:30.000Z",
      };

      logger.logTranscript(transcript);

      const logContent = readFileSync(logger.getLogFilePath(), "utf-8");
      const lines = logContent.trim().split("\n");

      expect(lines).toHaveLength(1);

      const logEntry = JSON.parse(lines[0]);
      expect(logEntry).toMatchObject({
        ...transcript,
        loggedAt: expect.any(String),
      });
    });

    it("should append multiple transcripts as separate lines", () => {
      const transcripts = [
        {
          text: " してたらなんか固い",
          language: "ja",
          isFinal: true,
          confidence: 0.316,
          timestamp: "2025-09-13T04:54:11.749Z",
        },
        {
          text: " に入ると思うと",
          language: "ja",
          isFinal: true,
          confidence: 0.386,
          timestamp: "2025-09-13T04:54:12.149Z",
        },
        {
          text: " ご視",
          language: "ja",
          isFinal: true,
          confidence: 0.04,
          timestamp: "2025-09-13T04:54:26.937Z",
        },
      ];

      transcripts.forEach((t) => logger.logTranscript(t));

      const logContent = readFileSync(logger.getLogFilePath(), "utf-8");
      const lines = logContent.trim().split("\n");

      expect(lines).toHaveLength(3);

      lines.forEach((line, index) => {
        const logEntry = JSON.parse(line);
        expect(logEntry).toMatchObject({
          ...transcripts[index],
          loggedAt: expect.any(String),
        });
      });
    });

    it("should preserve all required fields", () => {
      const transcript = {
        meetingId: "meeting-456",
        text: "Test transcript",
        language: "en",
        isFinal: false,
        confidence: 0.75,
        timestamp: new Date().toISOString(),
      };

      logger.logTranscript(transcript);

      const logContent = readFileSync(logger.getLogFilePath(), "utf-8");
      const logEntry = JSON.parse(logContent.trim());

      expect(logEntry).toHaveProperty("meetingId", "meeting-456");
      expect(logEntry).toHaveProperty("text", "Test transcript");
      expect(logEntry).toHaveProperty("language", "en");
      expect(logEntry).toHaveProperty("isFinal", false);
      expect(logEntry).toHaveProperty("confidence", 0.75);
      expect(logEntry).toHaveProperty("timestamp");
      expect(logEntry).toHaveProperty("loggedAt");
    });

    it("should add loggedAt timestamp", () => {
      const beforeLog = new Date();

      logger.logTranscript({
        text: "Test",
        language: "en",
        isFinal: true,
        timestamp: "2025-01-01T00:00:00.000Z",
      });

      const afterLog = new Date();

      const logContent = readFileSync(logger.getLogFilePath(), "utf-8");
      const logEntry = JSON.parse(logContent.trim());

      const loggedAt = new Date(logEntry.loggedAt);
      expect(loggedAt.getTime()).toBeGreaterThanOrEqual(beforeLog.getTime());
      expect(loggedAt.getTime()).toBeLessThanOrEqual(afterLog.getTime());
    });

    it("should handle missing optional fields", () => {
      logger.logTranscript({
        text: "Minimal transcript",
        language: "unknown",
        isFinal: true,
        timestamp: new Date().toISOString(),
      });

      const logContent = readFileSync(logger.getLogFilePath(), "utf-8");
      const logEntry = JSON.parse(logContent.trim());

      expect(logEntry.meetingId).toBeUndefined();
      expect(logEntry.confidence).toBeUndefined();
    });
  });

  describe("Error Logging", () => {
    it("should log errors with context", () => {
      const error = {
        message: "Test error",
        code: "TEST_ERROR",
      };

      const context = {
        meetingId: "meeting-789",
        action: "transcript",
      };

      logger.logError(error, context);

      const logContent = readFileSync(logger.getLogFilePath(), "utf-8");
      const logEntry = JSON.parse(logContent.trim());

      expect(logEntry).toMatchObject({
        type: "error",
        error: "Test error",
        context: context,
        timestamp: expect.any(String),
      });
    });

    it("should handle Error objects", () => {
      const error = new Error("Something went wrong");

      logger.logError(error);

      const logContent = readFileSync(logger.getLogFilePath(), "utf-8");
      const logEntry = JSON.parse(logContent.trim());

      expect(logEntry).toMatchObject({
        type: "error",
        error: "Something went wrong",
        timestamp: expect.any(String),
      });
    });
  });

  describe("File I/O Error Handling", () => {
    it("should handle write errors gracefully", () => {
      // Make the log file read-only to cause write error
      const logPath = logger.getLogFilePath();

      // Create the file first
      logger.logTranscript({
        text: "Initial",
        language: "en",
        isFinal: true,
        timestamp: new Date().toISOString(),
      });

      // Mock appendFileSync to throw error
      const fs = require("fs");
      jest.spyOn(fs, "appendFileSync").mockImplementationOnce(() => {
        throw new Error("Permission denied");
      });

      // Should not throw
      expect(() => {
        logger.logTranscript({
          text: "This will fail",
          language: "en",
          isFinal: true,
          timestamp: new Date().toISOString(),
        });
      }).not.toThrow();

      // Should log to console.error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to write transcript to log file:",
        expect.any(Error)
      );
    });

    it("should handle error log write failures", () => {
      const fs = require("fs");
      jest.spyOn(fs, "appendFileSync").mockImplementationOnce(() => {
        throw new Error("Disk full");
      });

      expect(() => {
        logger.logError(new Error("Test error"));
      }).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to write error to log file:",
        expect.any(Error)
      );
    });
  });

  describe("JSONL Format Validation", () => {
    it("should produce valid JSONL format", () => {
      const transcripts = [
        { text: "First line", language: "en", isFinal: true, timestamp: new Date().toISOString() },
        {
          text: "Second line",
          language: "en",
          isFinal: false,
          timestamp: new Date().toISOString(),
        },
        { text: "Third line", language: "en", isFinal: true, timestamp: new Date().toISOString() },
      ];

      transcripts.forEach((t) => logger.logTranscript(t));

      const logContent = readFileSync(logger.getLogFilePath(), "utf-8");
      const lines = logContent.trim().split("\n");

      // Each line should be valid JSON
      lines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow();
      });

      // Should not have any JSON array structure
      expect(logContent).not.toContain("[");
      expect(logContent).not.toContain("]");
    });

    it("should handle special characters in text", () => {
      const specialTexts = [
        'Text with "quotes"',
        "Text with \n newline",
        "Text with \t tab",
        "Text with \\ backslash",
        "Text with unicode 😀 emoji",
      ];

      specialTexts.forEach((text) => {
        logger.logTranscript({
          text,
          language: "en",
          isFinal: true,
          timestamp: new Date().toISOString(),
        });
      });

      const logContent = readFileSync(logger.getLogFilePath(), "utf-8");
      const lines = logContent.trim().split("\n");

      expect(lines).toHaveLength(specialTexts.length);

      lines.forEach((line, index) => {
        const logEntry = JSON.parse(line);
        expect(logEntry.text).toBe(specialTexts[index]);
      });
    });
  });

  describe("Fixture Data", () => {
    it("should handle real transcript samples", () => {
      const fixtures = [
        {
          text: " してたらなんか固い",
          language: "ja",
          isFinal: true,
          confidence: 0.31666666666666665,
          timestamp: "2025-09-13T04:54:11.749Z",
        },
        {
          text: " に入ると思うと",
          language: "ja",
          isFinal: true,
          confidence: 0.386,
          timestamp: "2025-09-13T04:54:12.149Z",
        },
        {
          text: " ご視",
          language: "ja",
          isFinal: true,
          confidence: 0.04,
          timestamp: "2025-09-13T04:54:26.937Z",
        },
      ];

      fixtures.forEach((fixture) => logger.logTranscript(fixture));

      const logContent = readFileSync(logger.getLogFilePath(), "utf-8");
      const lines = logContent.trim().split("\n");

      expect(lines).toHaveLength(fixtures.length);

      lines.forEach((line, index) => {
        const logEntry = JSON.parse(line);
        expect(logEntry).toMatchObject({
          ...fixtures[index],
          loggedAt: expect.any(String),
        });
      });
    });
  });
});
