[Docs](../README.md) › Features › **Diagnostics**

# Diagnostics

Diagnostics come from two places, and the difference matters when you add one:

| Source | File | Kind of problem |
|---|---|---|
| **The reader** | `apps/server/src/sii/reader.ts` | *Structural*: the file can't be read as a tree there (a missing `:`, `{` or `}`) |
| **The rules** | `apps/server/src/diagnostic/rules.ts` | *Business rules*: the tree is fine, but something in it isn't allowed (an invalid name, a duplicate) |

`checkDocument()` in `diagnostic/index.ts` merges both and drops the severities the user turned off (`scs-intellisense.diagnostics.enabledSeverities`); `getDiagnostics()` converts the result to LSP positions.

Every issue has a **code** (`SiiIssueCode` in `interfaces/structure.ts`), such as `missing-final-newline`. VS Code shows it next to the message, and quick fixes key on it, so a code never changes when a message is reworded.

**A new check almost always belongs in `rules.ts`.** Only touch the reader if the file can't be parsed at all; see rule 1 in [architecture.md](../architecture/overview.md).

## Severity

| Severity | Meaning |
|---|---|
| `error` | The game is expected to fail loading this. The default when a rule sets no severity |
| `warning` | A recommendation from the SCS documentation; the game loads it anyway |
| `hint` | Contradicts the documentation, but the game's own files do it |

Choose by evidence. If a game file does what your rule forbids, it can't be an `error`: either make it a `hint` or drop the rule. The extracted game files are the reference, not the wiki (see [file-format.md](../reference/file-format.md)).

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

### From `schemaRules.ts` (need the schema database)

| Function | Checks | Severity |
|---|---|---|
| `validateAttributeKeys` | An attribute key the unit's class doesn't have (`unknown-attribute`). Since scs-schema v3 the attribute lists come from the game itself, so this is almost always a typo. Legacy and internal-only keys are known keys, so never reported. Classes missing from the manifest are skipped, and nothing runs on a file with structural issues | warning |
| `validateEnumValues` | A value an `enum` attribute doesn't list (`invalid-enum-value`), compared as written (case matters), inside the quotes when quoted. An integer is never reported: the game writes some enums as numbers (`tr_semaphore_profile.type: 12`, 15 values in ATS 1.61), and which name it stands for isn't known. An empty value isn't either (still being typed). The message lists up to 8 values; completion has them all | warning |
| `validateValueTypes` | A value its schema type can't hold: `invalid-number` (not a number for `float` and the integer types, a fraction in an integer, a negative unsigned), `invalid-vector` (`float2/3/4`, `int2`, `uint2`: wrong count or a non-number inside), `invalid-bool`. Every shape ATS 1.61 writes is accepted (survey of its 2,163,580 values, 2026-10-26): decimals with sign, exponent or `f` suffix (`+6`, `2e-6`, `25.0f`), float bits `&3f800000` (258,750), hex integers `0x10DE`, `nil` (78,947, on unsigned types), bools as `0`/`1` (`engine_brake_downshift`) or quoted. Not checked: string, token, pointers (take nearly anything), quat and placement (`(w; x, y, z)`), an array's count (`items: 5`) | warning |

These rules can't run in `rules.ts`: the class files load asynchronously. `checkDocument()` takes a `SchemaLookup` that only answers from memory (`SchemaClient.peekSchemaContent()`), so diagnostics stay synchronous. The server's `publishDiagnostics()` sends what it has, loads any class file still missing, and sends again once (unless the document changed meanwhile). After that the class stays in memory, so typing never makes a warning flicker. Open documents are checked again when the manifest loads or changes.

On the 73,224 ATS 1.61 game files (the base game and 56 DLCs: 257,638 units, all 743 classes in the manifest) neither `validateAttributeKeys` nor `validateEnumValues` reports anything (2026-10-24), since scs-schema added the one key and 19 classes the first run found missing (2026-10-22). The enum figures (59,057 values, 852 of them quoted) come from that first run, on 44,503 files. A hand-written mod (63 files) got none either.

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
        code: 'duplicate-attribute', // add it to SiiIssueCode first
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

## Quick fixes

The light bulb next to a diagnostic. Always on, like diagnostics: a fix only changes the file when the user picks it.

- `diagnostic/quickFixes.ts`: `quickFixesFor(issue, document)` returns the fixes for one issue as offset edits into `document.text`, chosen by `issue.code`. Pure and LSP-free, like the rules.
- `diagnostic/codeActions.ts`: the `textDocument/codeAction` handler. It checks the document again (the fix needs the tree, and fresh offsets), keeps the issues under the cursor or selection, converts the edits to LSP positions, writes line breaks the way the file does (CRLF stays CRLF), and links each fix to its diagnostic.

**Offer a fix only when the right edit is certain from the text.** When there's more than one plausible fix, offer none, or offer each one and prefer none. `isPreferred` marks the single obvious fix, which VS Code applies with Auto Fix (`Shift+Alt+.`).

| Code | Fix |
|---|---|
| `missing-final-newline` | Add the newline |
| `include-not-at-line-start` | Remove the whitespace before it, or move it to its own line when other content comes first |
| `unit-name-empty-token` | `a..b` → `a.b` (a whole run of dots at once); trailing dots are removed; leading ones keep one dot (a nameless unit) |
| `unit-name-unmatched-quote` | Add the missing quote, or remove this one (neither preferred) |
| `missing-unit-colon` | `class unit` → `class : unit`, or a stray character in its place (`;`) becomes `:` |
| `missing-attribute-colon` | `key value` → `key: value`, `key = value` → `key: value` |
| `unknown-attribute` | "Change to `price`": the class's closest key by edit distance (a swap of two letters is one edit), when it's within 1–3 edits depending on length and no other key is as close. Keys a modder writes win over legacy and internal-only ones |
| `invalid-enum-value` | "Change to `factory`": the closest value by the same measure; quotes are kept |

Deliberately without a fix: uppercase in a unit name (the game loads it, and other files may use the name as written), duplicates (which one to rename is the user's call), and a missing `{` or `}` (where it goes is a guess).

To add one: add a `case` to `quickFixesFor()`, then a test in `apps/server/test/quickFixes.test.ts` that applies the fix and checks the diagnostic is gone. Fixes that need the schema ("did you mean ...?" for a class or key) will be async, so they belong in `codeActions.ts`, not in the rules.

---

← [The reader](../architecture/reader.md) · [Formatter](./formatter.md) →
