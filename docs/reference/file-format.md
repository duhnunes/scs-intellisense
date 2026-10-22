[Docs](../README.md) › Reference › **File format**

# File format

What the reader accepts. The base is SCS's [Units documentation](https://modding.scssoft.com/wiki/Documentation/Engine/Units); the sections marked **game files** are behavior found in the game's own files that the wiki doesn't describe, or contradicts. Those were checked against the extracted files of American Truck Simulator 1.61. File paths are in-game paths, as found inside the game archives (`base.scs`, `def.scs`...).

## `.sii`

```
SiiNunit
{
class_name : unit.name
{
    key: value
    array_key[]: first
    array_key[]: second
}
}
```

- `SiiNunit` and its braces wrap the whole file. Only one per file, and nothing but comments after its closing brace.
- A unit is `class_name : unit.name { ... }`. The brace may be on the same line or the next one, and the space before `:` is optional.
- A unit name made of `.`-separated tokens, each at most 12 characters of `a-z 0-9 _`. A name starting with `.` is **nameless**: it only exists inside its `SiiNunit`, but it must still be unique there.
- Attributes are `key: value`, one per line. Arrays are `key[]: value` repeated, or `key: N` followed by `key[0]` ... `key[N-1]`.
- Comments: `#` and `//` to the end of the line, `/* ... */` for blocks.
- `@include "file.sui"` pastes another file's content in place. It is allowed at the top level and inside a unit body, and it **must start its line**, with no whitespace before it: indented, it is silently ignored by the game.

## `.sui`

Files meant to be included, without the `SiiNunit` wrapper. A `.sui` holds one of two things, depending on where it is included:

- **Units**, when included at the top level of a `SiiNunit`.
- **Bare attributes**, when included inside a unit body, as a fragment of that body:

  ```
  @include "goal_bonus.sui"

  	score_success: 1100
  	id: dir_change_b
  ```
  (`def/academy/scenario/share/goal_bonus_direction_change.sui`)

In ATS 1.61, 1,086 `.sui` files hold units and 255 hold bare attributes; none mix the two. The reader still decides item by item: an item followed by `{` is a unit, anything else an attribute. Attributes in a fragment get no hover or completion, because their class is in the file that includes them.

## Game files: where the game differs from the wiki

| Found in the game | The wiki says | What the extension does |
|---|---|---|
| Uppercase in unit name tokens: `mover.flagUSsmaSi` (`def/world/mover.allflags.sii`), `_nameless.NVIDIA.GeForce.GT.220` (`def/default_gfx_setup.sii`) | Lowercase only | Accepts it, with a `hint` |
| Unit names in double quotes: `default_input_config : "icfg.steering.configured"` (`def/default_input_setup.sii`) | Nothing | Accepts one surrounding pair and checks the inside. Whether the game treats `"a.b"` and `a.b` as the same name is unknown, so they're compared as written |
| Class names with a namespace: `ui::window`, `ui::text` (21 files, e.g. `system/ui/engine_sound_data.sii`), `hcd::on_job` (`def/tutorial_hint_conditions.sii`) | `class name : unit name`, no namespaces | `::` is part of the class name; each part follows the class name rules. Only `ui` and `hcd` exist in 1.61 |
| A comment between the unit name and `{`: `light_source : highway.tunnel.light #omni` (`unit/hookup/lights/highway_tunnel_light.sii` and 73 others) | Nothing | Read as a comment; the formatter keeps it on the header line |
| A space before the colon: `base_color : (0.0202, 0.0021, 0.1022)` (`dlc_christmas` paint jobs, `def/world/model.base_share.sii`; 37 keys) | `key: value` | The space isn't part of the key; the formatter writes `key: value` |
| A quoted value on the line after the colon: `n_pml:` then `"<img src=...>"` (`share/ui/template/button.sii`, 45 values) | Nothing | Only a quoted string is taken from the next line (no key starts with `"`); `key:` followed by another attribute stays an empty value. The formatter joins the two lines |
| 2,694 of 44,503 files (ATS 1.61, base game + 10 DLCs) without a final newline | "It's always good to add one blank line at the end of file" | A `warning`, since it's a recommendation |
| Units at column 0 in some files, indented inside `SiiNunit` in others | Nothing | Both are read; the formatter writes one style |

No unit name token over 12 characters exists in the 1.61 files.

Found another case? Please open an [issue](https://github.com/duhnunes/scs-intellisense/issues) with the file's path and the lines involved.

---

← [Formatter](../features/formatter.md)
