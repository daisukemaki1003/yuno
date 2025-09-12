import WebSocket from "ws";
import { env } from "@/configs/env.js";
import { Logger } from "@/utils/logger.js";
import { HttpClient } from "@/clients/http.client.js";
import { transcriptLogger } from "@/utils/transcript-logger.js";

// Types for Gladia API
interface GladiaInitResponse {
  id: string;
  url: string;
}

interface GladiaTranscriptEvent {
  type: string;
  data?: {
    is_final?: boolean;
    utterance?: {
      text?: string;
      language?: string;
      start?: number;
      end?: number;
      words?: any[];
      confidence?: number;
    };
    transcript?: string;
    language?: string;
    time_begin?: number;
    time_end?: number;
    confidence?: number;
  };
}

// WebSocket relay session manager
interface RelaySession {
  mbWs: WebSocket;
  gladiaWs: WebSocket | null;
  gladiaUrl: string | null;
  logger: Logger;
  reconnectTimer: NodeJS.Timeout | null;
  reconnectAttempts: number;
  audioQueue: Buffer[];
  audioQueueBytes: number;
  isConnecting: boolean;
  meetingId?: string;
  lastActivity: Date;
  generation: number;
  keepAliveTimer?: NodeJS.Timeout;
}

const relaySessions = new Map<WebSocket, RelaySession>();
const meetingIdToSession = new Map<string, RelaySession>();
let globalGeneration = 0;

/**
 * Mask sensitive tokens in URLs
 */
function maskToken(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has('token')) {
      u.searchParams.set('token', '***');
    }
    return u.toString();
  } catch {
    return url;
  }
}

// Event emitter for transcript events
import { EventEmitter } from "events";
export const transcriptEmitter = new EventEmitter();

/**
 * Initialize Gladia Live API session
 */
