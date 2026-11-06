// Writes sii.tmLanguage.json and sui.tmLanguage.json next to this file: the
// grammars for the docs site's code blocks. Edit this, not the JSON, then run
// `node grammars/generate.mjs` in apps/web.
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const r = String.raw
const out = dirname(fileURLToPath(import.meta.url))
const NUM = r`[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?`
const NUMX = r`(?:&[0-9a-fA-F]+|${NUM})`
const END = r`[ \t]*(?:$|\}|/\*|//|#)`
const VALUE_END = r`(?=${END})|^`
const NAME = r`[^\s{}:]+`
const HEADER = r`(?:((?:${NAME}::)*${NAME})(::))?(${NAME})[ \t]*(:)[ \t]*([^\s{}]+)`
const KEY = r`[A-Za-z0-9_.\-]+(?:[ \t]*\[[ \t]*\d*[ \t]*\])?`
const UNCLOSED = r`(?=^[ \t]*\})|(?=^[ \t]*${KEY}[ \t]*:(?![^\n]*;))`
const headerCaptures = {
  1: { name: 'entity.name.namespace.sii' },
  2: { name: 'punctuation.separator.namespace.sii' },
  3: { name: 'entity.name.type.class.sii' },
  4: { name: 'punctuation.separator.colon.sii' },
  5: { name: 'meta.unit-name.sii' },
}
const unit = (begin) => ({
  name: 'meta.unit.sii',
  begin,
  beginCaptures: headerCaptures,
  end: r`\}`,
  endCaptures: { 0: { name: 'punctuation.definition.block.end.sii' } },
  patterns: [{ include: '#body' }],
})
const sii = {
  $schema:
    'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
  name: 'SII',
  scopeName: 'source.sii',
  comment:
    "Full grammar for the docs site's code blocks (RDX syntaxHighlighting). It mirrors the extension's semantic tokens (apps/server/src/semantic/index.ts) and the reader's rules (apps/server/src/sii/reader.ts, value.ts): the same parts are colored, with the scopes VS Code maps those semantic token types to. The extension keeps its minimal grammar in apps/client/syntaxes. sui.tmLanguage.json reuses these rules.",
  patterns: [
    { include: '#comments' },
    { name: 'keyword.other.magic.sii', match: r`\bSiiNunit\b` },
    { include: '#include' },
    { include: '#unit' },
    { include: '#braces' },
  ],
  repository: {
    unit: unit(HEADER),
    'unit-same-line': unit(r`${HEADER}(?=[^\n"]*\{)`),
    'unit-dotted-name': unit(
      // Not `key[]: .x` (no class has brackets), not `key: 2.4` (a number).
      r`${HEADER.replaceAll(NAME, String.raw`[^\s{}:\[\]]+`).replace(String.raw`([^\s{}]+)`, String.raw`(?![+-]?[\d.]+${END})(\.?[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+|\.[A-Za-z0-9_]+)`)}(?=${END})`
    ),
    body: {
      patterns: [
        { include: '#comments' },
        { include: '#include' },
        { include: '#attribute' },
        { include: '#quoted' },
        { include: '#braces' },
      ],
    },
    braces: {
      patterns: [
        { name: 'punctuation.definition.block.begin.sii', match: r`\{` },
        { name: 'punctuation.definition.block.end.sii', match: r`\}` },
      ],
    },
    comments: {
      patterns: [
        { include: '#block-comment' },
        { name: 'comment.line.double-slash.sii', begin: '//', end: '$' },
        { name: 'comment.line.number-sign.sii', begin: '#', end: '$' },
      ],
    },
    'block-comment': {
      name: 'comment.block.sii',
      begin: r`/\*`,
      end: r`\*/`,
      patterns: [{ include: '#block-comment' }],
    },
    include: {
      begin: r`(@include)(?=[ \t]|$)[ \t]*`,
      beginCaptures: { 1: { name: 'keyword.control.import.sii' } },
      end: VALUE_END,
      patterns: [{ include: '#value' }],
    },
    attribute: {
      begin: r`(?:^|(?<=[\s{]))(${KEY})[ \t]*(:)[ \t]*`,
      beginCaptures: {
        1: { name: 'variable.parameter.sii' },
        2: { name: 'punctuation.separator.colon.sii' },
      },
      end: VALUE_END,
      patterns: [{ include: '#value' }],
    },
    value: {
      comment:
        'Each rule matches the whole value (\\G is where the value starts, the lookahead where it ends), in the order inferSiiValueType() decides: bool, number, tuple, placement, name; anything else is a string.',
      patterns: [
        {
          name: 'keyword.other.boolean.sii',
          match: r`\G(?:true|false)(?=${END})`,
        },
        { name: 'constant.numeric.sii', match: r`\G${NUMX}(?=${END})` },
        {
          begin: r`\G(?=\([,; \t]*${NUMX}(?:[ \t]*[,;][,; \t]*${NUMX})*[,; \t]*\)${END})`,
          end: r`(?=${END})`,
          patterns: [{ include: '#number' }],
        },
        {
          begin: r`\G(?=\([^\n}#/]*\)[ \t]*\([^\n}#/]*\)${END})`,
          end: r`(?=${END})`,
          patterns: [{ include: '#number' }],
        },
        {
          comment: 'A unit name, pointer or token: each part between dots.',
          begin: r`\G(?=[a-z0-9_.]+${END})`,
          end: r`(?=${END})`,
          patterns: [{ name: 'entity.name.function.sii', match: '[a-z0-9_]+' }],
        },
        {
          name: 'string.unquoted.sii',
          begin: r`\G(?!${END})`,
          end: VALUE_END,
          patterns: [{ include: '#quoted' }],
        },
      ],
    },
    number: { name: 'constant.numeric.sii', match: NUMX },
    quoted: {
      comment:
        "A string may span lines. One that never closes ends where the reader ends it (unclosedQuoteLineEnd()): before a line that is a '}', or a `key:` without ';'.",
      patterns: [
        {
          name: 'string.quoted.double.sii',
          begin: '"',
          end: r`"|${UNCLOSED}`,
          patterns: [{ match: r`\\.` }],
        },
        {
          name: 'string.quoted.single.sii',
          begin: "'",
          end: r`'|${UNCLOSED}`,
          patterns: [{ match: r`\\.` }],
        },
      ],
    },
  },
}
const sui = {
  $schema: sii.$schema,
  name: 'SUI',
  scopeName: 'source.sui',
  comment:
    "A .sui holds units or bare attributes (a unit body pasted in by @include). The reader tells them apart by a '{' after the line, often on the next one, which a line-based grammar can't see. So a line is a unit header when a '{' follows on it, or when it is only `class : name` with a dotted name (a unit name: 19,181 such headers in ATS 1.61 .sui files, against 60 bare attributes that look like one). The rules come from sii.tmLanguage.json.",
  patterns: [
    { include: 'source.sii#comments' },
    { include: 'source.sii#include' },
    { include: 'source.sii#unit-same-line' },
    { include: 'source.sii#unit-dotted-name' },
    { include: 'source.sii#attribute' },
    { include: 'source.sii#quoted' },
    { include: 'source.sii#braces' },
  ],
}
writeFileSync(`${out}/sii.tmLanguage.json`, JSON.stringify(sii, null, 2) + '\n')
writeFileSync(`${out}/sui.tmLanguage.json`, JSON.stringify(sui, null, 2) + '\n')
