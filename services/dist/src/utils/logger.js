// logger.ts
import { randomUUID } from "crypto";
import chalk from "chalk";
/**
 * Logger class for structured logging
 */
export class Logger {
    requestId;
    service;
    indent;
    color;
    constructor(requestId, opts = {}) {
        this.requestId = requestId;
        this.service = opts.service ?? "cloud-functions";
        // デフォルト方針: 開発は見やすさ優先、本番は機械可読優先
        const isProd = process.env.NODE_ENV === "production";
        this.indent = typeof opts.indent === "number" ? opts.indent : isProd ? 0 : 2;
        this.color = typeof opts.color === "boolean" ? opts.color : !isProd;
    }
    /**
     * Create a logger instance for a specific request (Hono/Request 両対応)
     */
    static withRequest(ctx, opts) {
        let requestId;
        if ("req" in ctx) {
            // Hono context
            requestId = ctx.req.header("X-Request-Id") || undefined;
        }
        else if (ctx instanceof Request) {
            // Standard Request object
            requestId = ctx.headers.get("X-Request-Id") || undefined;
        }
        return new Logger(requestId || randomUUID(), opts);
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
        // pretty-print
        const json = JSON.stringify(entry, null, this.indent);
        // levelごとの色分け（開発時のみ既定で有効）
        const colored = this.color ? this.colorize(level, json) : json;
        switch (level) {
            case "error":
                console.error(colored);
                break;
            case "warn":
                console.warn(colored);
                break;
            case "debug":
                console.debug(colored);
                break;
            default:
                console.log(colored);
        }
    }
    colorize(level, text) {
        switch (level) {
            case "error":
                return chalk.red(text); // 赤
            case "warn":
                return chalk.yellow(text); // 黄
            case "debug":
                return chalk.gray(text); // グレー
            case "info":
            default:
                return chalk.blue(text); // 青
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
 * - 開発: indent=2, color=true
 * - 本番: indent=0, color=false
 */
export const log = new Logger(randomUUID());
//# sourceMappingURL=logger.js.map