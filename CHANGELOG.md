# Changelog

## 0.0.4 — 2026-05-13

`TextMate3: Sort Collection` — alphabetically sorts the items in a selected collection, case-insensitively. Supports:

- Ruby bracket array literals (`[:foo, :bar]`, `["foo", "bar"]`, `['foo', 'bar']`)
- `%i()` and `%w()` word-list literals
- Bare comma-separated text as a fallback

No keybinding is declared by default. Available in any file type via the Command Palette.

## 0.0.3 — 2026-05-13

Eight text-transform commands ported from the TextMate Ruby and Source bundles.

**Ruby commands** (keybindings active only in Ruby files):

- `TextMate3: Toggle Ruby Hash Syntax` — cycles between rocket (`{ :key => val }`) and new (`{ key: val }`) hash syntax.
- `TextMate3: Toggle String/Symbol` — converts `"word"` / `'word'` ↔ `:word`.
- `TextMate3: Toggle Quote Style` (`Ctrl+"`) — three-way cycle `"…"` → `'…'` → `%Q{…}` → `"…"` with proper escape handling; also handles backtick / `%x{}` shell strings.
- `TextMate3: Toggle camelCase / snake_case` — three-way case cycle `PascalCase` → `snake_case` → `camelCase` → `PascalCase`.
- `TextMate3: Toggle Block Style` (`Ctrl+Shift+[`) — toggles a selected Ruby block between `{ … }` and `do … end` forms.
- `TextMate3: Toggle Array Literal (%i/%w)` (`Ctrl+Cmd+\`) — toggles between bracket array literals and `%i()`/`%w()` literals.

**Source commands** (active in any file):

- `TextMate3: Wrap in Braces` — wraps selection in `{…}`, multi-line-aware.
- `TextMate3: Unwrap Braces` — removes surrounding `{…}` from a selection.

## 0.0.2 — 2026-05-04

TextMate2-style custom macros with persistent named slots.

- New command `TextMate3: Toggle Macro Recording` (default `Cmd+Option+M`) — captures edits and selection changes in the active editor.
- New command `TextMate3: Replay Last Macro` (default `Cmd+Shift+M`) — replays the current macro as a single undoable edit.
- New command `TextMate3: Save Current Macro As…` — names and persists the current macro.
- New command `TextMate3: Load Named Macro…` — quickpick of saved macros; loads the chosen one into the current slot.
- New configuration: `textMate3.macros.maxEvents` (default 10000) and `textMate3.macros.filterMouseSelection` (default true).
- Status bar indicator while recording.
- Macro storage uses `context.globalState`; current and named macros survive reloads.

## 0.0.1 — 2026-05-04

Initial scaffold. Establishes the extension chassis with stubs for all four contribution types:

- TextMate injection grammar highlighting `TODO` / `FIXME` / `NOTE` keywords inside Markdown.
- Example snippet (`hello`).
- Palette command `TextMate3: Hello World` that reads a configurable greeting.
- Markdown `HoverProvider` returning placeholder content.

Publisher and extension name (`outlawandy.text-mate-3`) established here. These are sticky post-publish.
