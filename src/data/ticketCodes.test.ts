import { describe, expect, it } from 'vitest'
import { parsePayload } from '../../shared/ticketing'
import { buildPayload, clearKeyCaches, codeMac, readKeyCache, writeKeyCache } from './ticketCodes'

const ID = 'AAECAwQFBgcICQoLDA0ODw'
/** Same vectors as functions/src/crypto.test.ts, computed with Node's crypto. */
const KEY = '_KgmmFVPFJGswZ-5uSsxAv2VFYW8qOWH13s0dWSU3jI'
const COUNTER = 60_000_000
const MAC = '868EXQ7ERErjFek9wIleCw'

describe('codeMac', () => {
  it('matches the server implementation byte for byte', async () => {
    expect(await codeMac(KEY, ID, COUNTER)).toBe(MAC)
  })

  it('builds a payload the server parser accepts', async () => {
    const payload = await buildPayload(ID, KEY, COUNTER)
    expect(payload).toBe(`CF1.${ID}.${COUNTER}.${MAC}`)
    expect(parsePayload(payload)).toEqual({ ticketId: ID, counter: COUNTER, mac: MAC })
  })
})

describe('key cache', () => {
  it('keeps one cache per account and clears them all on sign-out', () => {
    const storage = memory()
    writeKeyCache('u1', { offsetMs: 1200, keys: { [ID]: { keyVersion: 2, key: KEY } } }, storage)
    writeKeyCache('u2', { offsetMs: 0, keys: { [ID]: { keyVersion: 1, key: 'bad' } } }, storage)
    storage.setItem('other', 'keep')

    expect(readKeyCache('u1', storage)).toEqual({ offsetMs: 1200, keys: { [ID]: { keyVersion: 2, key: KEY } } })
    expect(readKeyCache('u2', storage)).toEqual({ offsetMs: 0, keys: {} })

    clearKeyCaches(storage)
    expect(readKeyCache('u1', storage)).toEqual({ offsetMs: 0, keys: {} })
    expect(storage.getItem('other')).toBe('keep')
  })
})

function memory() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size
    },
  }
}
