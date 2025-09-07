import { Hono } from 'hono'
import { sendSSE, type SSEEvent } from '../utils/sse.js'
import { sleep } from '../utils/time.js'
import type { Scenario } from '../scenarios/types.js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const streamRouter = new Hono<{
  Variables: {
    scenario: Scenario
  }
}>()

streamRouter.use('*', async (c, next) => {
  const scenario = c.get('scenario')
  
  if (scenario.shouldRequireAuth()) {
    const authHeader = c.req.header('Authorization')
    const apiKeyHeader = c.req.header('X-API-Key')
    
    if (!authHeader && !apiKeyHeader) {
      return c.json({ error: 'Authentication required' }, 401)
    }
  }
  
  await next()
})

async function* generateEventStream(
  meetingId: string,
  scenario: Scenario
): AsyncGenerator<SSEEvent> {
  const streamBehavior = scenario.getStreamBehavior()
  const streamDuration = parseInt(process.env.MOCK_STREAM_DURATION_MS || '60000', 10)
  
  if (streamBehavior.initialDelay > 0) {
    await sleep(streamBehavior.initialDelay)
  }
  
  const startTime = Date.now()
  let transcriptIndex = 0
  let lastAudioTime = 0
  let lastPingTime = 0
  
  let transcripts: any[] = []
  try {
    const transcriptsPath = join(__dirname, '../data/transcripts.ndjson')
    const content = readFileSync(transcriptsPath, 'utf-8')
    transcripts = content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
  } catch (error) {
    transcripts = [
      { ts: Date.now(), text: 'Hello, this is a test transcript.' },
      { ts: Date.now() + 1000, text: 'This is another test message.' },
      { ts: Date.now() + 2000, text: 'Meeting recording in progress.' }
    ]
  }
  
  while (Date.now() - startTime < streamDuration) {
    const elapsed = Date.now() - startTime
    
    if (streamBehavior.shouldError && streamBehavior.errorAfterMs && elapsed >= streamBehavior.errorAfterMs) {
      yield {
        event: 'error',
        data: { error: 'Stream interrupted', code: 'STREAM_ERROR' }
      }
      break
    }
    
    if (Date.now() - lastAudioTime >= 5000) {
      yield {
        event: 'audio',
        data: {
          timestamp: Date.now(),
          audio: Buffer.from('dummy audio data').toString('base64'),
          format: 'opus'
        }
      }
      lastAudioTime = Date.now()
    }
    
    if (transcriptIndex < transcripts.length) {
      yield {
        event: 'transcript',
        data: {
          timestamp: transcripts[transcriptIndex].ts || Date.now(),
          text: transcripts[transcriptIndex].text,
          speaker: transcripts[transcriptIndex].speaker || 'Speaker 1',
          confidence: transcripts[transcriptIndex].confidence || 0.95
        }
      }
      transcriptIndex++
      if (transcriptIndex >= transcripts.length) {
        transcriptIndex = 0
      }
    }
    
    if (Date.now() - lastPingTime >= 30000) {
      yield {
        event: 'ping',
        data: { timestamp: Date.now() }
      }
      lastPingTime = Date.now()
    }
    
    await sleep(2000)
  }
  
  yield {
    event: 'end',
    data: {
      timestamp: Date.now(),
      duration: Date.now() - startTime,
      reason: 'completed'
    }
  }
}

streamRouter.get('/meetings/:meetingId/recording', async (c) => {
  const scenario = c.get('scenario')
  const meetingId = c.req.param('meetingId')
  
  return sendSSE(c, generateEventStream(meetingId, scenario))
})

export { streamRouter }