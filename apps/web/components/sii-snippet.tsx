import type { ReactNode } from 'react'

// Colors a short .sii/.sui excerpt for the homepage cards. The docs' code
// blocks use the full TextMate grammar (grammars/); these few lines only need
// the same colors, set in rdx.css (.sii-*), so a line-by-line match is enough.

type Token = [className: string, text: string]

const VALUE = /("[^"]*")|(-?\d+(?:\.\d+)?)|([A-Za-z_@][\w.@]*)|([^"\w@-]+|-)/g

function value(text: string): Token[] {
  const tokens: Token[] = []
  for (const m of text.matchAll(VALUE)) {
    if (m[1]) tokens.push(['sii-string', m[1]])
    else if (m[2]) tokens.push(['sii-number', m[2]])
    else if (m[3])
      tokens.push([
        m[3] === 'true' || m[3] === 'false' ? 'sii-number' : 'sii-word',
        m[3],
      ])
    else tokens.push(['', m[0]])
  }
  return tokens
}

function tokenize(line: string): Token[] {
  let m: RegExpMatchArray | null
  if ((m = line.match(/^(\s*)(SiiNunit)$/)))
    return [
      ['', m[1]],
      ['sii-magic', m[2]],
    ]
  if ((m = line.match(/^(\s*)(@include)(\s+)(.*)$/)))
    return [['', m[1]], ['sii-magic', m[2]], ['', m[3]], ...value(m[4])]
  if ((m = line.match(/^(\s*)(#.*)$/)))
    return [
      ['', m[1]],
      ['sii-comment', m[2]],
    ]
  if ((m = line.match(/^(\s*)([\w:]+)( )(:)( )([\w.]+)(.*)$/)))
    return [
      ['', m[1]],
      ['sii-class', m[2]],
      ['', m[3]],
      ['sii-colon', m[4]],
      ['', m[5]],
      ['', m[6]],
      ['', m[7]],
    ]
  if ((m = line.match(/^(\s*)([\w[\]]+)(:)(\s*)(.*)$/)))
    return [
      ['', m[1]],
      ['sii-key', m[2]],
      ['sii-colon', m[3]],
      ['', m[4]],
      ...value(m[5]),
    ]
  return [['', line]]
}

/**
 * `mark` wraps the first token equal to it: `squiggle` (a warning's wavy
 * underline) or `hover` (the word under the mouse). `after` puts a node
 * (a tooltip) right below the line holding `mark`.
 */
export function SiiSnippet({
  code,
  mark,
  markStyle = 'squiggle',
  after,
}: {
  code: string
  mark?: string
  markStyle?: 'squiggle' | 'hover'
  after?: ReactNode
}) {
  let marked = false
  return (
    <pre className="sii-snippet">
      <code>
        {code.split('\n').map((line, i) => {
          let hasMark = false
          return (
            <span key={i} className="block">
              {tokenize(line).map(([cls, text], j) => {
                if (mark && !marked && text === mark) {
                  marked = hasMark = true
                  return (
                    <span key={j} className={`${cls} sii-${markStyle}`}>
                      {text}
                    </span>
                  )
                }
                return cls ? (
                  <span key={j} className={cls}>
                    {text}
                  </span>
                ) : (
                  text
                )
              })}
              {line === '' && '​'}
              {hasMark && after}
            </span>
          )
        })}
      </code>
    </pre>
  )
}
