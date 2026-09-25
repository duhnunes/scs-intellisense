/**
 * One entry in scs-schema's manifest.json — one per class_name.
 * `superclass`/`documentationStatus` come free with the manifest (no
 * fetch needed), so completion/hover for class_name itself can show
 * "extends X" or a WIP warning without ever touching the per-class URL
 * — only the full attribute list (fetched lazily from `url`) needs
 * that.
 */
export interface SchemaManifestEntry {
  name: string
  description: string
  url: string
  hash: string
  metaVersion: string
  size: number
  /** Direct parent class only, or null for a root class (the source
   *  file's superclass was the literal "unit"). */
  superclass: string | null
  documentationStatus: 'wip' | 'complete'
}

export interface SchemaManifest {
  formatVersion: string
  generatedAt: string
  schemas: Record<string, SchemaManifestEntry>
}

/**
 * One attribute definition inside a schema file's `key` map — the full
 * scs-schema v2 shape (12 fields), not the earlier 4-field version.
 *
 * `type` and `arrayElementType` are NOT mutually exclusive — see
 * CONTRIBUTING.md in scs-schema for the full "scalar-only / array-only /
 * counted-array" breakdown. `isArray` is true whenever the attribute
 * supports either array form; `type` alone still describes the scalar
 * form when one also exists.
 */
export interface SchemaAttributeDef {
  description: string
  type: string[] | null
  isArray: boolean
  arrayElementType: string[] | null
  required: boolean
  /** Free-text "Added in X" / "Removed in Y" note, exactly as the wiki
   *  phrases it. Display-only — never compared programmatically. */
  versionNote: string | null
  /** Valid literal values, for a `token` attribute the wiki enumerates.
   *  null for any other type, or when not documented. */
  values: string[] | null
  /** Which class_name(s) an owner_ptr/link_ptr is expected to point to,
   *  when the wiki names them. */
  pointsTo: string[] | null
  /** File extension(s) expected, without the leading dot, for ANY
   *  attribute whose value is a file path — not just resource_tie ones
   *  (most such attributes are typed 'string', see scs-schema's docs). */
  expectedExtensions: string[] | null
  /** True only if the description explicitly mentions the
   *  @@localization@@ template syntax. */
  supportsLocalization: boolean
  /** True if the wiki says this is engine/save-game managed and
   *  shouldn't be set manually in a definition. */
  internalOnly: boolean
  notes: string
  /** Only present in the flattened data/dist/ output (never in a
   *  hand-authored source file) — which ancestor class this attribute
   *  was inherited from. Absent for attributes the class defines
   *  itself. */
  inheritedFrom?: string
}

/** A family of attributes the docs describe collectively instead of
 *  naming individually (e.g. accessory_interior_data's ~70 interior
 *  animation attributes). Rare — most classes have an empty array here. */
export interface SchemaDynamicAttributeGroup {
  pattern: string
  description: string
  type: string[] | null
  notes: string
  inheritedFrom?: string
}

/**
 * The full per-class schema document fetched lazily from a manifest
 * entry's `url` — always the flattened data/dist/ shape (inherited
 * attributes already merged in), never the hand-authored source shape.
 * The database isn't 100% populated yet, so consumers should treat
 * every field here as possibly missing or malformed on any given class,
 * not just absent entirely.
 */
export interface SchemaFileContent {
  meta: {
    version: string
    documentationStatus: 'wip' | 'complete'
  }
  scope: string
  description: string
  superclass: string
  versionNote: string | null
  allowsSiiNunitRoot: boolean
  /** Root-first ancestor chain, e.g. ["accessory_data",
   *  "accessory_addon_data"] — informational, consumers don't need to
   *  walk it themselves since `key` already has everything merged in. */
  inheritsFrom: string[]
  key: Record<string, SchemaAttributeDef>
  dynamicAttributeGroups: SchemaDynamicAttributeGroup[]
}
