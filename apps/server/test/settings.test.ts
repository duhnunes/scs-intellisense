import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, parseSettings } from '../src/settings'

describe('settings', () => {
  it('uses the defaults when nothing is sent', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('nonsense')).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps every valid value', () => {
    const sent = {
      enabledSeverities: ['error', 'hint'],
      semanticHighlighting: false,
      fetchTimeoutMs: 2000,
      completionEnabled: true,
      hoverEnabled: true,
      formatterEnabled: true,
      formatterBraceStyle: 'allman',
      formatterIndentUnits: false,
    }
    expect(parseSettings(sent)).toEqual(sent)
  })

  it('replaces malformed values with their defaults', () => {
    // As a hand-edited settings.json might have them.
    const parsed = parseSettings({
      enabledSeverities: ['error', 'fatal', 3],
      semanticHighlighting: 'yes',
      fetchTimeoutMs: -5,
      formatterEnabled: 1,
      formatterBraceStyle: 'k&r',
    })
    expect(parsed).toEqual({
      ...DEFAULT_SETTINGS,
      enabledSeverities: ['error'],
    })
  })

  it('accepts no severities at all', () => {
    expect(parseSettings({ enabledSeverities: [] }).enabledSeverities).toEqual(
      []
    )
  })
})
