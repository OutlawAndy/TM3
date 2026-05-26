# TextMate3

Personal VSCode extension chassis. A long-lived home for grammar tweaks, snippets, custom commands, and small language features. The repo ships with one trivial example of each so adding the next tweak is a small diff, not a fresh project.

**Extension ID:** `outlawandy.text-mate-3`

## What's in the box

- **Injection grammar** — highlights `TODO`, `FIXME`, `NOTE`, `HACK`, `XXX` inside Markdown.
- **Snippet** — type `hello` in Markdown or plaintext to expand "Hello, world!".
- **Command** — `TextMate3: Hello World` in the palette; reads the `textMate3.greeting` setting.
- **Hover provider** — placeholder hover on any Markdown text.
- **Custom macros** — record and replay editor actions à la TextMate2, plus named slots that persist across reloads. See [Macros](#macros) below.

## Install

```bash
npm ci
npm run package         # produces text-mate-3-0.0.5.vsix
code --install-extension text-mate-3-0.0.5.vsix
```

To remove:

```bash
code --uninstall-extension outlawandy.text-mate-3
```

## Develop

Press **F5** in VSCode to launch an Extension Development Host with the extension loaded. Run `npm run watch` in a terminal for incremental rebuilds while iterating.

```bash
npm run build       # one-shot esbuild
npm run watch       # esbuild --watch
npm run typecheck   # tsc --noEmit
npm run package     # build + vsce package
```

## Adding a new contribution

### Grammar (injection)

1. Drop a `.tmLanguage.json` (or `.json`) file in [syntaxes/](syntaxes/).
2. Add a `contributes.grammars` entry in [package.json](package.json) with `scopeName`, `path`, and either `injectTo` (for injections) or `language` (for new-language registration).
3. For a brand-new language, also declare `contributes.languages` with the language id, file extensions, and configuration.

See [syntaxes/markdown-todo.injection.json](syntaxes/markdown-todo.injection.json) for the injection pattern.

### Snippet

1. Add a snippet file in [snippets/](snippets/) following the [VSCode snippet syntax](https://code.visualstudio.com/api/language-extensions/snippet-guide).
2. Add a `contributes.snippets` entry in [package.json](package.json) with `language` and `path`.

See [snippets/example.code-snippets](snippets/example.code-snippets).

### Command

1. Declare the command in `contributes.commands` (id, title, optional category) in [package.json](package.json).
2. Register the handler in [src/extension.ts](src/extension.ts) via `vscode.commands.registerCommand` and push the disposable onto `context.subscriptions`.
3. VSCode auto-generates the `onCommand:` activation event from the manifest in modern engine versions — no manual `activationEvents` entry needed.

### Language-feature provider (hover, completion, definition, etc.)

1. Register the provider in [src/extension.ts](src/extension.ts) via the matching `vscode.languages.register*Provider` API.
2. Add `onLanguage:<id>` to `activationEvents` in [package.json](package.json) so the extension activates when files of that type open.

See the `HoverProvider` registration in [src/extension.ts](src/extension.ts).

### Settings

Read at runtime with `vscode.workspace.getConfiguration("textMate3").get<T>("key", default)`. Declare new settings under `contributes.configuration.properties` in [package.json](package.json) so they appear in the Settings UI and pick up types and defaults.

## Ruby & Source text transforms

Text-manipulation commands ported from the TextMate Ruby and Source bundles. All transforms accept the current **selection** as input. When no selection exists, the transform auto-detects its scope by expanding from the cursor — word → string → bracketed expression — using VSCode's grammar-aware smart-select, and applies itself to the first scope that matches.

### Ruby commands (active only in Ruby files)

| Command | Keybinding | Description |
| --- | --- | --- |
| `TextMate3: Toggle Ruby Hash Syntax` | — | Cycles between rocket (`{ :key => val }`) and new (`{ key: val }`) hash syntax. |
| `TextMate3: Toggle String/Symbol` | — | Converts `"word"` / `'word'` ↔ `:word`; replaces all matches in the selection. |
| `TextMate3: Toggle Quote Style` | `Ctrl+"` | Three-way cycle: `"…"` → `'…'` → `%Q{…}` → `"…"`. Also handles esoteric `%q`, `%Q[]`, backtick, and `%x{}` forms with proper escape/unescape. |
| `TextMate3: Toggle camelCase / snake_case` | — | Three-way case cycle: `PascalCase` → `snake_case` → `camelCase` → `PascalCase`. Preserves leading non-letter prefix (e.g. `:`). |
| `TextMate3: Toggle Block Style (do…end / { })` | `Ctrl+Shift+[` | Toggles a Ruby block between brace and keyword forms. Handles block parameters (`\|x\|`), single-line collapse, and multi-line expansion. |
| `TextMate3: Toggle Array Literal (%i/%w)` | `Ctrl+Cmd+\` | Toggles between `[:foo, :bar]` ↔ `%i( foo bar )` and `["foo", "bar"]` ↔ `%w( foo bar )`. Auto-detects symbol vs string content. |

### Source commands (active in any file)

| Command | Keybinding | Description |
| --- | --- | --- |
| `TextMate3: Wrap in Braces` | — | Single-line selection → `{selection}`; multi-line selection → `{\n<indented content>\n}`. Respects editor tab settings. **Requires a selection.** |
| `TextMate3: Unwrap Braces` | — | Removes surrounding `{…}` and unindents content by one level. |
| `TextMate3: Sort Collection` | — | Sorts items alphabetically (case-insensitive) in bracket arrays (`[:b, :a]`), `%i()`/`%w()` literals, or bare comma-separated text. |

> **Note on Wrap / Unwrap keybindings:** The TextMate originals used bare `{` / `}` keys when text was selected. In VSCode this would intercept normal typing, so no default keybinding is declared. Add your own via **Preferences → Keyboard Shortcuts** if desired.

## Macros

A TextMate2-style record/replay feature with persistent named slots.

### Commands

| Command | Default keybinding | What it does |
| --- | --- | --- |
| `TextMate3: Toggle Macro Recording` | `Cmd+Option+M` | Starts recording on first press, stops on second. Status bar shows `● Recording macro` while active. |
| `TextMate3: Replay Last Macro` | `Cmd+Shift+M` | Replays the current macro at the cursor as a single undoable edit. |
| `TextMate3: Save Current Macro As…` | — | Prompts for a name and persists the current macro under it. Confirms before overwriting. |
| `TextMate3: Load Named Macro…` | — | Quickpick of saved macros; copies the chosen one into the current slot so replay plays it. |

### Persistence

The current macro and all named macros are stored in VSCode's `globalState` (per-install, not per-workspace). They survive reloads and restarts. Recording in flight lives in extension memory until you stop — no I/O per keystroke — then is flushed in one write.

### Recording scope and caveats

- Captures everything that affects the **active text editor**: typed characters, command-driven edits, paste, cut. Switching editors mid-recording auto-stops with a warning.
- Replay is **positional, not semantic**: it replays the same character changes at translated offsets, not the same commands. "Delete word right" recorded against one position replays as removing the same characters elsewhere.
- Out-of-bounds replay edits (when the recorded offsets fall outside the target document) are skipped with a warning rather than crashing.
- Mouse-driven selection changes are dropped from recordings by default. Toggle via the `textMate3.macros.filterMouseSelection` setting.
- Recording auto-stops at `textMate3.macros.maxEvents` (default 10,000) to bound memory use.
- No multi-cursor recording, no cross-document safety check on replay, and no management UI for named macros yet.

## Repo layout

```
src/extension.ts          # activation entry: commands + providers
src/macros/                # macro recorder, player, storage, types
src/ruby/                  # pure Ruby text-transform functions
syntaxes/                  # TextMate grammars
snippets/                  # snippet files
package.json               # manifest + contributions
esbuild.config.mjs         # bundler
```

## Notes

- `publisher` (`outlawandy`) and extension `name` (`text-mate-3`) are sticky once published. Don't change them casually.
- No test suite yet. Verification is manual via the F5 dev host plus a clean install/uninstall loop.
- Built `.vsix` artifacts are gitignored.
