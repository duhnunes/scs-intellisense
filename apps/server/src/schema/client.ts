import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  SchemaFileContent,
  SchemaManifest,
  SchemaManifestEntry,
} from '../interfaces/schemas'

const DEFAULT_MANIFEST_URL =
  'https://raw.githubusercontent.com/duhnunes/scs-schema/refs/heads/master/data/manifest.json'

const MANIFEST_CACHE_FILE = 'manifest.json'
const SCHEMAS_CACHE_DIR = 'schemas'

export interface SchemaClientLogger {
  info(message: string): void
  warn(message: string): void
  error(message: string, details?: string): void
}

export interface SchemaClientOptions {
  /** Where cached manifest/schema files live. Usually the extension's
   *  globalStorage path, passed down from the client via
   *  initializationOptions — this process has no `vscode` API of its own. */
  cacheDir: string
  manifestUrl?: string
  logger?: SchemaClientLogger
  /** Injectable for tests; defaults to the platform's global fetch. */
  fetchImpl?: typeof fetch
}

const noopLogger: SchemaClientLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
}

/**
 * Fetches, caches, and serves the scs-schema database. This is the ONLY
 * place in the server that talks to the manifest or the CDN — completion,
 * hover, and future attribute validation all consult it instead of
 * fetching anything themselves.
 *
 * Two very different things are cached here, deliberately:
 *  - manifest.json: small, changes daily, always re-checked (never
 *    trusted as permanently fresh).
 *  - individual schema files: fetched lazily (only once something
 *    actually needs a class's full attribute list), and cached forever
 *    once fetched — their URLs are pinned to a commit SHA, so the same
 *    URL can never return different content.
 */
export class SchemaClient {
  private readonly cacheDir: string
  private readonly manifestUrl: string
  private readonly logger: SchemaClientLogger
  private readonly fetchImpl: typeof fetch

  private manifest: SchemaManifest | undefined
  private readonly inFlightSchemaFetches = new Map<
    string,
    Promise<SchemaFileContent | undefined>
  >()

