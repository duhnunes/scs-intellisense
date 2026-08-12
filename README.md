<div align="center">
  <img src="./apps/client/public/icon.png" width="160" alt="SCS IntelliSense logo" />
  <h1>SCS IntelliSense</h1>
  <p>VS Code support for SCS Software mod files</p>
</div>

<div align="center">
  <a href="./LICENSE.md"><img src="https://img.shields.io/badge/license-MIT-FF6A00?style=for-the-badge" alt="MIT License" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=DuHNunes.scs-intellisense"><img src="https://img.shields.io/github/v/release/duhnunes/scs-intellisense?display_name=tag&style=for-the-badge" alt="Latest release" /></a>
</div>

## What it is

**SCS IntelliSense** is a **VS Code extension** that improves editing files used by **SCS Software mods**. It brings modern language support to these formats, making the files easier to read and edit.

## Why it matters

The extension is built around a parser that reads **SCS documents** and turns them into a structured tree. This tree is the base for the sistems.

When the file structure is correct, the extension can provide accurate feedback and make modding faster.

## Main features

- 🎨 Semantic Highlighting for SCS syntax
- 💡 Completion to `attribute_key` and `class_name`
- 🔍 Inline diagnostics while editing
- 🖱️ Hover details for supported nodes
- 📂 File Icons for supported formats

## Project structure

- `apps/client` — the VS Code extension UI and activation logic
- `apps/server` — the language server that parses files and provides editor features
<!-- - `apps/web` — documentation site and content

## Docs

The project documentation lives in `apps/web/content/docs` and explains how the extension works, including the reader, hover, diagnostics, and other systems. -->
