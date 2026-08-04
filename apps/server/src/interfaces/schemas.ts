/**
 * One entry in scs-schema's manifest.json — one per class_name. The
 * manifest already carries `scope`/`description`, so completion and
 * hover for class_name itself never need to fetch the individual schema
 * URL — only the full attribute list (fetched lazily from `url`) does.
 */
export interface SchemaManifestEntry {
  id: string
  name: string
  path: string
  url: string
  metaVersion: string
  hash: string
  size: number
  description: string
  scope: string
}

export interface SchemaManifest {
  version: string
  generatedAt: string
  schemas: Record<string, SchemaManifestEntry>
}

/**
 * One attribute definition inside a schema file's `key` map. Matches
 * scs-schema's actual JSON shape (confirmed against a real fetched file,
 * e.g. animated_model_data.json) — NOT the earlier speculative
 * AttributeDef in interfaces/structure.ts, which predates having seen
 * real data and doesn't match it (array shape vs. this record shape,
 * field names, etc).
 */
export interface SchemaAttributeDef {
  description: string
  isArray: boolean
  /** Present (non-null) when isArray is false. */
  type: string[] | null
  /** Present (non-null) when isArray is true. */
  arrayElementType: string[] | null
}

/**
 * The full per-class schema document fetched lazily from a manifest
 * entry's `url`. The database isn't 100% populated yet (per duhnunes),
 * so consumers should treat every field here as possibly missing or
 * malformed on any given class, not just absent entirely.
 */
export interface SchemaFileContent {
  meta: {
    version: string
    description: string
  }
  scope: string
  key: Record<string, SchemaAttributeDef>
}
