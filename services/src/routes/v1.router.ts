import { Hono } from 'hono';
import addBotRouter from './bots.add.js';
import leaveBotRouter from './bots.leave.js';
import streamRouter from './streams.recording.js';
import mockTranscriptsRouter from './mock-transcripts.js';

// Create v1 router
const v1 = new Hono();

// Mount bot routes
v1.route('/bots', addBotRouter);
v1.route('/bots', leaveBotRouter);

// Mount stream routes
v1.route('/meetings', streamRouter);
v1.route('/meetings', mockTranscriptsRouter);

export default v1;
