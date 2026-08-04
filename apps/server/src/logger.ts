import type { Connection } from 'vscode-languageserver'

export type LogSeverity = 'error' | 'warning' | 'info'

export interface LogRange {
  start: number
  end: number
}

export interface LogPayload {
  timestamp: string
  severity: LogSeverity
  code?: string
  message: string
  details?: string
  file?: string
  range?: LogRange | null
}

export interface Logger {
  info(
    code: string | undefined,
    message: string,
    details?: string,
    file?: string,
    range?: LogRange | null
  ): void
  warn(
    code: string | undefined,
    message: string,
    details?: string,
    file?: string,
    range?: LogRange | null
  ): void
  error(
    code: string | undefined,
    message: string,
    details?: string,
    file?: string,
    range?: LogRange | null
  ): void
  /**
   * Same as warn(), but deduplicated per (file, code+message — or an
   * explicit `id`) and batched: repeated calls within a short window
   * collapse into a single notification instead of one per call. Meant
   * for warnings that could otherwise fire many times in a row (e.g.
   * once per line of a large file).
   */
  warnOnce(
    code: string | undefined,
    message: string,
    details?: string,
    file?: string,
    range?: LogRange | null,
    id?: string
  ): void
  /** Resets warnOnce's dedup memory for one file, or globally if
   *  omitted. Call this when a file closes, or its content changes
   *  enough that previously-reported warnings may no longer apply. */
  clearReportedForFile(file?: string): void
}

const BATCH_FLUSH_INTERVAL_MS = 5000

interface BatchedWarning {
  code: string
  message: string
  details?: string
  file?: string
}

let connection: Connection | undefined
const reportedOnce = new Map<string, Set<string>>()
const batchQueue: BatchedWarning[] = []
let flushTimer: NodeJS.Timeout | undefined

export function initLogger(conn: Connection): Logger {
  connection = conn
  return getLogger()
}

export function getLogger(): Logger {
  if (!connection) return consoleFallbackLogger

  const conn = connection
  return {
    info: (code, message, details, file, range) =>
      send(conn, 'info', code, message, details, file, range),
    warn: (code, message, details, file, range) =>
      send(conn, 'warning', code, message, details, file, range),
    error: (code, message, details, file, range) =>
      send(conn, 'error', code, message, details, file, range),
    warnOnce: (code, message, details, file, _range, id) =>
      queueWarnOnce(conn, code, message, details, file, id),
    clearReportedForFile,
  }
}

/**
 * The single place a log payload actually gets sent. Only through the
 * custom `scsIntellisense/log` notification — extension.ts formats and
 * writes it into the shared "SCS-Intellisense" output channel.
 *
 * Deliberately does NOT also call `connection.console.*`: the client
 * points its own LSP console at that same channel
 * (`LanguageClientOptions.outputChannel` in extension.ts), so doing both
 * printed every message twice, each with different formatting — that
 * was the original bug this file used to have.
 */
function send(
  conn: Connection,
  severity: LogSeverity,
  code: string | undefined,
  message: string,
  details?: string,
  file?: string,
  range?: LogRange | null
): void {
  const payload: LogPayload = {
    timestamp: new Date().toISOString(),
    severity,
    code,
    message,
    details,
    file,
    range,
  }
  try {
    conn.sendNotification('scsIntellisense/log', payload)
  } catch (err) {
    // The one case this DOES fall back to connection.console: the
    // notification channel itself is broken, so there's nowhere else
    // left to report that.
    conn.console.error(
      `[scs-intellisense] failed to send log notification: ${String(err)}`
    )
  }
}

function queueWarnOnce(
  conn: Connection,
  code: string | undefined,
  message: string,
  details: string | undefined,
  file: string | undefined,
  id: string | undefined
): void {
  const fileKey = file ?? '__global__'
  const dedupeKey = id ?? `${code ?? 'WARN'}:${message}`

  let seen = reportedOnce.get(fileKey)
  if (!seen) {
    seen = new Set()
    reportedOnce.set(fileKey, seen)
  }
  if (seen.has(dedupeKey)) return
  seen.add(dedupeKey)

  batchQueue.push({ code: code ?? 'WARN', message, details, file })
  scheduleFlush(conn)
}

function scheduleFlush(conn: Connection): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = undefined
    flushBatch(conn)
  }, BATCH_FLUSH_INTERVAL_MS)
}

function flushBatch(conn: Connection): void {
  if (batchQueue.length === 0) return
  const items = batchQueue.splice(0, batchQueue.length)
  send(
    conn,
    'warning',
    'BATCH_WARNINGS',
    `Batch of ${items.length} warning${items.length === 1 ? '' : 's'}`,
    items
      .map(
        (item) =>
          `${item.code}${item.file ? ` [${item.file}]` : ''} - ${item.message}${item.details ? `\n${item.details}` : ''}`
      )
      .join('\n\n')
  )
}

function clearReportedForFile(file?: string): void {
  reportedOnce.delete(file ?? '__global__')
}

/** Used only if something calls getLogger() before initLogger() has run
 *  — shouldn't happen in practice (server.ts always initializes first),
 *  but degrades to plain console output instead of throwing. */
const consoleFallbackLogger: Logger = {
  info: (code, message) =>
    console.log(`[scs-intellisense:fallback] ${code ?? ''} ${message}`),
  warn: (code, message) =>
    console.warn(`[scs-intellisense:fallback] ${code ?? ''} ${message}`),
  error: (code, message) =>
    console.error(`[scs-intellisense:fallback] ${code ?? ''} ${message}`),
  warnOnce: (code, message) =>
    console.warn(`[scs-intellisense:fallback:once] ${code ?? ''} ${message}`),
  clearReportedForFile: () => {},
}
