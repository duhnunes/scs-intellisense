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
const DEFAULT_NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000
const DEFAULT_FETCH_TIMEOUT_MS = 8000

/** Sentinel used only internally to tell "the wait timed out" apart from
 *  "the fetch resolved to undefined" when racing the two. */
const TIMED_OUT = Symbol('scs-schema-fetch-timed-out')

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
  /** How long a failed schema fetch is remembered before retrying, even
   *  if the manifest's hash for that class hasn't changed. Default 5
   *  minutes. Configurable mainly so tests don't have to wait 5 real
   *  minutes. */
  negativeCacheTtlMs?: number
  /** How long a single getSchemaContent() call waits for a fetch before
   *  giving up on THIS request only. The underlying fetch is never
   *  cancelled — it keeps running in the background and still gets
   *  cached (or negative-cached) whenever it actually resolves, so the
   *  next request benefits even if this one didn't. Default 8s. */
  fetchTimeoutMs?: number
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
  private readonly negativeCacheTtlMs: number
  private readonly fetchTimeoutMs: number

  private manifest: SchemaManifest | undefined
  private readonly inFlightSchemaFetches = new Map<
    string,
    Promise<SchemaFileContent | undefined>
  >()
  /** hash -> when the fetch for that exact content last failed. Keyed by
   *  hash (not className) so a real fix in scs-schema — which always
   *  produces a new hash, since CDN URLs are pinned to a commit SHA —
   *  clears this automatically, with no TTL needed for that case. The
   *  TTL below only covers a *transient* failure (e.g. the CDN edge
   *  hiccuping) where the hash never changed at all. */
  private readonly failedSchemaFetches = new Map<string, number>()

  constructor(options: SchemaClientOptions) {
    this.cacheDir = options.cacheDir
    this.manifestUrl = options.manifestUrl ?? DEFAULT_MANIFEST_URL
    this.logger = options.logger ?? noopLogger
    this.fetchImpl = options.fetchImpl ?? fetch
    this.negativeCacheTtlMs =
      options.negativeCacheTtlMs ?? DEFAULT_NEGATIVE_CACHE_TTL_MS
    this.fetchTimeoutMs = options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
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
    if (force) {
      // A forced refresh means "check again right now" — that intent
      // should also cover schemas that failed before, not just the
      // manifest itself. Otherwise the manual command wouldn't actually
      // retry a schema still within its cooldown.
      this.failedSchemaFetches.clear()
    }

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

    const failedAt = this.failedSchemaFetches.get(entry.hash)
    if (failedAt !== undefined) {
      const age = Date.now() - failedAt
      if (age < this.negativeCacheTtlMs) {
        // Still within the cooldown for this exact content (same hash)
        // — don't hammer the CDN again on every keystroke for something
        // that just failed. A hash change (a real scs-schema fix) skips
        // this entirely, since it's a different key.
        return undefined
      }
      // Cooldown expired — worth trying again in case it was transient.
      this.failedSchemaFetches.delete(entry.hash)
    }

    const inFlight = this.inFlightSchemaFetches.get(entry.hash)
    const workPromise =
      inFlight ??
      this.fetchAndCacheSchema(entry)
        .then((content) => {
          // fetchAndCacheSchema() returns undefined for every failure
          // case (network error, non-ok response, invalid JSON) — one
          // place to record the outcome, rather than instrumenting each
          // of those branches individually.
          if (content) this.failedSchemaFetches.delete(entry.hash)
          else this.failedSchemaFetches.set(entry.hash, Date.now())
          return content
        })
        .finally(() => {
          this.inFlightSchemaFetches.delete(entry.hash)
        })

    if (!inFlight) this.inFlightSchemaFetches.set(entry.hash, workPromise)

    // This bounds how long THIS specific request waits — it does not
    // cancel workPromise. A fetch that's simply slow, or a connection
    // that never responds at all (proxies can swallow a request without
    // ever erroring), would otherwise block every completion request
    // for that class indefinitely, including ones that arrive later.
    // workPromise keeps running regardless, still lands in the disk
    // cache (or the negative cache) whenever it actually resolves, so
    // the next request after this one benefits either way.
    const result = await Promise.race([
      workPromise,
      this.waitTimedOut(this.fetchTimeoutMs),
    ])

    if (result === TIMED_OUT) {
      this.logger.warn(
        `Schema fetch for "${entry.name}" is taking longer than ${this.fetchTimeoutMs}ms — giving up on this request only; it'll still be cached once it finishes`
      )
      return undefined
    }

    return result
  }

  private waitTimedOut(ms: number): Promise<typeof TIMED_OUT> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(TIMED_OUT), ms)
    })
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

    const expectedHashes = new Set(
      Object.values(this.manifest.schemas).map((entry) => entry.hash)
    )
    for (const hash of this.failedSchemaFetches.keys()) {
      if (!expectedHashes.has(hash)) this.failedSchemaFetches.delete(hash)
    }

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
