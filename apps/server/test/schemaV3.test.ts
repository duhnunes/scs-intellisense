import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildAttributeKeyCompletionItems,
  formatAttributeType,
} from '../src/completion/attributeKey'
import { buildClassNameCompletionItems } from '../src/completion/className'
import { buildAttributeKeyHover } from '../src/hover/attributeKey'
import { buildClassNameHover } from '../src/hover/className'
import type {
  SchemaAttributeDef,
  SchemaFileContent,
  SchemaManifest,
} from '../src/interfaces/schemas'
import { isSupportedManifest, SchemaClient } from '../src/schema/client'

/** An attribute as scs-schema v3 writes it (data/dist/v3/*.json). */
function attribute(fields: Partial<SchemaAttributeDef>): SchemaAttributeDef {
  return {
    description: '',
    type: 'string',
    isArray: false,
    values: null,
    pointsTo: null,
    status: 'active',
    default: null,
    expectedExtensions: null,
    required: false,
    versionNote: null,
    supportsLocalization: false,
    internalOnly: false,
    notes: '',
    ...fields,
  }
}

// Fields taken from the live v3 accessory_cabin_data.json.
const cabin: SchemaFileContent = {
  meta: { version: '1.0.0', documentationStatus: 'wip' },
  scope: '',
  description: 'Configures the models for the cabin.',
  superclass: 'accessory_data',
  versionNote: null,
  allowsSiiNunitRoot: true,
  inheritsFrom: ['accessory_data'],
  key: {
    name: attribute({ description: 'Full name of the accessory.' }),
    info: attribute({ isArray: true }),
    part_type: attribute({
      type: 'enum',
      values: ['unknown', 'factory', 'aftermarket', 'licensed'],
      default: 'unknown',
      versionNote: 'Added in 1.44.',
    }),
    sound_horn: attribute({ status: 'legacy' }),
    steam_inventory_id: attribute({ type: 'u32', internalOnly: true }),
  },
}

function manifest(
  formatVersion: string,
  documentationStatus: 'undocumented' | 'wip' | 'complete' = 'wip'
): SchemaManifest {
  return {
    formatVersion,
    generatedAt: '2026-10-22T03:08:18.393Z',
    schemas: {
      accessory_cabin_data: {
        name: 'accessory_cabin_data',
        description: 'Configures the models for the cabin.',
        url: 'https://example.test/v3/accessory_cabin_data.json',
        hash: 'sha256:aaa',
        metaVersion: '1.0.0',
        size: 1,
        superclass: 'accessory_data',
        documentationStatus,
      },
    },
  }
}

describe('schema v3: attribute types', () => {
  it('shows one type, with [] for arrays', () => {
    expect(formatAttributeType(cabin.key.name!)).toBe('string')
    expect(formatAttributeType(cabin.key.info!)).toBe('string[]')
    expect(formatAttributeType(cabin.key.part_type!)).toBe('enum')
  })
})

describe('schema v3: attribute completion', () => {
  it('leaves out legacy and internal-only attributes', () => {
    const labels = buildAttributeKeyCompletionItems(cabin).map((i) => i.label)
    expect(labels).toEqual(['name', 'info', 'part_type'])
  })

  it('shows the default value', () => {
    const partType = buildAttributeKeyCompletionItems(cabin).find(
      (item) => item.label === 'part_type'
    )
    expect(partType?.documentation).toContain('Default: `unknown`')
  })
})

describe('schema v3: attribute hover', () => {
  it('shows the type, the enum values and the default', () => {
    const hover = buildAttributeKeyHover('part_type', cabin)?.markdown
    expect(hover).toContain('**part_type**: `enum`')
    expect(hover).toContain(
      'Valid values: `unknown`, `factory`, `aftermarket`, `licensed`'
    )
    expect(hover).toContain('Default: `unknown`')
  })

  it('says a legacy attribute has no effect', () => {
    expect(buildAttributeKeyHover('sound_horn', cabin)?.markdown).toContain(
      'Legacy'
    )
  })
})

