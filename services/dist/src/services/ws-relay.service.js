import WebSocket from "ws";
import { env } from "@/configs/env.js";
import { HttpClient } from "@/clients/http.client.js";
const relaySessions = new Map();
// Event emitter for transcript events
import { EventEmitter } from "events";
export const transcriptEmitter = new EventEmitter();
/**
 * Initialize Gladia Live API session
 */
async function initializeGladiaSession(logger) {
    if (!env.GLADIA_API_KEY) {
        throw new Error("GLADIA_API_KEY is not configured");
    }
    try {
        logger.info("Initializing Gladia Live session");
        const httpClient = new HttpClient(logger);
        const response = await httpClient.post("https://api.gladia.io/v2/live", {
            encoding: "wav/pcm",
            sample_rate: 16000,
            bit_depth: 16,
            channels: 1,
        }, {
            headers: {
                "X-Gladia-Key": env.GLADIA_API_KEY,
                "Content-Type": "application/json",
            },
        });
        logger.info("Gladia session initialized", {
            sessionId: response.id,
            url: response.url,
        });
        return response;
    }
    catch (error) {
        logger.error("Failed to initialize Gladia session", { error });
        throw error;
    }
}
/**
 * Connect to Gladia WebSocket with retry logic
 */
async function connectToGladia(session) {
    const { logger } = session;
    // Initialize session if needed
    if (!session.gladiaUrl) {
        const gladiaSession = await initializeGladiaSession(logger);
        session.gladiaUrl = gladiaSession.url;
    }
    return new Promise((resolve, reject) => {
        logger.info("Connecting to Gladia WebSocket", { url: session.gladiaUrl });
        const ws = new WebSocket(session.gladiaUrl);
        const timeout = setTimeout(() => {
            ws.terminate();
            reject(new Error("Gladia connection timeout"));
        }, 30000);
        ws.on("open", () => {
            clearTimeout(timeout);
            logger.info("Connected to Gladia WebSocket");
            session.reconnectAttempts = 0;
            resolve(ws);
        });
        ws.on("error", (error) => {
            clearTimeout(timeout);
            logger.error("Gladia WebSocket error", { error });
            reject(error);
        });
        ws.on("close", (code, reason) => {
            logger.info("Gladia WebSocket closed", { code, reason: reason.toString() });
            session.gladiaWs = null;
            scheduleReconnect(session);
        });
        ws.on("message", (data) => {
            handleGladiaMessage(session, data);
        });
    });
}
/**
 * Handle messages from Gladia
 */
function handleGladiaMessage(session, data) {
    const { logger } = session;
    try {
        const message = JSON.parse(data.toString());
        if (message.type === "transcript" && message.data) {
            const { is_final, transcript, language, confidence } = message.data;
            logger.info("Received transcript", {
                isFinal: is_final,
                text: transcript,
                language,
                confidence,
                length: transcript?.length,
            });
            // Emit transcript event for SSE relay
            transcriptEmitter.emit("transcript", {
                meetingId: session.meetingId,
                type: "transcript",
                isFinal: is_final || false,
                text: transcript || "",
                language: language || "unknown",
                timestamp: new Date().toISOString(),
            });
        }
        else if (message.type === "error") {
            logger.error("Gladia error event", { message });
        }
    }
    catch (error) {
        logger.error("Failed to parse Gladia message", { error, data: data.toString() });
    }
}
/**
 * Schedule reconnection with exponential backoff
 */
function scheduleReconnect(session) {
    const { logger, reconnectAttempts } = session;
    if (session.reconnectTimer || session.isConnecting) {
        return;
    }
    const baseDelay = env.STREAM_RECONNECT_BASE_MS || 5000;
    const maxDelay = 60000; // 60 seconds
    const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts), maxDelay);
    logger.info("Scheduling Gladia reconnection", {
        attempt: reconnectAttempts + 1,
        delayMs: delay,
    });
    session.reconnectTimer = setTimeout(async () => {
        session.reconnectTimer = null;
        session.reconnectAttempts++;
        session.isConnecting = true;
        try {
            session.gladiaWs = await connectToGladia(session);
            session.isConnecting = false;
            // Process queued audio
            while (session.audioQueue.length > 0) {
                const chunk = session.audioQueue.shift();
                sendAudioToGladia(session, chunk);
            }
        }
        catch (error) {
            session.isConnecting = false;
            logger.error("Reconnection failed", { error });
            scheduleReconnect(session);
        }
    }, delay);
}
/**
 * Send audio to Gladia with backpressure handling
 */
