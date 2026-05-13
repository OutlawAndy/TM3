---
title: "feat: Add Ruby text-transform commands"
type: feat
status: active
date: 2026-05-13
---

## feat: Add Ruby Text-Transform Commands

## Overview

Add eight text-manipulation commands to the TextMate3 extension, ported from the TextMate Ruby and Source bundles. Five commands are Ruby-specific (hash syntax, string/symbol, quote style, block style, array literal toggle) and three apply to any source file (identifier case, wrap braces, unwrap braces). Each command is activated by a keybinding that mirrors the TextMate original where VSCode allows it, and restricted to the appropriate language via `when` clauses.

---

## Problem Frame

The TextMate Ruby and Source bundles ship a set of smart text-transform commands that experienced Ruby developers rely on: toggling between hash syntaxes, cycling identifier casing, converting strings to symbols, toggling quote styles with proper escape handling, wrapping selections in braces, and flipping between block forms. TextMate users migrating to VSCode lose these ergonomics. Porting them as explicit VSCode commands (with keybindings and scope guards) restores parity.

---

## Requirements Trace

- R1. **Hash syntax toggle**: `{ :key => value }` ↔ `{ key: value }` — dispatch on presence of `=>` vs word-followed-by-`:`
- R2. **String/symbol toggle**: `"word"` / `'word'` ↔ `:word` — replace all matches in selection or line
- R3. **Quote style cycle** (three-way): `"…"` → `'…'` → `%Q{…}` → `"…"` — with proper escape/unescape of the delimiter character across each transition; also handles esoteric `%q`, `%Q`, `%x` styles and back-tick shell escapes. Ported from the TextMate Ruby bundle (Toggle Quote Style.plist, key `^"`).
- R4. **Identifier case cycle** (three-way): `PascalCase` → `snake_case` → `camelCase` → `PascalCase` — preserves any leading non-letter prefix. Ported from the TextMate Source bundle (Toggle CamelCase vs Underscore.tmCommand).
- R5. **Wrap in braces**: single-line selection → `{selection}`; multi-line selection → `{\n<indented content>\n}`. Ported from the TextMate Source bundle (Wrap in Braces.tmCommand, key `{` with selection).
- R6. **Unwrap braces**: selection matching `{\n…\n}` → inner content with one level of indentation removed. Ported from the TextMate Source bundle (Unwrap Braces.tmCommand, key `}` with selection).
- R7. **Ruby block style toggle**: `{ … }` (brace block) ↔ `do … end` (keyword block) — operates on the selected block; handles block parameters (`|x|`), single-line collapse, and multi-line expansion. Ported from the TextMate Ruby bundle (Toggle do…end / { … }.tmCommand, key `^{`).
- R8. **Array literal toggle**: `[:foo, :bar]` ↔ `%i( foo bar )` (symbol arrays); `["foo", "bar"]` ↔ `%w( foo bar )` (word arrays). Detects the type of content in the source array automatically — symbols use `%i`, strings/plain words use `%w`. Operates on selection. Ported from the TextMate Rangular bundle (`%i( syms ).tmCommand`, key `^@\`).
- R9. **Language scoping**: Ruby-specific commands (R1, R2, R3, R7) are restricted to Ruby files via `when: "editorLangId == 'ruby'"` in their keybindings. Source-wide commands (R4, R5, R6) use `when: "editorTextFocus"` or `when: "editorHasSelection"`.
- R9. **Keybindings declared in `package.json`**: each command that has a natural TM original keybinding gets a VSCode equivalent declared in `contributes.keybindings`. Bare-character TM keys (`{`, `}`) that would intercept normal typing are not ported as keybindings; those commands are Command Palette–accessible only.
- R10. Commands R1–R4 operate on the active selection when non-empty, or the current line when the cursor is a point. Commands R5, R6, R7 require a non-empty selection (matching TM's `dyn.selection` scope constraint).
- R11. Each transform is a pure TypeScript function, independently verifiable without a VSCode host.

---

## Scope Boundaries

- No Ruby parser — regex-based transforms throughout, faithful to the reference Ruby implementations
- Block toggle (R7) requires an explicit selection; it does not search the document for the nearest block as the TM version does (that requires scope-aware XML input and cursor env vars not available in VSCode)
- Quote style cycle (R3) does not handle string interpolation edge cases; the reference Ruby implementation does not handle them either
- Wrap in braces (R5) uses VSCode's `editor.options.tabSize` and `editor.options.insertSpaces` in place of TM's `TM_TAB_SIZE` / `TM_SOFT_TABS` env vars
- `ALL_CAPS` and `SCREAMING_SNAKE_CASE` are not handled by the case cycle — only the three forms in the reference implementation
- No automated test infrastructure — manual verification via F5 Extension Development Host only (no `@vscode/test-electron` in v1)

---

## Context & Research

### Relevant Code and Patterns

- `src/extension.ts` — all `registerCommand` calls live here inside `activate()`; each disposable is pushed onto `context.subscriptions`
- `src/macros/player.ts` — canonical example of `editor.edit(builder => builder.replace(range, newText))` and selection-or-line range derivation
- `package.json` `contributes.commands` — command declaration format with `command`, `title`, `category: "TextMate3"`
- `package.json` `contributes.keybindings` — keybinding format with `command`, `key`, `when`

### Reference TextMate Sources

| Command | Bundle | Original key | TM scope |
| --- | --- | --- | --- |
| Toggle Quote Style | Ruby | `^"` (Ctrl+") | `source.ruby string.quoted.*` |
| Toggle do…end / { } | Ruby | `^{` (Ctrl+{) | `source.ruby` |
| Wrap in Braces | Source | `{` (with selection) | `source & dyn.selection` |
| Unwrap Braces | Source | `}` (with selection) | `source & dyn.selection` |
| Toggle CamelCase vs Underscore | Source | _(none recorded)_ | `source` |

### Institutional Learnings

No matching entries in `docs/solutions/`.

---

## Key Technical Decisions

- **Pure transform module at `src/ruby/transforms.ts`**: all regex logic isolated from VSCode API; independently verifiable in a Node REPL. Follows `src/macros/` module pattern.
- **Selection-or-line for R1–R4; selection-required for R5–R7**: matches TM original behavior. Wrap, Unwrap, and Block Toggle all require `dyn.selection` in TM; requiring a non-empty selection in VSCode is the natural port.
- **Quote style cycle translates escape/unescape logic to TypeScript string manipulation**: `escape(char)` replaces any unescaped occurrence of `char` with `\char`; `unescape(char)` strips backslashes before `char`. This is a line-for-line port of the Ruby `String` extension in the reference plist.
- **Block toggle simplified to selection-based**: the TM version uses XML-encoded document with cursor position from env vars to find the nearest block. VSCode does not expose scope-aware XML input, so the user must select the block. This covers the practical common case.
- **Bare-character keybindings (`{`, `}`) not declared**: pressing `{` or `}` while text is selected would intercept normal typing in VSCode in ways users would find surprising. Those commands (Wrap, Unwrap) are Command Palette–only with no default keybinding. The user can add their own.
- **VSCode `when` clause for language scope**: `editorLangId == 'ruby'` replaces TM's `source.ruby`. Source-wide commands use `editorTextFocus` (for selection-or-line commands) or `editorTextFocus && editorHasSelection` (for selection-required commands).

---

## Open Questions

### Resolved During Planning

- **Quote style cycle: two-way or three-way?** Three-way, matching the Ruby bundle reference: `"…"` → `'…'` → `%Q{…}` → `"…"`. The original implementation also handles esoteric `%q`, `%Q[]`, `%Q()`, `%Q<>` and backtick/`%x{}` shell strings — these collapse back to `"…"` rather than cycling further.
- **Block toggle: nearest-block-to-cursor or selection?** Selection-required, given the VSCode API constraints. Documented as a known difference from TM.
- **Wrap in Braces indent source**: VSCode `TextEditorOptions.tabSize` (number) and `insertSpaces` (boolean) mirror TM's `TM_TAB_SIZE` and `TM_SOFT_TABS`.

### Deferred to Implementation

- Whether the case cycle transformer should operate globally on all words in the selection or only on the first word — the TM reference runs `toggle_case` per line from `$stdin.gets`; for VSCode the simplest match is operating on the entire selection text as one unit. The implementer should validate against multi-word selections.
- Whether `toggleStringSymbol` should handle symbols-with-hyphens (`:foo-bar`) or only `\w+` identifiers — the reference regex uses `\w+`, which is the safe default.

---

## Implementation Units

- U1. **Ruby transform module**

**Goal:** Create `src/ruby/transforms.ts` with seven pure string → string (or string → string) functions covering all seven commands.

**Requirements:** R1, R2, R3, R4, R5, R6, R7, R11

**Dependencies:** None

**Files:**

- Create: `src/ruby/transforms.ts`

**Approach:**

- `toggleHashSyntax(str)`: if `=>` present → replace `/:(\w+)\s*=>\s*/g` with `"$1: "`; elif word followed by `:` present → replace `/(\w+):(\s*<value-pattern>)/g` with `:$1 =>$2`; else identity
- `toggleStringSymbol(str)`: if `/("|')(\w+)\1/` present → gsub to `:$2`; elif `/:(\w+)/` present → gsub to `"$1"`; else identity
- `toggleQuoteStyle(str)`: implement `escape(str, char)` and `unescape(str, char)` helpers, then dispatch on the same case/when ladder as the Ruby plist:
  - `/^"(.*)"\z/ms` → `'` + unescape(`"`) + escape(`'`) + `'`
  - `/^'(.*)'\z/ms` → `%Q{` + unescape(`'`) + escape(`}`) + `}`
  - `/^%[Qq]?\{(.*)\}\z/ms` → `"` + unescape(`}`) + escape(`"`) + `"`
  - esoteric `%[Qq]?[(\[<…]` styles → collapse to `"` + unescape(closer) + escape(`"`) + `"`
  - backtick / `%x{…}` → swap between each other
  - else identity
- `toggleCamelSnake(str)`: strip leading non-letter prefix; dispatch: starts uppercase → `pascalcaseToSnakecase`; contains `_` → `snakecaseToCamelcase`; starts lowercase no `_` → capitalize first char; restore prefix
  - `pascalcaseToSnakecase`: port `gsub(/\B([A-Z])(?=[a-z0-9])|([a-z0-9])([A-Z])/, '\2_\+').downcase`
  - `snakecaseToCamelcase`: port `gsub(/_([^_]+)/) { $1.capitalize }`
- `wrapInBraces(str, tabStr)`: if str contains `\n` and starts at column 0 → multi-line form with leading indent; else → `{str}` inline. `tabStr` is passed in from `editor.options`.
- `unwrapBraces(str, tabStr)`: if str matches `/^\s*\{\s*\n([\s\S]*\n)\s*\}\s*$/` → extract inner, strip one `tabStr` prefix per line if multi-line; else return `}` (TM fallback — in VSCode, returning identity is safer when the selection doesn't match)
- `toggleBlockStyle(str)`: detect leading `{` → it's a brace block → expand to `do…end`; detect leading `do` → it's a keyword block → collapse to `{ … }`. Handle block params (`|x|`), multi-line collapse (join lines with `;`), and single-line expansion.
- `toggleArrayLiteral(str)`: two-direction dispatch:
  - **Array `[…]` → `%i`/`%w`**: extract content between `[` and `]`; split by `,\n` then `,`; strip each item's sigils (`:`/`"`/`'`); if original items had symbols (contained `:`) emit `%i( item1 item2 )`, otherwise emit `%w( item1 item2 )` (multi-row items separated by newlines matching TM output)
  - **`%i(…)` or `%w(…)` → array `[…]`**: detect type from second char (`i` = symbols, `w` = strings); extract content via `/^%[iw][\(\[\|<](.*?)[\)\]\|>]$/ms`; split by whitespace across lines; format each item as `:item` (symbols) or `"item"` (strings); emit `[ :item1, :item2 ]`
- All functions: `(str: string, …opts?) => string`, no side effects, no VSCode imports

**Technical design:** _(directional guidance, not implementation specification)_

```text
// Quote style cycle (three-way):
//   "…"       → '…'        (unescape ", escape ')
//   '…'       → %Q{…}      (unescape ', escape })
//   %Q{…}     → "…"        (unescape }, escape ")
//   esoteric  → "…"        (collapse, escape ")
//   `…`       → %x{…}
//   %x{…}     → `…`

// Block toggle:
//   { |params| body }  (single-line brace)
//     → do |params|\n  body\nend  (expanded)
//   { |params|\n  body\n}  (multi-line brace)
//     → do |params|\n  body\nend
//   do |params|\n  body\nend
//     → { |params| body }  (collapsed, lines joined with "; ")

// Wrap in braces (multi-line):
//   leading = minimum indent of non-empty lines
//   output = leading + "{\n" + content.map(+tab) + leading + "}\n"

// Wrap in braces (single-line / no-newline):
//   output = "{" + str + "}"
```

**Patterns to follow:**

- `src/macros/types.ts` — no VSCode imports, pure data/logic only

**Test scenarios:**

- Happy path — hash toggle rocket→new: `{ :foo => 1, :bar => 2 }` → `{ foo: 1, bar: 2 }`
- Happy path — hash toggle new→rocket: `{ foo: 1, bar: 2 }` → `{ :foo => 1, :bar => 2 }`
- Happy path — hash no-op: `"hello world"` → unchanged
- Happy path — string→symbol: `"hello"` → `:hello`, `'hello'` → `:hello`
- Happy path — symbol→string: `:hello` → `"hello"`
- Happy path — quote `"…"` → `'…'`: `"hello"` → `'hello'`
- Happy path — quote `'…'` → `%Q{…}`: `'hello'` → `%Q{hello}`
- Happy path — quote `%Q{…}` → `"…"`: `%Q{hello}` → `"hello"`
- Happy path — quote with escaped char: `"say \"hi\""` → `'say "hi"'` (unescape `"`, no escape needed for `'` here)
- Happy path — quote `'it\'s'` → `%Q{it's}` (unescape `'`)
- Happy path — backtick → `%x{}`: `` `ls` `` → `%x{ls}`
- Happy path — case PascalCase→snake: `FooBar` → `foo_bar`
- Happy path — case snake→camel: `foo_bar` → `fooBar`
- Happy path — case camel→Pascal: `fooBar` → `FooBar`
- Happy path — case with acronym: `URLString` → `url_string`
- Happy path — case with prefix: `:foo_bar` → `:fooBar`
- Happy path — wrap single-line: `foo` → `{foo}`
- Happy path — wrap multi-line: `"foo\nbar"` → `"{\n  foo\n  bar\n}"`
- Happy path — unwrap: `"{\n  foo\n  bar\n}"` → `"foo\nbar"`
- Edge case — unwrap non-matching: `"foo"` → identity (not `}`)
- Happy path — block brace→do (single-line): `{ |x| x * 2 }` → `"do |x|\n  x * 2\nend"`
- Happy path — block do→brace (multi-line collapse): `"do |x|\n  x * 2\nend"` → `{ |x| x * 2 }`
- Happy path — block no params: `{ puts "hi" }` → `"do\n  puts \"hi\"\nend"`
- Happy path — array symbol→%i: `[ :foo, :bar ]` → `%i( foo bar )`
- Happy path — array string→%w: `[ "foo", "bar" ]` → `%w( foo bar )`
- Happy path — %i→array: `%i( foo bar )` → `[ :foo, :bar ]`
- Happy path — %w→array: `%w( foo bar )` → `[ "foo", "bar" ]`
- Happy path — multi-row array→%i: `"[ :foo, :bar,\n  :baz ]"` → `"%i( foo bar\n  baz )"`
- Edge case — mixed sigils: content with both symbols and strings defaults to symbol detection by first sigil found

**Verification:**

- Each function can be exercised in a Node REPL with the above inputs
- No VSCode runtime required

---

- U2. **Command registration, package manifest, and keybindings**

**Goal:** Declare all seven commands and their keybindings in `package.json`; register all seven VSCode handlers in `extension.ts` with the correct selection-or-line vs selection-required range logic.

**Requirements:** R8, R9, R10

**Dependencies:** U1

**Files:**

- Modify: `package.json`
- Modify: `src/extension.ts`

**Approach:**

In `package.json` `contributes.commands`, add eight entries:

| Command ID | Title |
| --- | --- |
| `textMate3.ruby.toggleHashSyntax` | TextMate3: Toggle Ruby Hash Syntax |
| `textMate3.ruby.toggleStringSymbol` | TextMate3: Toggle String/Symbol |
| `textMate3.ruby.toggleQuoteStyle` | TextMate3: Toggle Quote Style |
| `textMate3.ruby.toggleCamelSnake` | TextMate3: Toggle camelCase / snake_case |
| `textMate3.source.wrapInBraces` | TextMate3: Wrap in Braces |
| `textMate3.source.unwrapBraces` | TextMate3: Unwrap Braces |
| `textMate3.ruby.toggleBlockStyle` | TextMate3: Toggle Block Style (do…end / { }) |
| `textMate3.ruby.toggleArrayLiteral` | TextMate3: Toggle Array Literal (%i/%w) |

In `package.json` `contributes.keybindings`, add entries for commands with natural TM keybindings:

| Command | `key` | `when` |
| --- | --- | --- |
| `toggleQuoteStyle` | `ctrl+"` | `editorTextFocus && editorLangId == 'ruby'` |
| `toggleBlockStyle` | `ctrl+shift+[` | `editorTextFocus && editorHasSelection && editorLangId == 'ruby'` |
| `toggleArrayLiteral` | `ctrl+cmd+\` | `editorTextFocus && editorHasSelection && editorLangId == 'ruby'` |

Notes:

- TM's `^"` = Ctrl+" → maps directly to `ctrl+"` in VSCode
- TM's `^{` = Ctrl+{ → `ctrl+{` conflicts with VSCode's fold shortcut; use `ctrl+shift+[` (same physical key as `{`) scoped to Ruby with selection
- Wrap/Unwrap Braces: TM uses bare `{`/`}` with selection (would intercept typing); no default keybinding declared — Command Palette only
- Array literal toggle: TM key `^@\` = Ctrl+Cmd+\ → maps to `ctrl+cmd+\` in VSCode
- Hash, string/symbol, case commands: no TM keybinding recorded; no default declared

In `extension.ts` `activate()`:

- **Selection-or-line** (R1–R4): `range = selection.isEmpty ? doc.lineAt(selection.active).range : selection`
- **Selection-required** (R5–R7): guard with `if (editor.selection.isEmpty) { showInformationMessage("Select the text to transform first."); return; }`
- For R5 (wrapInBraces): pass `editor.options` to derive `tabStr` (spaces or tab character)
- For R6 (unwrapBraces): same `tabStr` derivation
- All handlers: `editor.edit(b => b.replace(range, transformed))` for single-undo-step edit

**Patterns to follow:**

- Existing macro command registrations in `extension.ts` for `registerCommand` / `context.subscriptions.push`
- `player.ts` for `editor.edit(builder => builder.replace(…))`

**Test scenarios:**

- Happy path — quote toggle via keybinding `Ctrl+"` in a `.rb` file: selection `"hello"` → replaced with `'hello'`
- Happy path — quote toggle in a `.ts` file: keybinding does not fire (language guard)
- Happy path — block toggle via keybinding in `.rb` file with selection: `{ |x| x }` → `do |x|\n  x\nend`
- Happy path — wrap braces via Command Palette with selection `foo` → `{foo}`
- Happy path — unwrap braces via Command Palette with selection `{\n  foo\n}` → `foo`
- Happy path — wrap/unwrap keybinding `{`/`}` fires in `.rb` file: NOT intercepted (no keybinding declared)
- Edge case — selection-required command with no selection: shows information message, no edit applied
- Edge case — no active editor: guard exits silently
- Happy path — single undo step: any transform is reversible with Ctrl+Z / Cmd+Z

**Verification:**

- F5 Extension Development Host: exercise each command via Command Palette and keybinding against sample Ruby content
- Confirm keybinding language guards work (toggle fires in `.rb`, silent in `.ts`)

---

- U3. **Documentation update**

**Goal:** Document all seven commands in the README (with scope notes and keybindings) and add a CHANGELOG entry.

**Requirements:** R1–R10

**Dependencies:** U2

**Files:**

- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Approach:**

- In README, add a "Ruby Commands" and "Source Commands" subsection under Commands, listing each command's name, description, keybinding (or "Command Palette only"), and scope (Ruby-only vs any source file)
- Note that Wrap/Unwrap Braces have no default keybinding and explain why (would intercept typing)
- In CHANGELOG, add `0.0.3` entry listing the eight new commands

**Test scenarios:**

- Test expectation: none — documentation only, no behavioral change

**Verification:**

- README renders correctly in VSCode Markdown preview
- CHANGELOG version and entry are accurate

---

## System-Wide Impact

- **Interaction graph:** All eight commands are stateless, discrete invocations — no observers, callbacks, or event subscriptions are added
- **Error propagation:** `editor.edit()` returns a boolean; a `false` result should surface a short error message. No external APIs.
- **State lifecycle risks:** None — no `globalState`, no persistent storage touched
- **Keybinding conflicts:** `ctrl+"` is not currently bound by VSCode or the extension; `ctrl+shift+[` may overlap with "Fold Current Block" on some platforms — the implementer should verify and choose an alternative if needed
- **Unchanged invariants:** Macro recording/playback, snippets, TextMate grammars, and existing commands are entirely unaffected

---

## Risks & Dependencies

| Risk | Mitigation |
| --- | --- |
| JS regex differences from Ruby (e.g., `\b`, multiline flags) | Validate each TypeScript function against the exact reference sample inputs in a Node REPL before wiring commands |
| Quote cycle escape logic bugs | The `escape`/`unescape` helpers are the trickiest part; test with strings containing the delimiter and pre-escaped sequences |
| `ctrl+shift+[` keybinding conflict with VSCode fold command | Verify in F5 dev host; if conflict exists, leave block toggle Command Palette–only and document the suggested binding |
| Block toggle regex missing edge cases (nested blocks, string containing `do`/`end`) | Regex-based detection is inherently limited; document that complex nested blocks may require manual adjustment |
| Wrap in braces indent calculation: TM used minimum non-empty indent; VSCode equivalent uses editor tab settings | Pass `editor.options.tabSize` and `editor.options.insertSpaces` to the transform function so indentation matches the active editor settings |

---

## Sources & References

- Related code: `src/extension.ts`, `src/macros/player.ts`, `src/macros/types.ts`
- Reference: TextMate Ruby bundle — `Toggle Quote Style.plist` (key `^"`, scope `source.ruby string.quoted.*`)
- Reference: TextMate Ruby bundle — `Toggle 'do … end' : '{ … }'.tmCommand` (key `^{`, scope `source.ruby`)
- Reference: TextMate Source bundle — `Wrap in Braces.tmCommand` (key `{` with selection, scope `source & dyn.selection`)
- Reference: TextMate Source bundle — `Unwrap Braces.tmCommand` (key `}` with selection, scope `source & dyn.selection`)
- Reference: TextMate Source bundle — `Toggle CamelCase vs Underscore.tmCommand`
- Reference Ruby implementations for hash, string/symbol: provided in planning prompt
- Reference: TextMate Rangular bundle — `%i( syms ).tmCommand` (key `^@\` = Ctrl+Cmd+\, no scope)
