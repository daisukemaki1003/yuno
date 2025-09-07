import { randomUUID } from "crypto";
import type { Context } from "hono";

/**
 * Log levels
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Log metadata type
 */
export interface LogMeta {
  [key: string]: unknown;
}

/**
 * Structured log entry
 */
export interface LogEntry {
  level: LogLevel;
  msg: string;
  requestId: string;
  service: string;
  timestamp: string;
  meta?: LogMeta;
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private requestId: string;
  private service: string;

  constructor(requestId: string, service = "cloud-functions") {
    this.requestId = requestId;
    this.service = service;
  }

  /**
   * Create a logger instance for a specific request
   */
  static withRequest(ctx: Context | Request): Logger {
    let requestId: string | undefined;

    if ("req" in ctx) {
      // Hono context
      requestId = ctx.req.header("X-Request-Id");
    } else if (ctx instanceof Request) {
      // Standard Request object
      requestId = ctx.headers.get("X-Request-Id") || undefined;
    }

    return new Logger(requestId || randomUUID());
  }

  /**
   * Output structured log entry
   */
  private log(level: LogLevel, msg: string, meta?: LogMeta): void {
    const entry: LogEntry = {
      level,
      msg,
      requestId: this.requestId,
      service: this.service,
      timestamp: new Date().toISOString(),
      ...(meta && { meta }),
    };

    // Use appropriate console method based on level
    const output = JSON.stringify(entry);
    switch (level) {
      case "error":
        console.error(output);
        break;
      case "warn":
        console.warn(output);
        break;
      case "debug":
        console.debug(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(msg: string, meta?: LogMeta): void {
    this.log("debug", msg, meta);
  }

  info(msg: string, meta?: LogMeta): void {
    this.log("info", msg, meta);
  }

  warn(msg: string, meta?: LogMeta): void {
    this.log("warn", msg, meta);
  }

  error(msg: string, meta?: LogMeta): void {
    this.log("error", msg, meta);
  }
}

/**
 * Default logger instance
 */
export const log = new Logger(randomUUID());
