export {
  maskSiiComments,
  normalizeSiiText,
  readScsDocument,
  readSiiDocument,
  scanSiiComments,
} from './reader'
export {
  collectSiiValueParts,
  inferSiiValueType,
  isNumericValueType,
} from './value'
export type {
  ReadSiiOptions,
  SiiAttribute,
  SiiComment,
  SiiCommentKind,
  SiiDocument,
  SiiIssue,
  SiiMagicMark,
  SiiRange,
  SiiUnit,
  SiiValuePart,
  SiiValueType,
} from '../interfaces/structure'