function sendAudioToGladia(session, audioData) {
    const { gladiaWs, logger, audioQueue } = session;
    if (!gladiaWs || gladiaWs.readyState !== WebSocket.OPEN) {
        // Queue audio if not connected
        audioQueue.push(audioData);
        // Apply backpressure - drop old frames if queue is too large
        const maxBuffer = env.STREAM_BACKPRESSURE_MAX_BUFFER || 5242880; // 5MB
        let totalSize = audioQueue.reduce((sum, buf) => sum + buf.length, 0);
        while (totalSize > maxBuffer && audioQueue.length > 1) {
            const dropped = audioQueue.shift();
            totalSize -= dropped.length;
            logger.warn("Dropped audio frame due to backpressure", {
                droppedSize: dropped.length,
                queueSize: audioQueue.length,
                totalSize,
            });
        }
        return;
    }
    // Check WebSocket buffer
    if (gladiaWs.bufferedAmount > 1024 * 1024) {
        // 1MB threshold
        logger.warn("Gladia WebSocket buffer full, queuing audio", {
            bufferedAmount: gladiaWs.bufferedAmount,
            audioSize: audioData.length,
        });
        audioQueue.push(audioData);
        return;
    }
    try {
        gladiaWs.send(audioData);
        session.lastActivity = new Date();
        logger.debug("Sent audio to Gladia", {
            size: audioData.length,
            bufferedAmount: gladiaWs.bufferedAmount,
        });
    }
    catch (error) {
        logger.error("Failed to send audio to Gladia", { error });
        audioQueue.push(audioData);
    }
}
/**
 * Setup WebSocket relay for incoming MBaaS audio
 */
export async function setupWebSocketRelay(ws, logger) {
    const session = {
        mbWs: ws,
        gladiaWs: null,
        gladiaUrl: null,
        logger,
        reconnectTimer: null,
        reconnectAttempts: 0,
        audioQueue: [],
        isConnecting: false,
        lastActivity: new Date(),
    };
    relaySessions.set(ws, session);
    try {
        // Connect to Gladia
        session.isConnecting = true;
        session.gladiaWs = await connectToGladia(session);
        session.isConnecting = false;
    }
    catch (error) {
        logger.error("Initial Gladia connection failed", { error });
        scheduleReconnect(session);
    }
    // Handle incoming audio from MBaaS
    ws.on("message", (data) => {
        if (data instanceof Buffer) {
            logger.debug("Received audio from MBaaS", { size: data.length });
            sendAudioToGladia(session, data);
        }
        else {
            // Handle non-binary messages (e.g., control messages)
            try {
                const message = JSON.parse(data.toString());
                logger.info("Received control message from MBaaS", { message });
                // Extract meetingId if provided
                if (message.meetingId) {
                    session.meetingId = message.meetingId;
                }
            }
            catch (error) {
                logger.warn("Received non-JSON text message", { data: data.toString() });
            }
        }
    });
    // Handle MBaaS disconnection
    ws.on("close", (code, reason) => {
        logger.info("MBaaS WebSocket closed", { code, reason: reason.toString() });
        cleanupSession(session);
    });
    ws.on("error", (error) => {
        logger.error("MBaaS WebSocket error", { error });
    });
    // Send initial ready message
    ws.send(JSON.stringify({
        type: "ready",
        timestamp: new Date().toISOString(),
    }));
}
/**
 * Cleanup session resources
 */
function cleanupSession(session) {
    const { logger, gladiaWs, reconnectTimer } = session;
    logger.info("Cleaning up relay session");
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }
    if (gladiaWs && gladiaWs.readyState === WebSocket.OPEN) {
        gladiaWs.close();
    }
    relaySessions.delete(session.mbWs);
}
/**
 * Get active session statistics
 */
export function getRelayStats() {
    const stats = {
        activeSessions: relaySessions.size,
        sessions: [],
    };
    relaySessions.forEach((session, ws) => {
        stats.sessions.push({
            mbConnected: ws.readyState === WebSocket.OPEN,
            gladiaConnected: session.gladiaWs?.readyState === WebSocket.OPEN,
            queuedAudioFrames: session.audioQueue.length,
            reconnectAttempts: session.reconnectAttempts,
            lastActivity: session.lastActivity,
            meetingId: session.meetingId,
        });
    });
    return stats;
}
//# sourceMappingURL=ws-relay.service.js.map