import WebSocket from "ws";
import { env } from "@/configs/env.js";
import { HttpClient } from "@/clients/http.client.js";
const relaySessions = new Map();
const meetingIdToSession = new Map();
let globalGeneration = 0;
/**
 * Mask sensitive tokens in URLs
 */
function maskToken(url) {
    try {
        const u = new URL(url);
        if (u.searchParams.has('token')) {
            u.searchParams.set('token', '***');
        }
        return u.toString();
    }
    catch {
        return url;
    }
}
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
            channels: 1
        }, {
            headers: {
                "X-Gladia-Key": env.GLADIA_API_KEY,
                "Content-Type": "application/json",
            },
        });
        logger.info("Gladia session initialized", {
            sessionId: response.id,
            url: maskToken(response.url)
        });
        // URLが正しい形式かチェック
        if (!response.url || !response.url.startsWith('wss://')) {
            throw new Error(`Invalid Gladia WebSocket URL: ${response.url}`);
        }
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
    // Always initialize a new session (tokens are single-use)
    const gladiaSession = await initializeGladiaSession(logger);
    session.gladiaUrl = gladiaSession.url;
    // Increment generation for this connection attempt
    const myGeneration = ++globalGeneration;
    session.generation = myGeneration;
    return new Promise((resolve, reject) => {
        logger.info("Connecting to Gladia WebSocket", { url: maskToken(session.gladiaUrl) });
        const ws = new WebSocket(session.gladiaUrl, {
            perMessageDeflate: false,
            handshakeTimeout: 10000
        });
        const timeout = setTimeout(() => {
            ws.terminate();
            reject(new Error("Gladia connection timeout"));
        }, 30000);
        ws.on("open", () => {
            clearTimeout(timeout);
            logger.info("Connected to Gladia WebSocket");
            session.reconnectAttempts = 0;
            // Send config message if enabled
            if (env.GLADIA_SEND_WS_CONFIG) {
                const configMsg = {
                    type: "config",
                    encoding: "pcm_s16le",
                    sample_rate: 16000,
                    channels: 1
                };
                ws.send(JSON.stringify(configMsg));
                logger.info("Sent config message to Gladia", { config: configMsg });
            }
            // Setup keep-alive ping
            session.keepAliveTimer = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.ping();
                    logger.debug("Sent ping to Gladia");
                }
            }, 20000); // 20 seconds
            ws.on("pong", () => {
                session.lastActivity = new Date();
                logger.debug("Received pong from Gladia");
            });
            resolve(ws);
        });
        ws.on("error", (error) => {
            clearTimeout(timeout);
            logger.error("Gladia WebSocket error", {
                error: error.message || error,
                url: maskToken(session.gladiaUrl || '')
            });
            reject(error);
        });
        // Handle unexpected-response (403, etc.)
        ws.on("unexpected-response", (request, response) => {
            clearTimeout(timeout);
            logger.error("Gladia WebSocket unexpected response", {
                statusCode: response.statusCode,
                statusMessage: response.statusMessage,
                headers: response.headers,
                url: maskToken(session.gladiaUrl || '')
            });
            ws.terminate();
            reject(new Error(`WebSocket handshake failed: ${response.statusCode} ${response.statusMessage}`));
        });
        ws.on("close", (code, reason) => {
            logger.info("Gladia WebSocket closed", {
                code,
                reason: reason.toString(),
                url: maskToken(session.gladiaUrl || '')
            });
            if (session.keepAliveTimer) {
                clearInterval(session.keepAliveTimer);
                session.keepAliveTimer = undefined;
            }
            if (myGeneration === session.generation) {
                session.gladiaWs = null;
                scheduleReconnect(session);
            }
        });
        ws.on("message", (data) => {
            if (myGeneration === session.generation) {
                handleGladiaMessage(session, data);
            }
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
            // Handle both old and new Gladia response formats
            let text;
            let language;
            let isFinal = false;
            let confidence;
            if (message.data.utterance) {
                // New format with utterance object
                text = message.data.utterance.text;
                language = message.data.utterance.language;
                confidence = message.data.utterance.confidence;
                isFinal = message.data.is_final || false;
            }
            else {
                // Old format with direct fields
                text = message.data.transcript;
                language = message.data.language;
                confidence = message.data.confidence;
                isFinal = message.data.is_final || false;
            }
            logger.info("Received transcript", {
                isFinal,
                text,
                language,
                confidence,
                length: text?.length,
            });
            // Emit transcript event for SSE relay with normalized schema
            transcriptEmitter.emit("transcript", {
                meetingId: session.meetingId,
                type: "transcript",
                isFinal,
                text: text || "",
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
                session.audioQueueBytes -= chunk.length;
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
        session.audioQueueBytes += audioData.length;
        // Apply backpressure - drop old frames if queue is too large
        const maxBuffer = env.STREAM_BACKPRESSURE_MAX_BUFFER || 5242880; // 5MB
        while (session.audioQueueBytes > maxBuffer && audioQueue.length > 1) {
            const dropped = audioQueue.shift();
            session.audioQueueBytes -= dropped.length;
            logger.warn("Dropped audio frame due to backpressure", {
                droppedSize: dropped.length,
                queueSize: audioQueue.length,
                totalSize: session.audioQueueBytes,
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
        session.audioQueueBytes += audioData.length;
    }
}
/**
 * Setup WebSocket relay for incoming MBaaS audio
 */
export async function setupWebSocketRelay(ws, logger, meetingId) {
    // Check if meetingId already has an active session
    if (meetingId && meetingIdToSession.has(meetingId)) {
        const existingSession = meetingIdToSession.get(meetingId);
        if (existingSession.mbWs.readyState === WebSocket.OPEN) {
            logger.warn("Meeting already has an active session", { meetingId });
            ws.close(1008, "Meeting already has an active session");
            return;
        }
        else {
            // Clean up stale session
            cleanupSession(existingSession);
        }
    }
    const session = {
        mbWs: ws,
        gladiaWs: null,
        gladiaUrl: null,
        logger,
        reconnectTimer: null,
        reconnectAttempts: 0,
        audioQueue: [],
        audioQueueBytes: 0,
        isConnecting: false,
        lastActivity: new Date(),
        meetingId: meetingId,
        generation: 0,
    };
    logger.info("Setting up WebSocket relay", { meetingId });
    relaySessions.set(ws, session);
    // Track session by meetingId
    if (meetingId) {
        meetingIdToSession.set(meetingId, session);
    }
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
        // Normalize to Buffer
        let audioBuffer = null;
        if (data instanceof Buffer) {
            audioBuffer = data;
        }
        else if (data instanceof ArrayBuffer) {
            audioBuffer = Buffer.from(new Uint8Array(data));
        }
        else if (ArrayBuffer.isView(data)) {
            audioBuffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
        }
        if (audioBuffer) {
            logger.debug("Received audio from MBaaS", {
                size: audioBuffer.length
            });
            sendAudioToGladia(session, audioBuffer);
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
    if (session.keepAliveTimer) {
        clearInterval(session.keepAliveTimer);
    }
    if (gladiaWs && gladiaWs.readyState === WebSocket.OPEN) {
        gladiaWs.close();
    }
    relaySessions.delete(session.mbWs);
    // Remove from meetingId tracking
    if (session.meetingId) {
        meetingIdToSession.delete(session.meetingId);
    }
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
            queuedAudioBytes: session.audioQueueBytes,
            reconnectAttempts: session.reconnectAttempts,
            lastActivity: session.lastActivity,
            meetingId: session.meetingId,
        });
    });
    return stats;
}
//# sourceMappingURL=ws-relay.service.js.map