  constructor(options: SchemaClientOptions) {
    this.cacheDir = options.cacheDir
    this.manifestUrl = options.manifestUrl ?? DEFAULT_MANIFEST_URL
    this.logger = options.logger ?? noopLogger
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  /**
   * Loads whatever manifest is already on disk (if any) so consumers have
   * something to work with immediately, even before — or without — a
   * successful network fetch this session. Does not hit the network.
   */
  async init(): Promise<void> {
    await mkdir(this.schemasDir(), { recursive: true })

    const cached = await this.readJsonFile<SchemaManifest>(
      this.manifestCachePath()
    )
    if (cached) {
      this.manifest = cached
      this.logger.info(
        `Loaded cached schema manifest (version ${cached.version}, ${Object.keys(cached.schemas).length} classes)`
      )
    } else {
      this.logger.info('No cached schema manifest on disk yet')
    }
  }

  /** The most recently loaded manifest, or undefined if none has ever
   *  been loaded (fresh install, first run, no network yet). Never
   *  triggers a fetch — always returns immediately. */
  getManifest(): SchemaManifest | undefined {
    return this.manifest
  }

  /** class_name -> its manifest entry (scope, description, url, hash...).
   *  No network involved — completion/hover for class_name itself is
   *  free once the manifest is loaded. */
  getSchemaEntry(className: string): SchemaManifestEntry | undefined {
    return this.manifest?.schemas[className]
  }

  /**
   * Re-fetches manifest.json from GitHub. Safe to call often — on a
   * failed fetch, the existing in-memory/on-disk manifest is left
   * untouched (a network hiccup should never blank out completion).
   * Returns true if the manifest actually changed.
   */
  async refreshManifest(force = false): Promise<boolean> {
    let response: Response
    try {
      response = await this.fetchImpl(this.manifestUrl, {
        cache: 'no-store',
      })
    } catch (err) {
      this.logger.warn(
        `Schema manifest fetch failed (offline?): ${String(err)}`
      )
      return false
    }

    if (!response.ok) {
      this.logger.warn(
        `Schema manifest fetch returned ${response.status} ${response.statusText}`
      )
      return false
    }

    let incoming: SchemaManifest
    try {
      incoming = (await response.json()) as SchemaManifest
    } catch (err) {
      this.logger.error(
        'Schema manifest response was not valid JSON',
        String(err)
      )
      return false
    }

    if (!force && !manifestHasChanged(this.manifest, incoming)) {
      this.logger.info('Schema manifest unchanged, skipping cache write')
      return false
    }

    this.manifest = incoming
    try {
      await writeFile(
        this.manifestCachePath(),
        JSON.stringify(incoming),
        'utf8'
      )
    } catch (err) {
      // The fetch succeeded and we're serving the new manifest from
      // memory either way — failing to persist it to disk just means
      // next session starts cold again. Worth logging, not fatal.
      this.logger.warn(`Failed to persist schema manifest to disk: ${err}`)
    }

    this.logger.info(
      `Schema manifest updated to version ${incoming.version} (${Object.keys(incoming.schemas).length} classes)`
    )

    // Content-addressed cache files are never overwritten in place (see
    // schemaCacheFileName) — safe against a crash mid-write, but it also
    // means an updated or removed class just leaves its old cached file
    // behind forever unless something cleans up. Now that the manifest
    // just changed, this is the one moment that's actually true: sweep
    // out anything on disk that no current entry points to.
    await this.pruneStaleSchemaCache()

    return true
  }

  /**
   * Lazily fetches (or serves from cache) the full schema document for
   * one class_name. This is the only method that hits the per-class CDN
   * URL, and only ever for classes something actually asked about.
   * Concurrent requests for the same class share one in-flight fetch.
   */
  async getSchemaContent(
    className: string
  ): Promise<SchemaFileContent | undefined> {
    const entry = this.getSchemaEntry(className)
    if (!entry) return undefined

    const cached = await this.readJsonFile<SchemaFileContent>(
      this.schemaCachePath(entry)
    )
    if (cached) return cached

    const inFlight = this.inFlightSchemaFetches.get(entry.hash)
    if (inFlight) return inFlight

    const fetchPromise = this.fetchAndCacheSchema(entry).finally(() => {
      this.inFlightSchemaFetches.delete(entry.hash)
    })
    this.inFlightSchemaFetches.set(entry.hash, fetchPromise)
    return fetchPromise
  }

  private async fetchAndCacheSchema(
    entry: SchemaManifestEntry
  ): Promise<SchemaFileContent | undefined> {
    let response: Response
    try {
      response = await this.fetchImpl(entry.url)
    } catch (err) {
      this.logger.warn(
        `Schema fetch failed for "${entry.name}" (offline?): ${String(err)}`
      )
      return undefined
    }

    if (!response.ok) {
      this.logger.warn(
        `Schema fetch for "${entry.name}" returned ${response.status} ${response.statusText}`
      )
      return undefined
    }

    let content: SchemaFileContent
    try {
      content = (await response.json()) as SchemaFileContent
    } catch (err) {
      this.logger.error(
        `Schema response for "${entry.name}" was not valid JSON`,
        String(err)
      )
      return undefined
    }

    try {
      await writeFile(
        this.schemaCachePath(entry),
        JSON.stringify(content),
        'utf8'
      )
    } catch (err) {
      // Same reasoning as the manifest: still serve it from memory this
      // session even if we couldn't persist it.
      this.logger.warn(
        `Failed to persist schema cache for "${entry.name}": ${err}`
      )
    }

    return content
  }

  private manifestCachePath(): string {
    return path.join(this.cacheDir, MANIFEST_CACHE_FILE)
  }

  private schemasDir(): string {
    return path.join(this.cacheDir, SCHEMAS_CACHE_DIR)
  }

  private schemaCachePath(entry: SchemaManifestEntry): string {
    return path.join(this.schemasDir(), this.schemaCacheFileName(entry))
  }

  private schemaCacheFileName(entry: SchemaManifestEntry): string {
    // Keyed by hash, not by name: content-addressed, so a schema update
    // (new hash) never serves stale cached content under the old name.
    // This does mean the old file becomes orphaned once the hash
    // changes — pruneStaleSchemaCache() is what actually cleans those up.
    const safeHash = entry.hash.replace(/[^a-zA-Z0-9]/g, '_')
    return `${entry.name}.${safeHash}.json`
  }

  /**
   * Deletes any cached schema file that no longer corresponds to a
   * current manifest entry — either its class was updated (new hash, old
   * file orphaned) or removed from the manifest entirely (no entry
   * points to it anymore). Only called right after a manifest change, so
   * a file matching the CURRENT hash of a class that hasn't changed is
   * never touched — that content is still exactly as valid as when it
   * was fetched.
   */
  private async pruneStaleSchemaCache(): Promise<void> {
    if (!this.manifest) return

    const expectedFileNames = new Set(
      Object.values(this.manifest.schemas).map((entry) =>
        this.schemaCacheFileName(entry)
      )
    )

    let cachedFileNames: string[]
    try {
      cachedFileNames = await readdir(this.schemasDir())
    } catch (err) {
      this.logger.warn(`Failed to list schema cache dir for pruning: ${err}`)
      return
    }

    const staleFileNames = cachedFileNames.filter(
      (fileName) =>
        fileName.endsWith('.json') && !expectedFileNames.has(fileName)
    )
    if (staleFileNames.length === 0) return

    await Promise.all(
      staleFileNames.map(async (fileName) => {
        try {
          await unlink(path.join(this.schemasDir(), fileName))
        } catch (err) {
          this.logger.warn(
            `Failed to remove stale schema cache file "${fileName}": ${err}`
          )
        }
      })
    )

    this.logger.info(
      `Pruned ${staleFileNames.length} stale schema cache file(s)`
    )
  }

  private async readJsonFile<T>(filePath: string): Promise<T | undefined> {
    try {
      const raw = await readFile(filePath, 'utf8')
      return JSON.parse(raw) as T
    } catch {
      return undefined
    }
  }
}

/**
 * Whether the incoming manifest is actually different from what's
 * currently loaded. Compared by `version` (bumped by scs-schema's own CI
 * on every real change) rather than deep-diffing every entry.
 */
export function manifestHasChanged(
  current: SchemaManifest | undefined,
  incoming: SchemaManifest
): boolean {
  if (!current) return true
  return current.version !== incoming.version
}
