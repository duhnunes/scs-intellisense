import type { Connection } from "vscode-languageserver"

export type Severirty = 'error' | 'warning' | 'info'

export interface LogPayload {
  timestamp: string       // ISO timestamp
  severity: Severirty
  code?: string           // short error code, ex: "PARSE_ATTR_RANGE"
  message: string         // short human message
  details?: string        // optional long text / stack
  file?: string           // optional document URI
  range?: { start: number; end: number } | null     // optional absolute offsets
}

export function createLogger(connection: Connection) {
  function sendNotification(payload: LogPayload) {
    try {
      connection.sendNotification('scsIntellisense/log', payload)
    } catch (err) {
      connection.console.error(`[scs-intel] failed to send log notification: ${(err as Error).message}`)
    }
  }

  function formatForConsole(p: LogPayload) {
    const loc = p.file ? `[${p.file}${p.range ? `:${p.range.start}-${p.range.end}` : ''}]` : ''
    return `[${p.timestamp}] ${p.severity.toUpperCase()}: ${p.code ? `${p.code}` : ''}${loc} - ${p.message}${p.details ? `\n${p.details}` : ''}`
  }

  return {
    info(code: string | undefined, message: string, details?: string, file?: string, range?: { start: number; end: number } | null) {
      const payload: LogPayload = { timestamp: new Date().toISOString(), severity: 'info', code, message, details, file, range };
      connection.console.log(formatForConsole(payload));
      sendNotification(payload);
    },
    warn(code: string | undefined, message: string, details?: string, file?: string, range?: { start: number; end: number } | null) {
      const payload: LogPayload = { timestamp: new Date().toISOString(), severity: 'warning', code, message, details, file, range };
      connection.console.warn(formatForConsole(payload));
      sendNotification(payload);
    },
    error(code: string | undefined, message: string, details?: string, file?: string, range?: { start: number; end: number } | null) {
      const payload: LogPayload = { timestamp: new Date().toISOString(), severity: 'error', code, message, details, file, range };
      connection.console.error(formatForConsole(payload));
      sendNotification(payload);
    }
  };
}
