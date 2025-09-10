import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import dotenv from 'dotenv'
import { botsRouter } from './routes/bots.js'
import { streamRouter } from './routes/stream.js'
import { getScenario } from './scenarios/index.js'
import type { Scenario } from './scenarios/types.js'

dotenv.config()

const app = new Hono<{
  Variables: {
    scenario: Scenario
  }
}>()

app.use('*', cors())
app.use('*', logger())

const scenarioName = process.env.MOCK_SCENARIO || 'default'
const scenario = getScenario(scenarioName)

app.use('*', async (c, next) => {
  c.set('scenario', scenario)
  await next()
})

app.route('/v1', botsRouter)
app.route('/v1', streamRouter)

app.get('/', (c) => {
  return c.json({
    name: 'Meeting BaaS Mock Server',
    version: '1.0.0',
    scenario: scenarioName,
    endpoints: [
      'POST /v1/bots',
      'POST /v1/bots/:botId/leave',
      'DELETE /v1/bots/:botId/leave',
      'GET /v1/meetings/:meetingId/recording'
    ]
  })
})

const port = parseInt(process.env.MOCK_PORT || '4010', 10)

console.log(JSON.stringify({
  level: 'info',
  message: 'Starting Meeting BaaS Mock Server',
  port,
  scenario: scenarioName,
  timestamp: new Date().toISOString()
}))

serve({
  fetch: app.fetch,
  port
})

console.log(JSON.stringify({
  level: 'info',
  message: 'Meeting BaaS Mock Server started',
  port,
  url: `http://127.0.0.1:${port}`,
  timestamp: new Date().toISOString()
}))