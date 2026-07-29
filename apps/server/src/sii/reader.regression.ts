import { readScsDocument } from './reader'

const document = readScsDocument('SiiNunit\n{\nclass_name\n', 'sii')
const unit = document.units[0]

if (!unit) {
  throw new Error(
    'Expected parser to produce a partial unit for an incomplete class header'
  )
}

if (unit.className !== 'class_name') {
  throw new Error(`Expected className to be parsed, got ${unit.className}`)
}

if (
  unit.classNameRange.start !== 0 ||
  unit.classNameRange.end !== 'class_name'.length
) {
  throw new Error('Expected classNameRange to cover the typed class name')
}

console.log('reader regression ok')
