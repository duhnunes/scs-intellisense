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
 * scs-schema's actual JSON shape (confirmed against real fetched files —
 * animated_model_data.json, sign_model.sii, trigger_action.sii).
 *
 * `type` and `arrayElementType` are NOT mutually exclusive — an
 * attribute can have both at once. What they mean depends on which SII
 * array convention this attribute supports:
 *  - `type` only, `arrayElementType: null` (e.g. "name") — this
 *    attribute is never an array: only `key: value` is valid, and
 *    `type` is the value's allowed type(s).
 *  - `arrayElementType` only, `type: null` (e.g. "str_params") — this
 *    attribute ONLY exists as a dynamic array: only `key[]: value`
 *    (repeated) is valid, never a bare `key: value`.
 *  - Both set (e.g. "stand_classes") — this attribute supports the
 *    *counted* array form: `key: N` (a count, validated against
 *    `type`) followed by `key[0]` through `key[N-1]` (each validated
 *    against `arrayElementType`).
 * `isArray` is true whenever `arrayElementType` is set (either of the
 * last two cases above) — it doesn't by itself distinguish "counted"
 * from "dynamic"; that's what having `type` alongside it tells you.
 */
export interface SchemaAttributeDef {
  description: string
  isArray: boolean
  type: string[] | null
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
