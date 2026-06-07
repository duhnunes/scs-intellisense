<div align="center">
  <img src="./apps/client/public/icon.png" width="200" alt="Logo" />  
  <h3> SCS Intellisense extension for <a href="https://code.visualstudio.com"><img src="./.github/imgs/links/vscode.svg" style="width:10%;" alt="VSCode link" /></a></h3>
</div>

<div align="center">
  <a href="./LICENSE.md" alt="license"><img src="https://img.shields.io/badge/license-MIT-FF6A00?style=for-the-badge" alt="badge license" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=DuHNunes.scs-intellisense"><img src="https://img.shields.io/github/v/release/duhnunes/scs-intellisense?display_name=tag&style=for-the-badge" alt="build released" /></a>
</div>

## About

**SCS Intellisense** makes VSCode smarter for <a href="https://www.scssoft.com/"><img src="./.github/imgs/links/scssoftware.svg" style="width:12%;" alt="SCS Software link" /></a> files. It improves readability and speeds up editing by offering:  
- Semantic highlighting token to coloring for MagicMark, Classes, Attributes and Comments
- Each Value type have your semantic color: `string`, `number`, `boolean`, `token` and `@include` directive
- Auto-Close brackets
<!-- - Context-aware completions for class attributes and values;
- Snippets for common constructs and directives; -->

### Sii Extructure
> The structure is built as originally described in the <a href="https://modding.scssoft.com/wiki/Documentation/Engine/Units#Unit_definition_entry"><img src="./.github/imgs/links/docummentation.svg" style="width:16%;" alt="SCS Documentation about Unit Definition Entry" /></a>.

<div align="center">
  <img src="./.github/imgs/sii_file_diagram.png" alt="diagram" />
</div>

- **SiiNunit** - The **magic marker** that identifies a plain-text `.sii` file. It appears at the top of the file and marks the file as a serialized unit file.
- **class_name** - The **unit type of class** being defined; it indicates the schema or category of the unit (for example `prefab_model`, `model_def`). It appears before the colon in the unit header.
- **unit.name** - The **unique name** of the unit: a sequence of tokens separated by dots (e.g., `mod.namespace.item`). Use unique names per mod to avoid collisions. Anonymous units may use a leading dot.
- **attribute** - The **property name** inside a unit block; an attribute is a **key + value** pair that holds the unit data.
- **key** - The **attribute name** that identifies the property (e.g. `name` in `name: "Truck"`).
- **value** - The **attribute value**. Value can be **strings**, **numbers**, **booleans**, **unit references**, **vectors (tuples)**, or other engine-specific formats. Use quotes for strings and parentheses for vectors.

## Features

- **Semantic highlighting**
<!-- - **Completions** for class names, attributes and values (context-aware) -->
<!-- - **`@include` directive**: recognized as a special key (no `:`) -->
- **Icon** for each files
- **Auto-close brackets** for `{}`, `()`, `[]`


## Tested themes
1. **Dark**
  - `Dark 2026` (VSCode)
  - `Catppuccin Frappé`
  - `Catppuccin Macchiato`
  - `Catppuccin Mocha` (developed theme)
  - `Dracula Theme` & `Dracula Theme Soft`
  - `Abyss`
  - `Dark Modern`
  - `Dark+`

2. **Light**
  - `Catppuccin Latte`
  - Should work with the light variants of the themes listed above.

*Note*: <u>`Dark (Visual Studio)`</u> and <u>`Light (Visual Studio)`</u> do not provide highlighting in all scopes.

## License

Licensed under the <a href="./LICENSE.md"><img src="./.github/imgs/links/mit.svg" style="width:4%;" alt="License Doc" /></a>

**Enjoy**
