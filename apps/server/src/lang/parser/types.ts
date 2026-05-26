import type { AttributeDef, SiiClass, SiiFile } from '@/src/@types/structure'

export enum ScsFileExt {
  SII = '.sii',
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
  bodyStart: number
  bodyEnd: number
}

export interface ParsedFile extends SiiFile {
  classes: ParsedClass[]
}
