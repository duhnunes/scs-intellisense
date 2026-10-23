import type { PathRef } from './workspaceIndex'

/**
 * The file paths in a .mat or a text .tobj, so they follow a moved file
 * like the paths of .sii/.sui do. These formats aren't SII (a .mat nests
 * blocks, a .tobj is lines of words), and only their paths matter here,
 * so each gets a small line scanner instead of the reader.
 *
 * .mat, both formats in use: the game's (`texture : "texture_base" {
 * source : "/material/.../x.tobj" }`, 67,089 files in ATS 1.61) and the
 * older one mods still write (`texture : "welker.tobj"`, `texture[0] :
 * "/material/..."`). A path is the value of `source`, `texture` or
 * `texture[n]` that ends in a texture's extension: `texture` also holds
 * names (`"texture_base"`), and `material : "eut2.dif"` is a shader.
 *
 * .tobj in text, as SCS Blender Tools exports them (`map 2d house_a.tga`):
 * the words after `map <type>`. A compiled .tobj is binary and never gets
 * here (decodeSiiFile refuses it).
 */

const MAT_PATH = /^(\s*(?:source|texture(?:\[\d*\])?)\s*:\s*")([^"]*)"/
const TEXTURE_FILE = /\.(tobj|dds|tga|png|jpe?g|bmp)$/i
const TOBJ_MAP = /^(\s*map\s+\S+\s+)(.*)$/

/** `text` is normalized (LF line breaks): ranges are offsets into it. */
export function texturePathRefs(filePath: string, text: string): PathRef[] {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.mat')) return scanLines(text, matLine)
  if (lower.endsWith('.tobj')) return scanLines(text, tobjLine)
  return []
}

function scanLines(
  text: string,
  read: (line: string, offset: number) => PathRef[]
): PathRef[] {
  const refs: PathRef[] = []
  let offset = 0
  for (const line of text.split('\n')) {
    const trimmed = line.trimStart()
    if (!trimmed.startsWith('#') && !trimmed.startsWith('//'))
      refs.push(...read(line, offset))
    offset += line.length + 1
  }
  return refs
}

function matLine(line: string, offset: number): PathRef[] {
  const match = MAT_PATH.exec(line)
  if (!match || !TEXTURE_FILE.test(match[2]!)) return []
  const start = offset + match[1]!.length
  return [
    {
      kind: 'file',
      text: match[2]!,
      range: { start, end: start + match[2]!.length },
    },
  ]
}

function tobjLine(line: string, offset: number): PathRef[] {
  const match = TOBJ_MAP.exec(line)
  if (!match) return []
  const refs: PathRef[] = []
  // Each word after the type: one file for a 2d map, six for a cube.
  const words = /"([^"]+)"|(\S+)/g
  let word: RegExpExecArray | null
  while ((word = words.exec(match[2]!))) {
    const value = word[1] ?? word[2]!
    if (!TEXTURE_FILE.test(value)) continue
    const start =
      offset + match[1]!.length + word.index + (word[1] !== undefined ? 1 : 0)
    refs.push({
      kind: 'file',
      text: value,
      range: { start, end: start + value.length },
    })
  }
  return refs
}
