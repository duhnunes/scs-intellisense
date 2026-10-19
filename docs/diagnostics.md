# Diagnostics

Diagnostics come from two places, and the difference matters when you add one:

| Source | File | Kind of problem |
|---|---|---|
| **The reader** | `apps/server/src/sii/reader.ts` | *Structural*: the file can't be read as a tree there (a missing `:`, `{` or `}`) |
| **The rules** | `apps/server/src/diagnostic/rules.ts` | *Business rules*: the tree is fine, but something in it isn't allowed (an invalid name, a duplicate) |

`getDiagnostics()` in `diagnostic/index.ts` merges both, drops the severities the user turned off (`scs-intellisense.diagnostics.enabledSeverities`) and converts offsets to LSP positions.

**A new check almost always belongs in `rules.ts`.** Only touch the reader if the file can't be parsed at all; see rule 1 in [architecture.md](./architecture.md).

## Severity

| Severity | Meaning |
|---|---|
| `error` | The game is expected to fail loading this. The default when a rule sets no severity |
| `warning` | A recommendation from the SCS documentation; the game loads it anyway |
| `hint` | Contradicts the documentation, but the game's own files do it |

Choose by evidence. If a game file does what your rule forbids, it can't be an `error`: either make it a `hint` or drop the rule. The extracted game files are the reference, not the wiki (see [file-format.md](./file-format.md)).

## Current checks

### From the reader (all `error`)

- `Expected SiiNunit document marker`, `Expected '{' after SiiNunit`, `Expected '}' to close SiiNunit`
- `Duplicate SiiNunit block — only one is allowed per file`, `Unexpected content after the SiiNunit closing brace`
- `Expected className`, `Expected ':' between className and unitName`, `Invalid unitName format`, `Expected '{' after unitName`, `Expected '}' to close unit`, `Unexpected '}'`
- `Expected attribute key`, `Expected ':' after attribute key`, `Expected ']' after array attribute key`

### From `rules.ts`

| Function | Checks | Severity |
|---|---|---|
| `validateClassName` | Each `::`-separated part uses only `A-Z a-z 0-9 _`, doesn't start with a digit, isn't empty (`ui::text` is valid, `ui::` is not) | error |
| `validateUnitName` | Each `.`-separated token: at most 12 characters, only `A-Z a-z 0-9 _`, no empty tokens (`a..b`). One surrounding pair of double quotes is allowed and the rules run on the inside; an unmatched quote or `""` is an error | error |
| `validateUnitName` | Uppercase letters in a token (the wiki says lowercase; game files use uppercase) | hint |
| `validateDuplicateUnitNames` | Two units with the same name in one file, nameless ones (`.x`) included. Names are compared as written, so `"a.b"` and `a.b` don't collide | error |
| `validateIncludePlacement` | `@include` must start its line, with no whitespace before it | error |
| `validateTrailingNewline` | The file should end with a newline | warning |

## Adding a rule

Say you want to warn about an attribute written twice in the same unit. (This is an example to show the steps; it isn't implemented.)

**1. Write the rule in `rules.ts`.** A rule takes parts of the tree and returns `SiiIssue[]`; it never reads the text on its own. Point the range at exactly what is wrong, not at the whole unit:

```ts
function validateDuplicateAttributes(unit: SiiUnit): SiiIssue[] {
  const seen = new Set<string>()
  const issues: SiiIssue[] = []
  for (const attribute of unit.attributes) {
    if (attribute.kind !== 'attribute' || attribute.isArray) continue
    if (seen.has(attribute.key)) {
      issues.push({
        message: `Attribute "${attribute.key}" is set more than once`,
        range: attribute.keyRange,
        severity: 'warning',
      })
    }
    seen.add(attribute.key)
  }
  return issues
}
```

**2. Call it** from `validateUnit()` (rules about one unit) or `validateSiiDocument()` (rules about the whole file).

**3. Test it** in `apps/server/test/rules.test.ts`. `problems()` returns the errors and warnings of a document; `sii()` wraps units in a `SiiNunit` root:

```ts
describe('rules: duplicate attributes', () => {
  it('warns on the second key', () => {
    expect(problems(sii('a : x.y {\n  k: 1\n  k: 2\n}'))).toEqual([
      expect.objectContaining({ severity: 'warning', text: 'k' }),
    ])
  })

  it('accepts array attributes', () => {
    expect(problems(sii('a : x.y {\n  k[]: 1\n  k[]: 2\n}'))).toEqual([])
  })
})
```

**4. Check it against real game files.** A rule that fires on files the game loads is a false positive. The excerpts in `apps/server/test/fixtures/` come from the game and must stay free of errors and warnings, so `pnpm test` catches the obvious cases. If you have the game files extracted, open the folder in VS Code with your build: every error your rule reports there is one to explain.

**5. Run `pnpm test`.**
