# Contributing

Thanks for helping! Bug reports, new diagnostic rules, fixes and real game files that break the extension are all welcome.

## Reporting a problem

Open an [issue](https://github.com/duhnunes/scs-intellisense/issues). The most useful report is a file **the game loads fine** but the extension marks as an error. Include:

- the file's path (for example `def/world/mover.allflags.sii`) and the game and version (ATS 1.61, ETS2 1.xx);
- the lines involved;
- the message the extension shows.

Class and attribute data (completion, hover) lives in another repository: [scs-schema](https://github.com/duhnunes/scs-schema), with its own [contributing guide](https://github.com/duhnunes/scs-schema/blob/master/CONTRIBUTING.md).

## Setting up

Requirements: [Node.js](https://nodejs.org/), [pnpm](https://pnpm.io/) 11 and VS Code.

```bash
git clone https://github.com/duhnunes/scs-intellisense.git
cd scs-intellisense
pnpm install
pnpm test
```

To try your changes, open the repository in VS Code and press `F5` (**Run Extension**). It builds the server and the client and opens a VS Code window with your build loaded. `pnpm compile` creates an installable `.vsix` in `release/latest` instead.

## Where things are

The [developer docs](./docs/README.md) explain the code. Good places to start:

- [Overview](./docs/architecture/overview.md): how the client, the server and the parser fit together, and the rules the code depends on.
- [The reader](./docs/architecture/reader.md): how a file becomes a tree, and what the tree looks like.
- [Diagnostics](./docs/features/diagnostics.md): where the diagnostic rules are, the current ones, and how to add one.
- [Formatter](./docs/features/formatter.md): how the formatter works and its safety check.
- [File format](./docs/reference/file-format.md): what the parser accepts, and where the game's files differ from the wiki.

## Making a change

1. **Add a test.** Every bug fix and every rule gets one, in `apps/server/test/` (Vitest). Tests read like the problem: `problems(sii('a : ab..cd {\n}'))` returns the errors and warnings of that document. If the case comes from a game file, add a short excerpt to `apps/server/test/fixtures/` with a comment naming the file and game version; fixtures must stay free of errors and warnings.
2. **Follow the game, not only the wiki.** SCS's [modding wiki](https://modding.scssoft.com/wiki/Main_Page) is incomplete and sometimes contradicted by the game's own files. A rule must not report an `error` on something the game loads.
3. **Run the checks** before opening a pull request:
   ```bash
   pnpm test
   pnpm --filter scs-int-server run check-types
   pnpm --filter ./apps/client run check-types
   ```
4. **Write the commit message** in [Conventional Commits](https://www.conventionalcommits.org/) form (`feat:`, `fix:`, `docs:`...), with a body that explains *why*. The changelog is generated from these messages.

Code, comments and commit messages are in English.

New features that aren't proven on real files yet go behind a setting that is **off by default**, like completion, hover and the formatter today.
