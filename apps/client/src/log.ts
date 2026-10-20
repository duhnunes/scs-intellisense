import * as vscode from 'vscode'

/** Mirrors LogEntry in the server's logger.ts. */
export interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warning' | 'error'
  code: string
  message: string
  details?: string
  file?: string
}

/** How many recent entries "Copy Bug Report Info" can include. */
const RECENT_LIMIT = 200

/**
 * The extension's log: the "SCS IntelliSense" channel in the Output panel.
 * It's a VS Code log channel, so every line carries a timestamp and a
 * level, and users choose which levels they see (the Output panel's level
 * filter, or "Developer: Set Log Level"). Server entries arrive through
 * the `scsIntellisense/log` notification; client code logs here directly.
 * The same conventions apply to both, see the server's logger.ts.
 */
export class ExtensionLog implements vscode.Disposable {
  readonly channel = vscode.window.createOutputChannel('SCS IntelliSense', {
    log: true,
  })

  /** Kept for bug reports, at every level, including the ones the user
   *  filtered out of the channel. */
  private readonly recent: string[] = []
  private shownForError = false

  write(entry: LogEntry): void {
    const file = entry.file ? ` [${displayPath(entry.file)}]` : ''
    const text = `${entry.code}${file} ${entry.message}${entry.details ? `\n${entry.details}` : ''}`

    switch (entry.level) {
      case 'debug':
        this.channel.debug(text)
        break
      case 'info':
        this.channel.info(text)
        break
      case 'warning':
        this.channel.warn(text)
        break
      case 'error':
        this.channel.error(text)
        break
    }
    this.remember(`${entry.timestamp} [${entry.level}] ${text}`)

    // Bring the log up once per session on the first error, so a problem
    // isn't silent, without popping it open again on every repeat.
    if (entry.level === 'error' && !this.shownForError) {
      this.shownForError = true
      this.channel.show(true)
    }
  }

  debug(code: string, message: string, details?: string): void {
    this.write({ timestamp: now(), level: 'debug', code, message, details })
  }

  info(code: string, message: string, details?: string): void {
    this.write({ timestamp: now(), level: 'info', code, message, details })
  }

  warn(code: string, message: string, details?: string): void {
    this.write({ timestamp: now(), level: 'warning', code, message, details })
  }

  error(code: string, message: string, error?: unknown): void {
    this.write({
      timestamp: now(),
      level: 'error',
      code,
      message,
      details: error === undefined ? undefined : describeError(error),
    })
  }

  /** A line of a command's report (Check Formatting, Format All Files):
   *  not an event with a code, just output the user asked for. */
  reportLine(text: string): void {
    this.channel.info(text)
    this.remember(`${now()} [report] ${text}`)
  }

  recentEntries(): readonly string[] {
    return this.recent
  }

  clear(): void {
    this.channel.clear()
    this.recent.length = 0
  }

  dispose(): void {
    this.channel.dispose()
  }

  private remember(line: string): void {
    this.recent.push(line)
    if (this.recent.length > RECENT_LIMIT) this.recent.shift()
  }
}

export function describeError(error: unknown): string {
  return error instanceof Error && error.stack ? error.stack : String(error)
}

function now(): string {
  return new Date().toISOString()
}

/** Workspace-relative when possible: shorter, and doesn't put the user's
 *  folder names into a bug report they paste publicly. */
function displayPath(uri: string): string {
  try {
    return vscode.workspace.asRelativePath(vscode.Uri.parse(uri))
  } catch {
    return uri
  }
}
