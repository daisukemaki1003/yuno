import { randomUUID } from "crypto";
/**
 * Logger class for structured logging
 */
export class Logger {
    requestId;
    service;
    constructor(requestId, service = "cloud-functions") {
        this.requestId = requestId;
        this.service = service;
    }
    /**
     * Create a logger instance for a specific request
     */
    static withRequest(ctx) {
        let requestId;
        if ("req" in ctx) {
            // Hono context
            requestId = ctx.req.header("X-Request-Id");
        }
        else if (ctx instanceof Request) {
            // Standard Request object
            requestId = ctx.headers.get("X-Request-Id") || undefined;
        }
        return new Logger(requestId || randomUUID());
    }
    /**
     * Output structured log entry
     */
    log(level, msg, meta) {
        const entry = {
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
    debug(msg, meta) {
        this.log("debug", msg, meta);
    }
    info(msg, meta) {
        this.log("info", msg, meta);
    }
    warn(msg, meta) {
        this.log("warn", msg, meta);
    }
    error(msg, meta) {
        this.log("error", msg, meta);
    }
}
/**
 * Default logger instance
 */
export const log = new Logger(randomUUID());
//# sourceMappingURL=logger.js.map