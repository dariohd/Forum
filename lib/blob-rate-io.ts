import { BlobPreconditionFailedError, get, put } from '@vercel/blob'
import { assertStorageConfigured } from './mode.js'

const RATE_PATH = 'mur-libre/rate-events.json'

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN
}

type RateEvent = { key: string; createdAt: string }

type RateState = { events: RateEvent[] }

function defaultRateState(): RateState {
  return { events: [] }
}

async function loadRates(): Promise<{ state: RateState; etag?: string }> {
  assertStorageConfigured()
  try {
    const file = await get(RATE_PATH, { access: 'private', token: blobToken() })
    if (file?.statusCode === 200 && file.stream) {
      const parsed = JSON.parse(await new Response(file.stream).text()) as Partial<RateState>
      return { state: { events: parsed.events ?? [] }, etag: file.blob.etag }
    }
  } catch {
    /* vide */
  }
  return { state: defaultRateState() }
}

async function saveRates(state: RateState, etag?: string): Promise<void> {
  const opts = {
    access: 'private' as const,
    token: blobToken(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  }
  try {
    await put(RATE_PATH, JSON.stringify(state), { ...opts, ...(etag ? { ifMatch: etag } : {}) })
  } catch (e) {
    if (!isPreconditionError(e)) throw e
    await put(RATE_PATH, JSON.stringify(state), opts)
  }
}

function isPreconditionError(e: unknown): boolean {
  return e instanceof BlobPreconditionFailedError
    || (e instanceof Error && /precondition|etag mismatch/i.test(e.message))
}

export async function withRateState<T>(fn: (state: RateState) => T | Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < 12; attempt++) {
    const { state, etag } = await loadRates()
    try {
      const result = await fn(state)
      try {
        await saveRates(state, etag)
      } catch (e) {
        if (isPreconditionError(e) && attempt < 11) {
          await new Promise((r) => setTimeout(r, 25 * (attempt + 1)))
          continue
        }
        throw e
      }
      return result
    } catch (e) {
      if (e instanceof Error && e.message.includes('Trop de')) throw e
      lastError = e
      await new Promise((r) => setTimeout(r, 40 * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Échec rate limit')
}

export function pruneRateEvents(state: RateState, windowSec: number) {
  const cutoff = Date.now() - windowSec * 1000
  state.events = state.events.filter((e) => new Date(e.createdAt).getTime() >= cutoff)
}

export async function blobCheckRateLimit(key: string, max: number, windowSec: number): Promise<void> {
  await withRateState((state) => {
    pruneRateEvents(state, windowSec)
    const count = state.events.filter((e) => e.key === key).length
    if (count >= max) throw new Error('Trop de requêtes. Réessaie dans un instant.')
    state.events.push({ key, createdAt: new Date().toISOString() })
  })
}
