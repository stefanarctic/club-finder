/**
 * Rotating admission codes, computed on the guest's device so the pass works without signal.
 * The per-ticket key comes from the server; the master key it is derived from never leaves the server.
 */
import { MAC_BYTES, base64urlToBytes, bytesToBase64url, codeMessage, formatPayload } from '../../shared/ticketing'

const STORAGE_PREFIX = 'club-finder:ticket-keys:v1:'

export type TicketKey = { keyVersion: number; key: string }

export type KeyCache = {
  /** Server time minus device time, so a phone with a wrong clock still shows the current code. */
  offsetMs: number
  keys: Record<string, TicketKey>
}

type KeyValue = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  key(index: number): string | null
  readonly length: number
}

const imported = new Map<string, Promise<CryptoKey>>()

function hmacKey(key: string): Promise<CryptoKey> {
  let pending = imported.get(key)
  if (!pending) {
    pending = crypto.subtle.importKey('raw', base64urlToBytes(key) as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    imported.set(key, pending)
  }
  return pending
}

export async function codeMac(key: string, ticketId: string, counter: number): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(key), new TextEncoder().encode(codeMessage(ticketId, counter)))
  return bytesToBase64url(new Uint8Array(signature).subarray(0, MAC_BYTES))
}

export async function buildPayload(ticketId: string, key: string, counter: number): Promise<string> {
  return formatPayload(ticketId, counter, await codeMac(key, ticketId, counter))
}

export function emptyKeyCache(): KeyCache {
  return { offsetMs: 0, keys: {} }
}

export function readKeyCache(uid: string, storage: KeyValue | null = browserStorage()): KeyCache {
  try {
    const raw = storage?.getItem(STORAGE_PREFIX + uid)
    if (!raw) return emptyKeyCache()
    return parseKeyCache(JSON.parse(raw))
  } catch {
    return emptyKeyCache()
  }
}

export function writeKeyCache(uid: string, cache: KeyCache, storage: KeyValue | null = browserStorage()): void {
  try {
    storage?.setItem(STORAGE_PREFIX + uid, JSON.stringify(cache))
  } catch {
    // Private mode or a full disk. Codes still work for this visit from memory.
  }
}

/** Run on sign-out, so the next person on this device cannot show someone else's pass. */
export function clearKeyCaches(storage: KeyValue | null = browserStorage()): void {
  try {
    if (!storage) return
    const stale: string[] = []
    for (let index = 0; index < storage.length; index++) {
      const name = storage.key(index)
      if (name?.startsWith(STORAGE_PREFIX)) stale.push(name)
    }
    for (const name of stale) storage.removeItem(name)
  } catch {
    // Nothing to clear.
  }
}

export function parseKeyCache(value: unknown): KeyCache {
  if (!value || typeof value !== 'object') return emptyKeyCache()
  const raw = value as { offsetMs?: unknown; keys?: unknown }
  const keys: Record<string, TicketKey> = {}
  if (raw.keys && typeof raw.keys === 'object') {
    for (const [ticketId, entry] of Object.entries(raw.keys)) {
      const { keyVersion, key } = (entry ?? {}) as Partial<TicketKey>
      if (typeof keyVersion === 'number' && Number.isInteger(keyVersion) && keyVersion > 0 && typeof key === 'string' && /^[A-Za-z0-9_-]{43}$/.test(key)) {
        keys[ticketId] = { keyVersion, key }
      }
    }
  }
  const offsetMs = typeof raw.offsetMs === 'number' && Number.isFinite(raw.offsetMs) ? raw.offsetMs : 0
  return { offsetMs, keys }
}

function browserStorage(): KeyValue | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}
