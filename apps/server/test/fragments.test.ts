import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findAttributeKeyPosition } from '../src/completion/attributeKey'
import { checkDocument } from '../src/diagnostic'
import {
  asFragmentDocument,
  fragmentClassName,
  lookupClasses,
  mergeSchemas,
} from '../src/index/fragments'
import { WorkspaceIndex } from '../src/index/workspaceIndex'
import type {
  SchemaAttributeDef,
  SchemaFileContent,
} from '../src/interfaces/schemas'
import { readScsDocument } from '../src/sii'

function def(fields: Partial<SchemaAttributeDef> = {}): SchemaAttributeDef {
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

function schema(key: Record<string, SchemaAttributeDef>): SchemaFileContent {
  return {
    meta: { version: '1.0.0', documentationStatus: 'undocumented' },
    scope: '',
    description: '',
    superclass: '',
    versionNote: null,
    allowsSiiNunitRoot: true,
    inheritsFrom: [],
    key,
  }
}

const SCHEMAS: Record<string, SchemaFileContent> = {
  goal: schema({
    name: def(),
    kind: def({ type: 'enum', values: ['a', 'b'] }),
  }),
  goal_bonus: schema({
    bonus: def({ type: 'u32' }),
    kind: def({ type: 'enum', values: ['c'] }),
  }),
}
const lookup = (className: string) =>
  lookupClasses(className, (one) => SCHEMAS[one])

describe('.sui fragments: the virtual unit', () => {
  it('puts the bare attributes in a unit of the including class', () => {
    const parsed = readScsDocument('name: "x"\nbonus: 3\n', 'sui')
    const classed = asFragmentDocument(parsed, 'goal')
    expect(classed.units).toHaveLength(1)
    expect(classed.units[0]!.className).toBe('goal')
    expect(classed.units[0]!.attributes.map((a) => a.key)).toEqual([
      'name',
      'bonus',
    ])
    // Completion of keys works there, on a new line.
    expect(findAttributeKeyPosition(classed, classed.text.length)).toBe(
      classed.units[0]
    )
  })

  it('leaves a .sui of units, or one with no class, as read', () => {
    const units = readScsDocument('goal : .g {\n}\n', 'sui')
    expect(asFragmentDocument(units, 'goal')).toBe(units)
    const bare = readScsDocument('name: "x"\n', 'sui')
    expect(asFragmentDocument(bare, undefined)).toBe(bare)
  })

  it('merges the classes of several includers, enum values too', () => {
    expect(fragmentClassName(['goal_bonus', 'goal', 'goal'])).toBe(
      'goal|goal_bonus'
    )
    const merged = lookup('goal|goal_bonus')!
    expect(Object.keys(merged.key).sort()).toEqual(['bonus', 'kind', 'name'])
    expect(merged.key.kind!.values).toEqual(['a', 'b', 'c'])
    // A class still loading: no partial union (its keys would look unknown).
    expect(mergeSchemas([SCHEMAS.goal, undefined])).toBeUndefined()
  })

  it('runs the schema rules on the fragment', () => {
    const doc = TextDocument.create(
      'file:///f.sui',
      'sui',
      1,
      'name: "x"\nnmae: "y"\nkind: z\n'
    )
    const codes = (fragmentClass?: string) =>
      checkDocument(doc, undefined, lookup, fragmentClass).issues.map(
        (issue) => issue.code
      )
    expect(codes('goal')).toEqual(['unknown-attribute', 'invalid-enum-value'])
    expect(codes(undefined)).toEqual([])
  })
})

describe('.sui fragments: finding the class', () => {
  let root: string
  const index = new WorkspaceIndex()

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'scs-fragments-test-'))
    const files: Record<string, string> = {
      'manifest.sii': '',
      'def/goals.sii':
        'SiiNunit\n{\ngoal : .a {\n@include "share/goal_time.sui"\n}\ngoal_bonus : .b {\n@include "/def/share/goal_root.sui"\n}\n}\n',
      // Included by a unit, and includes another fragment.
      'def/share/goal_time.sui': 'name: "t"\n@include "goal_common.sui"\n',
      'def/share/goal_common.sui': 'name: "c"\n',
      'def/share/goal_root.sui': 'bonus: 1\n',
      'def/share/unused.sui': 'name: "u"\n',
    }
    for (const [file, text] of Object.entries(files)) {
      await mkdir(join(root, file, '..'), { recursive: true })
      await writeFile(join(root, file), text)
    }
    await index.scan([root], () => false)
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  const classesOf = (file: string) =>
    index.classesOf(
      index.get(`file:///${join(root, file).replace(/\\/g, '/')}`)!
    )

  it('takes the class of the including unit, "/" paths too', () => {
    expect(classesOf('def/share/goal_time.sui')).toEqual(['goal'])
    expect(classesOf('def/share/goal_root.sui')).toEqual(['goal_bonus'])
  })

  it('follows a fragment included by another fragment', () => {
    expect(classesOf('def/share/goal_common.sui')).toEqual(['goal'])
  })

  it('has no class when nothing includes it', () => {
    expect(classesOf('def/share/unused.sui')).toEqual([])
  })
})
