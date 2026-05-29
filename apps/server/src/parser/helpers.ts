export function findColonOutsideString(line: string): number {
  let inSingle = false
  let inDouble = false
  let escaped = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (!inDouble && ch === "'") {
      inSingle = !inSingle
      continue
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble
      continue
    }
    if (!inSingle && !inDouble && ch === ':') return i
  }
  return -1
}

export function findInlineCommentIndex(rawLine: string): number {
  let inSingle = false
  let inDouble = false
  let escaped = false
  for (let i = 0; i < rawLine.length; i++) {
    const ch = rawLine[i]
    const next = i + 1 < rawLine.length ? rawLine[i + 1] : ''
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (!inDouble && ch === '"') {
      inSingle = !inSingle
      continue
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble
      continue
    }
    if (!inSingle && !inDouble) {
      if (ch === '/' && next === '/') return i
      if (ch === '#') return i
    }
  }
  return -1
}
