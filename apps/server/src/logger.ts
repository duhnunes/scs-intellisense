import type { Connection } from 'vscode-languageserver'

/**
 * Log levels, lowest first. The client writes each entry at its level into
 * the "SCS IntelliSense" log channel, and users choose which levels they
 * see there (the level filter of the Output panel, or "Developer: Set Log
 * Level"). By default VS Code shows info and above.
 *
 * - debug: details useful when hunting a bug, noise otherwise (a format
 *   skipped because the file is mid-edit, a cache that didn't change).
 * - info: things a user may want to know happened (server started, schema
 *   database updated).
 * - warning: something didn't work, but the extension carries on (a fetch
 *   failed while offline).
 * - error: something broke; include the stack in `details`.
 */
export type LogLevel = 'debug' | 'info' | 'warning' | 'error'

/** What travels to the client in the `scsIntellisense/log` notification. */
export interface LogEntry {
  timestamp: string
  level: LogLevel
  /** AREA_EVENT in upper snake case, e.g. SCHEMA_FETCH_FAILED. Stable and
   *  searchable: a bug report can be matched to the code that wrote it. */
  code: string
  /** One sentence: what happened, and why when it's known. */
  message: string
  /** Technical extra, such as a stack trace. Shown under the message. */
  details?: string
  /** URI of the file involved, if any. */
  file?: string
}

type LogFunction = (
  code: string,
  message: string,
  details?: string,
  file?: string
) => void

export interface Logger {
  debug: LogFunction
  info: LogFunction
  warn: LogFunction
  error: LogFunction
}

let connection: Connection | undefined

export function initLogger(conn: Connection): Logger {
  connection = conn
  return getLogger()
}

export function getLogger(): Logger {
  return {
    debug: (...args) => send('debug', ...args),
    info: (...args) => send('info', ...args),
    warn: (...args) => send('warning', ...args),
    error: (...args) => send('error', ...args),
  }
}

/** The stack trace when there is one, so an error log points at the line
 *  that failed; otherwise the value as text. */
export function describeError(error: unknown): string {
  return error instanceof Error && error.stack ? error.stack : String(error)
}

/**
 * The single place a log entry is sent: only through the custom
 * `scsIntellisense/log` notification, which the client writes into the log
 * channel. It deliberately does NOT also call `connection.console.*`: the
 * LSP client prints that console into the same channel, so doing both
 * printed every message twice.
 */
function send(
  level: LogLevel,
  code: string,
  message: string,
  details?: string,
  file?: string
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    code,
    message,
    details,
    file,
  }

  if (!connection) {
    // Only before initLogger() has run, which server.ts does first thing.
    console.error(`[scs-intellisense] ${level} ${code} ${message}`)
    return
  }

  try {
    connection.sendNotification('scsIntellisense/log', entry)
  } catch (error) {
    // The notification channel itself is broken: the LSP console is the
    // only place left to report it.
    connection.console.error(
      `[scs-intellisense] failed to send log entry ${code}: ${String(error)}`
    )
  }
}
