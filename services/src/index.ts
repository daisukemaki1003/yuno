import { Hono } from "hono";
import { randomUUID } from "crypto";
import { env } from "@/configs/env.js";
import { Logger } from "@/utils/logger.js";
import { errorHandler, notFound } from "@/utils/errors.js";
import { router } from "@/routes/_router.js";
import v1Router from "@/routes/v1.router.js";

// Define context variables type
type Variables = {
  requestId: string;
  logger: Logger;
  meetingBaasApiKey?: string;
};

// Create Hono app with typed variables
export const app = new Hono<{ Variables: Variables }>();

// Request ID middleware - must be first
app.use("*", async (c, next) => {
  const requestId = c.req.header("X-Request-Id") || randomUUID();
  c.set("requestId", requestId);
  c.set("logger", new Logger(requestId));

  // Set request ID in response header
  c.header("X-Request-Id", requestId);

  await next();
});

// Access log middleware
app.use("*", async (c, next) => {
  const logger = c.get("logger");
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  logger.info("HTTP request", {
    method,
    path,
    status,
    duration_ms: duration,
  });
});

// Mount main router
app.route("/", router);

// Mount v1 API routes
app.route("/v1", v1Router);

// 404 handler
app.notFound(() => {
  throw notFound("NOT_FOUND", "Not Found");
});

// Error handler
app.onError(errorHandler);

// Local development server
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;

  import("@hono/node-server").then(({ serve }) => {
    serve({
      fetch: app.fetch,
      port: Number(PORT),
    });

    const logger = new Logger(randomUUID());
    logger.info("Dev server started", {
      port: Number(PORT),
      env: {
        PROJECT_ID: env.PROJECT_ID,
        REGION: env.REGION,
      },
    });
  });
}

// Export for Google Cloud Functions
export const helloGET = app.fetch;
