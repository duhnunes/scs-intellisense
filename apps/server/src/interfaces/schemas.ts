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
 * The full per-class schema document fetched lazily from a manifest
 * entry's `url`. Shape is intentionally loose for now — attribute-level
 * consumers (completion of attribute_key, token validation, hover) will
 * refine this once that work starts; this module only needs to fetch,
 * cache, and hand back whatever JSON is there.
 */
export type SchemaDocument = Record<string, unknown>
