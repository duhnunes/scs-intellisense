import type { AttributeDef, SiiClass } from '@/src/interfaces/structure'

export enum ScsFileExt {
  // eslint-disable-next-line no-unused-vars
  SII = '.sii',
  // eslint-disable-next-line no-unused-vars
  SUI = '.sui',
}

export type ScsFileMode = 'sii' | 'sui' | 'unknown'

export interface ParseOptions {
  uri?: string
  ext?: string
  mode?: ScsFileMode
  normalizeLineEndings?: boolean
}

export interface ParsedAttribute extends AttributeDef {
  keyRange: { start: number; end: number }
  valueRange: { start: number; end: number }
}

export interface ParsedClass extends SiiClass {
  attributes: ParsedAttribute[]
  classNameStart: number
  classNameEnd: number
  unitNameStart: number
  unitNameEnd: number
  colonPos?: number
  bodyStart: number
  bodyEnd: number
  range?: { start: number; end: number }
}
