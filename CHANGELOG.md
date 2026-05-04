# Changelog

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
