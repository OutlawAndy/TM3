# Changelog

## 0.0.8 — 2026-06-01

Two whitespace keybindings, active only when text is selected in a writable editor:

- `space` — trims leading/trailing whitespace (including newlines and tabs) from the selection.
- `shift+space` — same trim, then prepends a single space.

Both bind the built-in `editor.action.insertSnippet` with an inline `TM_SELECTED_TEXT` transform — no extension command or `extension.ts` registration needed. The transform uses `^…$` anchors (VSCode's snippet engine runs V8 regex); `\A`/`\Z` do **not** work there and silently no-op. A copy-paste reference for a personal `keybindings.json` lives in [docs/whitespace-trim.keybindings.jsonc](docs/whitespace-trim.keybindings.jsonc).

**Renamed the extension TextMate3 → TM3** (unpublished, so no compatibility break): `name` slug (`text-mate-3` → `tm3`), `displayName`, command IDs (`textMate3.*` → `tm3.*`), Command Palette category/titles (`TM3: …`), config namespace (`tm3.*`), and macro `globalState` keys. Earlier changelog entries are shown with the new names for consistency.

## 0.0.7 — 2026-05-27

Added **Spinel**, a dark color theme, as a contributed theme (`themes/spinel-color-theme.json`). Select it via `Preferences: Color Theme`. Includes workbench colors, semantic token colors, and TextMate `tokenColors` tuned for Ruby, TypeScript/JavaScript, CSS, Markdown, Rust, C/C++, SQL, YAML, and diffs.

## 0.0.6 – 2026-05-13

Remove padding inside braces.

## 0.0.5 — 2026-05-13

Transform commands now auto-detect their target scope at the cursor when no selection exists. Previously they fell back to the entire current line, which most transforms could not parse — so commands appeared to do nothing unless the user pre-selected the exact token.

- Added grammar-aware scope detection using VSCode's `editor.action.smartSelect.expand`, iterated until the transform produces a change.
- All transforms except `Wrap in Braces` now accept a bare cursor and find their own scope (word, string, hash, block, array, etc.).
- Keybindings for `Toggle Block Style` and `Toggle Array Literal` no longer require `editorHasSelection`.

## 0.0.4 — 2026-05-13

`TM3: Sort Collection` — alphabetically sorts the items in a selected collection, case-insensitively. Supports:

- Ruby bracket array literals (`[:foo, :bar]`, `["foo", "bar"]`, `['foo', 'bar']`)
- `%i()` and `%w()` word-list literals
- Bare comma-separated text as a fallback

No keybinding is declared by default. Available in any file type via the Command Palette.

## 0.0.3 — 2026-05-13

Eight text-transform commands ported from the TextMate Ruby and Source bundles.

**Ruby commands** (keybindings active only in Ruby files):

- `TM3: Toggle Ruby Hash Syntax` — cycles between rocket (`{ :key => val }`) and new (`{ key: val }`) hash syntax.
- `TM3: Toggle String/Symbol` — converts `"word"` / `'word'` ↔ `:word`.
- `TM3: Toggle Quote Style` (`Ctrl+"`) — three-way cycle `"…"` → `'…'` → `%Q{…}` → `"…"` with proper escape handling; also handles backtick / `%x{}` shell strings.
- `TM3: Toggle camelCase / snake_case` — three-way case cycle `PascalCase` → `snake_case` → `camelCase` → `PascalCase`.
- `TM3: Toggle Block Style` (`Ctrl+Shift+[`) — toggles a selected Ruby block between `{ … }` and `do … end` forms.
- `TM3: Toggle Array Literal (%i/%w)` (`Ctrl+Cmd+\`) — toggles between bracket array literals and `%i()`/`%w()` literals.

**Source commands** (active in any file):

- `TM3: Wrap in Braces` — wraps selection in `{…}`, multi-line-aware.
- `TM3: Unwrap Braces` — removes surrounding `{…}` from a selection.

## 0.0.2 — 2026-05-04

TextMate2-style custom macros with persistent named slots.

- New command `TM3: Toggle Macro Recording` (default `Cmd+Option+M`) — captures edits and selection changes in the active editor.
- New command `TM3: Replay Last Macro` (default `Cmd+Shift+M`) — replays the current macro as a single undoable edit.
- New command `TM3: Save Current Macro As…` — names and persists the current macro.
- New command `TM3: Load Named Macro…` — quickpick of saved macros; loads the chosen one into the current slot.
- New configuration: `tm3.macros.maxEvents` (default 10000) and `tm3.macros.filterMouseSelection` (default true).
- Status bar indicator while recording.
- Macro storage uses `context.globalState`; current and named macros survive reloads.

## 0.0.1 — 2026-05-04

Initial scaffold. Establishes the extension chassis with stubs for all four contribution types:

- TextMate injection grammar highlighting `TODO` / `FIXME` / `NOTE` keywords inside Markdown.
- Example snippet (`hello`).
- Palette command `TM3: Hello World` that reads a configurable greeting.
- Markdown `HoverProvider` returning placeholder content.

Publisher and extension name (`outlawandy.tm3`) established here. These are sticky post-publish.
