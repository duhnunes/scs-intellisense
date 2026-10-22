/**
 * scs-schema format v3 (data/manifest.v3.json and data/dist/v3/): every
 * unit class of the game, with the game's own attribute names and types.
 * See docs/migrating-to-v3.md in scs-schema.
 */

/** "undocumented": names and types only, no descriptions yet (most
 *  classes). "wip": partly described. "complete": fully described. */
export type SchemaDocumentationStatus = 'undocumented' | 'wip' | 'complete'

/**
 * One entry in the manifest — one per class_name.
 * `superclass`/`documentationStatus` come free with the manifest (no
 * fetch needed), so completion/hover for class_name itself can show
 * "extends X" or a documentation note without ever touching the
 * per-class URL — only the full attribute list (fetched lazily from
 * `url`) needs that.
 */
export interface SchemaManifestEntry {
  name: string
  /** May be "" (undocumented classes). */
  description: string
  /** Always use this URL: namespaced classes are stored under another
   *  file name (`ui::text_common` → `ui.text_common.json`). */
  url: string
  hash: string
  metaVersion: string
  size: number
  /** Direct parent class only, or null for a root class. */
  superclass: string | null
  documentationStatus: SchemaDocumentationStatus
  /** How many units of this class the game's own files have (0: never
   *  seen). Optional: missing in manifests built before it existed. Used
   *  to put the classes modders actually write first. */
  gameUnits?: number | null
}

export interface SchemaManifest {
  /** "3.x.y" for this format; anything else is not read. */
  formatVersion: string
  generatedAt: string
  schemas: Record<string, SchemaManifestEntry>
}

/**
 * One attribute definition inside a class file's `key` map.
 *
 * `type` is one type name, as the game names it (`string`, `float3`,
 * `quat`, `enum`, `owner_ptr`...). For an array (`isArray`), it's the
 * type of each element; both array forms are valid for every array
 * (`key[]: v` repeated, or `key: N` then `key[0]`..`key[N-1]`).
 */
export interface SchemaAttributeDef {
  /** May be "" (undocumented). */
  description: string
  type: string
  isArray: boolean
  /** "legacy": the game still accepts it but doesn't use it (usually
   *  replaced by another attribute). Not suggested; never an error. */
  status: 'active' | 'legacy'
  /** The value the game uses when the attribute is left out, as written
   *  in a file, or null when unknown. */
  default: string | null
  required: boolean
  /** Free-text "Added in X" / "Removed in Y" note. Display-only. */
  versionNote: string | null
  /** The valid names for an `enum` (or a documented token), or null. */
  values: string[] | null
  /** Which class_name(s) an owner_ptr/link_ptr is expected to point to. */
  pointsTo: string[] | null
  /** File extension(s) expected for a file path, without the dot. */
  expectedExtensions: string[] | null
  supportsLocalization: boolean
  /** Engine/save-game managed, or SCS-only: not to be set by a modder. */
  internalOnly: boolean
  notes: string
  /** Which ancestor class this attribute was inherited from; absent for
   *  attributes the class defines itself. */
  inheritedFrom?: string
}

/**
 * The full per-class document fetched lazily from a manifest entry's
 * `url` — the flattened data/dist/v3 shape (inherited attributes already
 * merged in). Consumers should still treat any field as possibly
 * missing or malformed.
 */
export interface SchemaFileContent {
  meta: {
    version: string
    documentationStatus: SchemaDocumentationStatus
  }
  scope: string
  description: string
  superclass: string
  versionNote: string | null
  allowsSiiNunitRoot: boolean
  /** Root-first ancestor chain, e.g. ["accessory_data"]. Informational:
   *  `key` already has everything merged in. */
  inheritsFrom: string[]
  key: Record<string, SchemaAttributeDef>
}
