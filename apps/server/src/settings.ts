import type { SiiSeverity } from './interfaces/structure'
import type { FormatterOptions } from './formatter/format'

/**
 * Every scs-intellisense.* setting the server uses. The client sends all
 * of them at startup (initializationOptions.settings) and again whenever
 * any of them changes (scsIntellisense/updateSettings), so none of them
 * needs a window reload: handlers read the current values on every
 * request.
 */
export interface ServerSettings {
  enabledSeverities: SiiSeverity[]
  semanticHighlighting: boolean
  fetchTimeoutMs: number
  completionEnabled: boolean
  hoverEnabled: boolean
  formatterEnabled: boolean
  formatterBraceStyle: FormatterOptions['braceStyle']
  formatterIndentUnits: boolean
}

/** The same defaults as the client's package.json. */
export const DEFAULT_SETTINGS: ServerSettings = {
  enabledSeverities: ['error', 'warning', 'information', 'hint'],
  semanticHighlighting: true,
  fetchTimeoutMs: 8000,
  completionEnabled: false,
  hoverEnabled: false,
  formatterEnabled: false,
  formatterBraceStyle: '1tbs',
  formatterIndentUnits: true,
}

const SEVERITIES: SiiSeverity[] = ['error', 'warning', 'information', 'hint']

/** Settings as received, with every missing or malformed value replaced by
 *  its default: a hand-edited settings.json must not break the server. */
export function parseSettings(raw: unknown): ServerSettings {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >
  const bool = (key: keyof ServerSettings) =>
    typeof input[key] === 'boolean'
      ? (input[key] as boolean)
      : (DEFAULT_SETTINGS[key] as boolean)

  const severities = Array.isArray(input.enabledSeverities)
    ? input.enabledSeverities.filter((value): value is SiiSeverity =>
        SEVERITIES.includes(value as SiiSeverity)
      )
    : DEFAULT_SETTINGS.enabledSeverities
  const timeout = input.fetchTimeoutMs

  return {
    enabledSeverities: severities,
    semanticHighlighting: bool('semanticHighlighting'),
    fetchTimeoutMs:
      typeof timeout === 'number' && Number.isFinite(timeout) && timeout > 0
        ? timeout
        : DEFAULT_SETTINGS.fetchTimeoutMs,
    completionEnabled: bool('completionEnabled'),
    hoverEnabled: bool('hoverEnabled'),
    formatterEnabled: bool('formatterEnabled'),
    formatterBraceStyle:
      input.formatterBraceStyle === 'allman' ? 'allman' : '1tbs',
    formatterIndentUnits: bool('formatterIndentUnits'),
  }
}

/** One line for the log: what's on, at startup and after each change. */
export function describeSettings(settings: ServerSettings): string {
  const onOff = (enabled: boolean) => (enabled ? 'on' : 'off')
  return `completion: ${onOff(settings.completionEnabled)}, hover: ${onOff(settings.hoverEnabled)}, formatter: ${onOff(settings.formatterEnabled)}, highlighting: ${onOff(settings.semanticHighlighting)}`
}
