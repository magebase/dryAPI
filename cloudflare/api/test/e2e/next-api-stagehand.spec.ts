import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Stagehand } from '@browserbasehq/stagehand'
import { OpenAI } from 'openai'
import { z } from 'zod'

const shouldRunApiStagehand = process.env['CF_API_STAGEHAND_E2E'] === '1' && Boolean(process.env['OPENAI_API_KEY'])
const liveTest = shouldRunApiStagehand ? it : it.skip

const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000'
const apiKey = process.env['DRYAPI_TEST_API_KEY'] ?? 'test-api-key'

let stagehand: Stagehand | null = null

beforeAll(async () => {
  if (!shouldRunApiStagehand) {
    return
  }

  stagehand = new Stagehand({
    env: 'LOCAL',
    model: {
      modelName: process.env['CF_API_STAGEHAND_MODEL'] || 'gpt-4o',
      apiKey: process.env['OPENAI_API_KEY'] || '',
    },
    localBrowserLaunchOptions: {
      headless: true,
    },
    verbose: 0,
  })

  await stagehand.init()
})

afterAll(async () => {
  if (!stagehand) {
    return
  }

  await stagehand.close()
})

const ApiResponseSchema = z.object({
  status: z.number(),
  data: z.any().optional(),
})

describe('Next.js API Routes E2E (Stagehand + OpenAI/OpenRouter clients)', () => {
  liveTest('v1 client balance returns credit data for authenticated key', async () => {
    if (!stagehand) throw new Error('Stagehand not initialized')

    const page = await stagehand.context.awaitActivePage()
    await page.goto(`${baseUrl}/api/v1/client/balance`)

    const result = await page.evaluate(async ({ url, key }) => {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${key}` }
      })
      return {
        status: res.status,
        data: await res.json().catch(() => null)
      }
    }, { url: `${baseUrl}/api/v1/client/balance`, key: apiKey })

    const parsed = ApiResponseSchema.parse(result)
    expect(parsed.status).toBe(200)
    expect(parsed.data.data).toBeDefined()
    expect(typeof parsed.data.data.balance).toBe('number')
  })

  liveTest('v1 models list returns active runpod models', async () => {
    if (!stagehand) throw new Error('Stagehand not initialized')

    const page = await stagehand.context.awaitActivePage()
    const result = await page.evaluate(async ({ url, key }) => {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${key}` }
      })
      return {
        status: res.status,
        data: await res.json().catch(() => null)
      }
    }, { url: `${baseUrl}/api/v1/models`, key: apiKey })

    const parsed = ApiResponseSchema.parse(result)
    expect(parsed.status).toBe(200)
    expect(Array.isArray(parsed.data.data)).toBe(true)
    if (parsed.data.data.length > 0) {
      expect(parsed.data.data[0]).toHaveProperty('slug')
    }
  })

  liveTest('v1 chat completions via OpenAI client executes simulation dispatch', async () => {
    if (!stagehand) throw new Error('Stagehand not initialized')

    // Using OpenAI client directly from the test environment
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: `${baseUrl}/api/v1`, // Points to our local Next.js API
    })

    const completion = await client.chat.completions.create({
      messages: [{ role: 'user', content: 'Say hello' }],
      model: 'gpt-3.5-turbo', // Model slug doesn't matter much in simulation mode
    })

    expect(completion.id).toBeDefined()
    expect(completion.object).toBe('chat.completion')
    expect(completion.choices[0].message.content).toBeDefined()
  })

  liveTest('v1 chat completions via OpenRouter client executes simulation dispatch', async () => {
    if (!stagehand) throw new Error('Stagehand not initialized')

    // OpenRouter client is technically just OpenAI client with a different baseURL
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: `${baseUrl}/api/v1`, 
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000', // OpenRouter specific
        'X-Title': 'DryAPI E2E Tests',
      }
    })

    const completion = await client.chat.completions.create({
      messages: [{ role: 'user', content: 'Say hello' }],
      model: 'openai/gpt-3.5-turbo',
    })

    expect(completion.id).toBeDefined()
    expect(completion.choices[0].message.content).toBeDefined()
  })

  liveTest('v1 embeddings returns simulated vector', async () => {
    if (!stagehand) throw new Error('Stagehand not initialized')

    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: `${baseUrl}/api/v1`,
    })

    const embedding = await client.embeddings.create({
      input: 'test string',
      model: 'text-embedding-3-small',
    })

    expect(embedding.object).toBe('list')
    expect(Array.isArray(embedding.data[0].embedding)).toBe(true)
  })

  liveTest('dashboard api-keys requires session', async () => {
    if (!stagehand) throw new Error('Stagehand not initialized')

    const page = await stagehand.context.awaitActivePage()
    const result = await page.evaluate(async ({ url }) => {
      const res = await fetch(url)
      return {
        status: res.status,
        data: await res.json().catch(() => null)
      }
    }, { url: `${baseUrl}/api/dashboard/api-keys` })

    const parsed = ApiResponseSchema.parse(result)
    expect(parsed.status).toBe(401)
  })

  liveTest('contact form submission validation', async () => {
    if (!stagehand) throw new Error('Stagehand not initialized')

    const page = await stagehand.context.awaitActivePage()
    const result = await page.evaluate(async ({ url }) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: 'Test',
          email: 'not-an-email',
          message: 'Short'
        })
      })
      return {
        status: res.status,
        data: await res.json().catch(() => null)
      }
    }, { url: `${baseUrl}/api/contact` })

    const parsed = ApiResponseSchema.parse(result)
    expect(parsed.status).toBe(400)
  })
})

