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
    import("ws").then(({ WebSocketServer }) => {
      // Create HTTP server with Hono
      const server = serve({
        fetch: app.fetch,
        port: Number(PORT),
      });

      // Create WebSocket server without built-in HTTP server
      const wss = new WebSocketServer({ noServer: true });

      // Handle upgrade requests
      server.on("upgrade", (request, socket, head) => {
        const logger = new Logger(randomUUID());
        
        // Parse URL and check path
        const url = new URL(request.url || '/', `http://localhost:${PORT}`);
        
        // Only accept connections to /mb-input
        if (url.pathname === "/mb-input") {
          // Check authentication if configured
          if (env.WS_RELAY_AUTH_TOKEN) {
            const authToken = url.searchParams.get('auth') || request.headers['x-auth-token'];
            
            if (authToken !== env.WS_RELAY_AUTH_TOKEN) {
              logger.warn("WebSocket upgrade rejected - unauthorized", { 
                path: url.pathname,
                providedAuth: authToken ? '***' : 'none'
              });
              socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
              socket.destroy();
              return;
            }
          }
          
          logger.info("WebSocket upgrade request", { path: url.pathname });
          
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit("connection", ws, request);
          });
        } else {
          logger.warn("WebSocket upgrade rejected - invalid path", { path: url.pathname });
          socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
          socket.destroy();
        }
      });

      // Handle WebSocket connections
      wss.on("connection", async (ws, request) => {
        const logger = new Logger(randomUUID());
        logger.info("WebSocket client connected", { path: request.url });

        // Extract meetingId from query parameters if available
        const url = new URL(request.url || '/', `http://localhost:${PORT}`);
        const meetingId = url.searchParams.get('meetingId');

        // Import and initialize the WebSocket relay handler
        const { setupWebSocketRelay } = await import("@/services/ws-relay.service.js");
        await setupWebSocketRelay(ws, logger, meetingId || undefined);
      });

      const logger = new Logger(randomUUID());
      
      // Import transcript logger to show log file path
      import("@/utils/transcript-logger.js").then(({ transcriptLogger }) => {
        logger.info("Dev server started with WebSocket support", {
          port: Number(PORT),
          wsPath: "/mb-input",
          transcriptLogFile: transcriptLogger.getLogFilePath(),
          env: {
            PROJECT_ID: env.PROJECT_ID,
            REGION: env.REGION,
          },
        });
      });
    });
  });
}

// Export for Google Cloud Functions
export const helloGET = app.fetch;
