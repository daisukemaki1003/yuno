import { Hono } from 'hono'
import { z } from 'zod'
import { generateBotId } from '../utils/ids.js'
import { sleep } from '../utils/time.js'
import type { Scenario } from '../scenarios/types.js'

const botsRouter = new Hono<{
  Variables: {
    scenario: Scenario
  }
}>()

const requestCountMap = new Map<string, number>()
const idempotencyCache = new Map<string, any>()
const botsState = new Map<string, { status: string; meetingId?: string }>()

const createBotSchema = z.object({
  meetingId: z.string(),
  userId: z.string().optional()
})

botsRouter.use('*', async (c, next) => {
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

botsRouter.post('/bots', async (c) => {
  const scenario = c.get('scenario')
  const endpoint = 'POST /v1/bots'
  
  const idempotencyKey = c.req.header('Idempotency-Key')
  if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
    return c.json(idempotencyCache.get(idempotencyKey))
  }
  
  const requestCount = (requestCountMap.get(endpoint) || 0) + 1
  requestCountMap.set(endpoint, requestCount)
  
  const errorResponse = scenario.getErrorResponse(requestCount)
  if (errorResponse) {
    if (errorResponse.headers) {
      Object.entries(errorResponse.headers).forEach(([key, value]) => {
        c.header(key, value)
      })
    }
    return c.json(errorResponse.body, errorResponse.status)
  }
  
  const delay = scenario.shouldDelay()
  if (delay > 0) {
    await sleep(delay)
  }
  
  try {
    const body = await c.req.json()
    const parsed = createBotSchema.parse(body)
    
    const botId = generateBotId()
    const response = { id: botId, botId }
    
    botsState.set(botId, {
      status: 'joining',
      meetingId: parsed.meetingId
    })
    
    setTimeout(() => {
      if (botsState.has(botId)) {
        botsState.set(botId, {
          ...botsState.get(botId)!,
          status: 'joined'
        })
      }
    }, 2000)
    
    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, response)
    }
    
    return c.json(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', details: error.errors }, 400)
    }
    return c.json({ error: 'Internal server error' }, 500)
  }
})

botsRouter.post('/bots/:botId/leave', async (c) => {
  const scenario = c.get('scenario')
  const botId = c.req.param('botId')
  
  const delay = scenario.shouldDelay()
  if (delay > 0) {
    await sleep(delay)
  }
  
  if (!botsState.has(botId)) {
    return c.json({ error: 'Bot not found' }, 404)
  }
  
  botsState.set(botId, {
    ...botsState.get(botId)!,
    status: 'leaving'
  })
  
  setTimeout(() => {
    botsState.set(botId, {
      ...botsState.get(botId)!,
      status: 'left'
    })
  }, 1000)
  
  return c.body(null, 204)
})

botsRouter.delete('/bots/:botId/leave', async (c) => {
  return botsRouter.handlers.post![0](c, async () => {})
})

export { botsRouter }