async function initializeGladiaSession(logger: Logger): Promise<GladiaInitResponse> {
  if (!env.GLADIA_API_KEY) {
    throw new Error("GLADIA_API_KEY is not configured");
  }

  try {
    logger.info("Initializing Gladia Live session");

    const httpClient = new HttpClient(logger);
    const response = await httpClient.post<GladiaInitResponse>(
      "https://api.gladia.io/v2/live",
      {
        encoding: "wav/pcm",
        sample_rate: 16000,  // Gladia uses sample_rate (integer), not audio_frequency
        bit_depth: 16,
        channels: 1
      },
      {
        headers: {
          "X-Gladia-Key": env.GLADIA_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    logger.info("Gladia session initialized", {
      sessionId: response.id,
      url: maskToken(response.url)
    });

    // URLが正しい形式かチェック
    if (!response.url || !response.url.startsWith('wss://')) {
      throw new Error(`Invalid Gladia WebSocket URL: ${response.url}`);
    }

    return response;
  } catch (error) {
    logger.error("Failed to initialize Gladia session", { error });
    throw error;
  }
}

/**
 * Connect to Gladia WebSocket with retry logic
 */
async function connectToGladia(session: RelaySession): Promise<WebSocket> {
  const { logger } = session;

  // Always initialize a new session (tokens are single-use)
  const gladiaSession = await initializeGladiaSession(logger);
  session.gladiaUrl = gladiaSession.url;

  // Increment generation for this connection attempt
  const myGeneration = ++globalGeneration;
  session.generation = myGeneration;

  return new Promise((resolve, reject) => {
    logger.info("Connecting to Gladia WebSocket", { url: maskToken(session.gladiaUrl!) });

    const ws = new WebSocket(session.gladiaUrl!, {
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
          // Silently send ping
        }
      }, 20000); // 20 seconds

      ws.on("pong", () => {
        session.lastActivity = new Date();
        // Silently update activity
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
    ws.on("unexpected-response", (_request, response) => {
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
        // Process message silently
        handleGladiaMessage(session, data);
      }
    });
  });
}

/**
 * Handle messages from Gladia
 */
function handleGladiaMessage(session: RelaySession, data: WebSocket.Data) {
  const { logger } = session;

  try {
    const message = JSON.parse(data.toString()) as GladiaTranscriptEvent;

    if (message.type === "transcript" && message.data) {
      // Handle both old and new Gladia response formats
      let text: string | undefined;
      let language: string | undefined;
      let isFinal: boolean = false;
      let confidence: number | undefined;

      if (message.data.utterance) {
        // New format with utterance object
        text = message.data.utterance.text;
        language = message.data.utterance.language;
        confidence = message.data.utterance.confidence;
        isFinal = message.data.is_final || false;
      } else {
        // Old format with direct fields
        text = message.data.transcript;
        language = message.data.language;
        confidence = message.data.confidence;
        isFinal = message.data.is_final || false;
      }

      // Log only final transcripts to console
      if (isFinal && text) {
        logger.info("📝 Transcript", {
          text,
          language,
          confidence
        });
      }
      
      // Log all transcripts to file
      transcriptLogger.logTranscript({
        meetingId: session.meetingId,
        text: text || "",
        language: language || "unknown",
        isFinal,
        confidence,
        timestamp: new Date().toISOString()
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
    } else if (message.type === "error") {
      logger.error("Gladia error event", { message });
      // Log error to file
      transcriptLogger.logError(message, { meetingId: session.meetingId });
    } else if (message.type !== "ready" && message.type !== "connected") {
      // Only log unexpected event types
      logger.debug("Gladia event", { type: message.type });
    }
  } catch (error) {
    logger.error("Failed to parse Gladia message", { error, data: data.toString() });
  }
}

/**
 * Schedule reconnection with exponential backoff
 */
function scheduleReconnect(session: RelaySession) {
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
        const chunk = session.audioQueue.shift()!;
        session.audioQueueBytes -= chunk.length;
        sendAudioToGladia(session, chunk);
      }
    } catch (error) {
      session.isConnecting = false;
      logger.error("Reconnection failed", { error });
      scheduleReconnect(session);
    }
  }, delay);
}

/**
 * Send audio to Gladia with backpressure handling
 */
function sendAudioToGladia(session: RelaySession, audioData: Buffer) {
  const { gladiaWs, logger, audioQueue } = session;

  if (!gladiaWs || gladiaWs.readyState !== WebSocket.OPEN) {
    // Queue audio if not connected
    audioQueue.push(audioData);
    session.audioQueueBytes += audioData.length;

    // Apply backpressure - drop old frames if queue is too large
    const maxBuffer = env.STREAM_BACKPRESSURE_MAX_BUFFER || 5242880; // 5MB

    while (session.audioQueueBytes > maxBuffer && audioQueue.length > 1) {
      const dropped = audioQueue.shift()!;
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

    // Silently sent audio
  } catch (error) {
    logger.error("Failed to send audio to Gladia", { error });
    audioQueue.push(audioData);
    session.audioQueueBytes += audioData.length;
  }
}

/**
 * Setup WebSocket relay for incoming MBaaS audio
 */
export async function setupWebSocketRelay(ws: WebSocket, logger: Logger, meetingId?: string) {
  // Check if meetingId already has an active session
  if (meetingId && meetingIdToSession.has(meetingId)) {
    const existingSession = meetingIdToSession.get(meetingId)!;
    if (existingSession.mbWs.readyState === WebSocket.OPEN) {
      logger.warn("Meeting already has an active session", { meetingId });
      ws.close(1008, "Meeting already has an active session");
      return;
    } else {
      // Clean up stale session
      cleanupSession(existingSession);
    }
  }
  const session: RelaySession = {
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
  } catch (error) {
    logger.error("Initial Gladia connection failed", { error });
    scheduleReconnect(session);
  }

  // Handle incoming audio from MBaaS
  ws.on("message", (data) => {
    // Normalize to Buffer
    let audioBuffer: Buffer | null = null;
    
    if (data instanceof Buffer) {
      audioBuffer = data;
    } else if (data instanceof ArrayBuffer) {
      audioBuffer = Buffer.from(new Uint8Array(data));
    } else if (ArrayBuffer.isView(data)) {
      audioBuffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    }
    
    if (audioBuffer) {
      // Silently process audio
      sendAudioToGladia(session, audioBuffer);
    } else {
      // Handle non-binary messages (e.g., control messages)
      try {
        const message = JSON.parse(data.toString());
        logger.info("Received control message from MBaaS", { message });

        // Extract meetingId if provided
        if (message.meetingId) {
          session.meetingId = message.meetingId;
        }
      } catch (error) {
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
  ws.send(
    JSON.stringify({
      type: "ready",
      timestamp: new Date().toISOString(),
    })
  );
}

/**
 * Cleanup session resources
 */
function cleanupSession(session: RelaySession) {
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
    sessions: [] as any[],
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
