import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SchemaClient } from '../src/schema/client'
import type { SchemaManifest } from '../src/interfaces/schemas'

function manifest(hash: string, generatedAt: string): SchemaManifest {
  return {
    formatVersion: '2',
    generatedAt,
    schemas: {
      accessory_data: {
        name: 'accessory_data',
        description: 'An accessory',
        url: 'https://example.test/accessory_data.json',
        hash,
        metaVersion: '1',
        size: 10,
        superclass: null,
        documentationStatus: 'wip',
      },
    },
  }
}

/** A fetch that serves whatever manifest is set in `served`. */
function serving(state: { served: SchemaManifest }): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(state.served), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
}

describe('schema client: Refresh Schema Database', () => {
  let cacheDir: string

  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'scs-schema-test-'))
  })
  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true })
  })

  it('reports no change when the manifest is the same, even when forced', async () => {
    const state = { served: manifest('aaa', '2026-10-19T00:00:00Z') }
    const client = new SchemaClient({ cacheDir, fetchImpl: serving(state) })
    await client.init()

    expect(await client.refreshManifest()).toBe(true) // first download
    expect(await client.refreshManifest(true)).toBe(false)

    // A rebuild with the same content only changes generatedAt.
    state.served = manifest('aaa', '2026-10-20T00:00:00Z')
    expect(await client.refreshManifest(true)).toBe(false)
  })

  it('reports a change when a class changed', async () => {
    const state = { served: manifest('aaa', '2026-10-19T00:00:00Z') }
    const client = new SchemaClient({ cacheDir, fetchImpl: serving(state) })
    await client.init()
    await client.refreshManifest()

    state.served = manifest('bbb', '2026-10-20T00:00:00Z')
    expect(await client.refreshManifest(true)).toBe(true)
    expect(client.getSchemaEntry('accessory_data')?.hash).toBe('bbb')
  })
})
