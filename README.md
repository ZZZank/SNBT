# SNBT

VS Code extension for [SNBT](https://minecraft.fandom.com/wiki/NBT_format#SNBT_format) (Stringified NBT).

## Features

### Syntax Highlighting

Full TextMate grammar covering all SNBT syntax:

- All numeric types with suffixes: `1b`, `1s`, `42`, `1l`, `3.14f`, `3.14d`
- Hex (`0xFF`) and binary (`0b1010`) literals
- Signed/unsigned integer suffixes: `sb`, `ub`, `ss`, `us`, `si`, `ui`, `sl`, `ul`
- Underscore digit separators: `1_000`, `1_2.3_4__5f`
- Scientific notation: `1.2e3`, `1.2E+3`, `.1e3f`
- Strings: double-quoted, single-quoted, bare strings, all escape sequences
- Booleans: `true` / `false`
- Compounds `{}`, Lists `[]`, typed arrays `[B;]` `[I;]` `[L;]`
- SNBT operations like `-{}-bool()` and `-{}-uuid()`

### Diagnostics

Error reporting as you type:

- Missing commas between elements
- Missing colons in key-value pairs
- Unexpected tokens
- Stray commas

### Lenient Mode

Toggle lenient mode (`SNBT: Toggle Lenient Mode`) to allow newlines as element separators. Useful when viewing `.snbt` from **certain** mods:

Strict (default):
```snbt
{this: ["is", "a", "valid", "SNBT"]}
```

Lenient:
```snbt
{
    this: [
        "is"
        "a"
        "valid"
        "SNBT"
    ]
}
```

### Formatting

Format `.snbt` files with configurable indentation (spaces or tabs, custom indent size).

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `snbt.lenient` | `false` | Allow newlines to replace commas as element separators |
| `snbt.format.indentSize` | `4` | Formatter indent size |
| `snbt.format.useTabs` | `false` | Use tabs for indentation, otherwise spaces |

## Commands

| Command | Description |
|---------|-------------|
| `SNBT: Toggle Lenient Mode` | Toggle lenient mode on/off |