describe('schema v3: class names', () => {
  it('says an undocumented class has no description yet', () => {
    const undocumented = manifest('3.0.0', 'undocumented')
    undocumented.schemas.accessory_cabin_data!.description = ''
    const hover = buildClassNameHover('accessory_cabin_data', undocumented)
    expect(hover?.markdown).toContain('No description yet')
    expect(hover?.markdown).not.toContain('No description available')

    const [item] = buildClassNameCompletionItems(undocumented)
    expect(item?.documentation).toContain('No description yet')
  })
})

describe('schema v3: manifest format', () => {
  it('reads 3.x and nothing else', () => {
    expect(isSupportedManifest(manifest('3.0.0'))).toBe(true)
    expect(isSupportedManifest(manifest('3.2.1'))).toBe(true)
    expect(isSupportedManifest(manifest('2.0.0'))).toBe(false)
    expect(isSupportedManifest({} as SchemaManifest)).toBe(false)
  })

  let cacheDir: string
  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'scs-schema-v3-test-'))
  })
  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true })
  })

  it('keeps its database when the server sends a v2 manifest', async () => {
    let served = manifest('3.0.0')
    const fetchImpl = (async () =>
      new Response(JSON.stringify(served), { status: 200 })) as typeof fetch
    const client = new SchemaClient({ cacheDir, fetchImpl })
    await client.init()
    expect(await client.refreshManifest()).toBe(true)

    served = manifest('2.0.0')
    served.schemas = {}
    expect(await client.refreshManifest(true)).toBe(false)
    expect(client.getSchemaEntry('accessory_cabin_data')).toBeDefined()
  })
})

describe('schema v3: class hover layout', () => {
  it('separates every paragraph with exactly one blank line', () => {
    const undocumented = manifest('3.0.0', 'undocumented')
    undocumented.schemas.accessory_cabin_data!.description = ''
    const markdown = buildClassNameHover(
      'accessory_cabin_data',
      undocumented
    )!.markdown
    expect(markdown).not.toContain('\n\n\n')
    expect(markdown).toBe(
      '**accessory_cabin_data**\n*extends accessory_data*\n\nNo description yet: only its attributes and their types are known.'
    )
  })
})

describe('schema v3: class completion order', () => {
  const entry = (
    name: string,
    documentationStatus: 'undocumented' | 'wip' | 'complete',
    gameUnits?: number
  ) => ({
    name,
    description: '',
    url: `https://example.test/${name}.json`,
    hash: 'sha256:x',
    metaVersion: '1.0.0',
    size: 1,
    superclass: null,
    documentationStatus,
    ...(gameUnits === undefined ? {} : { gameUnits }),
  })
  const order = (schemas: ReturnType<typeof entry>[]) =>
    buildClassNameCompletionItems({
      formatVersion: '3.1.0',
      generatedAt: '',
      schemas: Object.fromEntries(schemas.map((s) => [s.name, s])),
    })
      .sort((a, b) => (a.sortText < b.sortText ? -1 : 1))
      .map((item) => item.label)

  it('puts documented classes first, then the most used, then the rest', () => {
    expect(
      order([
        entry('save_container', 'undocumented', 0),
        entry('sign_template_text', 'undocumented', 21802),
        entry('accessory_cabin_data', 'wip', 4),
        entry('editor_thing', 'undocumented'),
        entry('cargo_def', 'undocumented', 15428),
        entry('accessory_data', 'complete', 1),
      ])
    ).toEqual([
      'accessory_cabin_data',
      'accessory_data',
      'sign_template_text',
      'cargo_def',
      'editor_thing',
      'save_container',
    ])
  })

  it('falls back to alphabetical when the manifest has no usage counts', () => {
    expect(
      order([
        entry('b_class', 'undocumented'),
        entry('a_class', 'undocumented'),
      ])
    ).toEqual(['a_class', 'b_class'])
  })
})
