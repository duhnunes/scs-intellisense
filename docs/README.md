# SCS IntelliSense developer docs

Technical documentation for people who want to understand or change the extension. To use it, see the [README](../README.md); to contribute, start with [CONTRIBUTING](../CONTRIBUTING.md).

## Architecture

How the pieces fit together.

- [Overview](./architecture/overview.md): the client, the server, what each folder does, and the rules the code depends on.
- [The reader](./architecture/reader.md): how a file becomes a tree, what the tree looks like, and how it recovers from broken input.

## Features

How each feature works and how to extend it.

- [Diagnostics](./features/diagnostics.md): where the rules live, the current checks, how to add one, and the quick fixes.
- [Formatter](./features/formatter.md): how files are rebuilt, and the safety check behind Format All Files.
- [Navigation](./features/navigation.md): the workspace index behind Go to Definition, Find References and Rename.

## Reference

- [File format](./reference/file-format.md): what the parser accepts, and where the game's files differ from the wiki.

## Suggested reading order

New to the code? Read [Overview](./architecture/overview.md) → [The reader](./architecture/reader.md) → [Diagnostics](./features/diagnostics.md). Each page links to the next one at the bottom.
