import type { Connection } from 'vscode-languageserver';
import { createLogger as createServerLogger } from './errors';

type Logger = ReturnType<typeof createServerLogger>;

let _logger: Logger | null = null;

const reported = new Map<string, Set<string>>();

const batchQueue: any[] = [];
let flushTimer: NodeJS.Timeout | null = null;
const flushIntervalMs = 5000; // 5s

function scheduleFlush(connection?: Connection) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (batchQueue.length === 0) return;
    const items = batchQueue.splice(0, batchQueue.length);
    // send a single notification with the batch summary
    try {
      if (connection) {
        connection.sendNotification('scsIntellisense/log', {
          timestamp: new Date().toISOString(),
          severity: 'warning',
          code: 'BATCH_WARNINGS',
          message: `Batch of ${items.length} warnings`,
          details: items.map(i => `${i.code} ${i.file ? '[' + i.file + ']' : ''} - ${i.message}${i.details ? `\n${i.details}` : ''}`).join('\n\n')
        });
      } else {
        // fallback to console
        console.warn('[sii:logger] batch warnings:\n' + items.map(i => `${i.code} ${i.file ?? ''} - ${i.message}`).join('\n'));
      }
    } catch (e) {
      console.error('[sii:logger] failed to flush batch', e);
    }
  }, flushIntervalMs);
}

export function initLogger(connection: Connection) {
  if (!_logger) {
    _logger = createServerLogger(connection);
    (_logger as any)._connection = connection
  }
  return _logger;
}

export function getLogger() {
  if (_logger) {
    const connection = (_logger as any)._connection as Connection | undefined;
    return {
      info: _logger.info.bind(_logger),
      warn: _logger.warn.bind(_logger),
      error: _logger.error.bind(_logger),

      warnOnce(code: string | undefined, message: string, details?: string, file?: string, range?: { start: number; end: number } | null, id?: string) {
        const fileKey = file ?? '__global__';
        const key = id ?? `${code ?? 'WARN'}:${message}`;
        let set = reported.get(fileKey);
        if (!set) {
          set = new Set<string>();
          reported.set(fileKey, set);
        }
        if (set.has(key)) return;
        set.add(key);

        batchQueue.push({ code: code ?? 'WARN', message, details, file, range });
        scheduleFlush((_logger as any)?._connection ?? undefined);
      },

      clearReportedForFile(file?: string) {
        const fileKey = file ?? '__global__';
        reported.delete(fileKey);
      }
    } as Logger & { warnOnce: (code: string|undefined, message: string, details?: string, file?: string, range?: {start:number;end:number}|null, id?:string) => void, clearReportedForFile?: (file?:string)=>void };
  }

  return {
    info: (code: string | undefined, message: string, details?: string, file?: string, range?: { start: number; end: number } | null) => {
      try { console.log(`[sii:logger:fallback] ${code ?? ''} ${message}`); } catch (e) {}
    },
    warn: (code: string | undefined, message: string, details?: string, file?: string, range?: { start: number; end: number } | null) => {
      try { console.warn(`[sii:logger:fallback] ${code ?? ''} ${message}`); } catch (e) {}
    },
    error: (code: string | undefined, message: string, details?: string, file?: string, range?: { start: number; end: number } | null) => {
      try { console.error(`[sii:logger:fallback] ${code ?? ''} ${message}`); } catch (e) {}
    },
    warnOnce: (code: string | undefined, message: string, details?: string, file?: string, range?: { start: number; end: number } | null, id?: string) => {
      try { console.warn(`[sii:logger:fallback:once] ${code ?? ''} ${message}`); } catch (e) {}
    },
    clearReportedForFile: (file?: string) => {}
  } as any;
}
