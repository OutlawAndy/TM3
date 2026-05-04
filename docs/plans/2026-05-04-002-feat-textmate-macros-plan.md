---
title: "feat: TextMate2-style custom macros (record, replay, named slots)"
type: feat
status: active
date: 2026-05-04
---

# feat: TextMate2-style custom macros (record, replay, named slots)

## Overview

Add four commands to the TextMate3 extension:

- **Toggle recording** (`Cmd+Option+M` by default) — first invocation begins capturing edits and selection changes in the active text editor; second invocation stops and stores the captured macro as the *current* macro.
- **Replay last macro** (`Cmd+Shift+M` by default) — applies the current macro at the cursor position in the active editor.
- **Save current macro as…** (no default keybinding) — names the current macro and persists it under that name for later recall. Goes beyond TextMate2.
- **Load named macro…** (no default keybinding) — quickpick of saved names; loads the chosen macro into the *current* slot so the existing replay command can play it.

Recording itself happens in memory while in progress (no I/O per keystroke). When recording stops, the captured macro is flushed to VSCode's `globalState` so it survives extension reloads and VSCode restarts. Saved named macros live in the same `globalState`, under a separate keyspace.

---

## Problem Frame

TextMate2 had a "custom macros" feature that let the user record a sequence of editor actions with one key chord and replay them with another. It is the single most-missed TextMate2 feature when working in VSCode for repetitive structural edits (renaming patterns, transforming list items, applying the same multi-step edit at several call sites). VSCode has multi-cursor and snippets, but neither replaces the freeform "do this thing once, then repeat" workflow.

There is no built-in VSCode equivalent; existing marketplace extensions for this are either unmaintained or scoped to predefined command chains rather than freeform recording. Andy wants this in his personal extension so it lives alongside his other tweaks. The named-slot feature extends past TextMate2 — useful for keeping a small library of frequent transformations within reach.

---

## Requirements Trace

- R1. A palette command (default `Cmd+Option+M`) toggles macro recording in the active text editor. First press starts; second press stops.
- R2. While recording, all changes to the active editor's document (text edits, deletions, inserts via any source) and all selection/cursor changes are captured as an ordered event stream.
- R3. A second palette command (default `Cmd+Shift+M`) replays the **current** macro at the current cursor position in the active editor.
- R4. The user has clear visual feedback that recording is active (status bar indicator) and confirmation messages on start, stop, save, load, and replay.
- R5. Switching the active editor mid-recording stops recording and warns the user.
- R6. Recording length is bounded by a configurable cap (default 10,000 events) to prevent runaway memory growth from accidental long recordings.
- R7. Replay is a no-op (with a notification) when no macro has been recorded or loaded yet, or when the current macro is empty.
- R8. **The current macro persists across extension reloads and VSCode restarts.** When the user records, then closes VSCode, then reopens it, the replay command still plays the most recently recorded macro until they record a new one or load a different one.
- R9. **Save current macro as…** prompts for a name and persists the current macro under that name. If the name is already in use, the user is asked to confirm overwrite.
- R10. **Load named macro…** offers a quickpick of saved names and loads the chosen macro into the current slot. Replay then plays it. The load command is a no-op (with a notification) when no named macros exist.

---

## Scope Boundaries

- **No editing macros after capture.** The recorded buffer is opaque; rerecord (or load and rerecord) to change it.
- **No multi-cursor support during recording.** Only the primary selection is captured; secondary cursors during recording are ignored.
- **No semantic command replay.** Replay applies recorded text edits at translated offsets — it does not re-execute commands like "delete word right" semantically. (See Alternatives Considered.)
- **No replay across documents with safety checks.** Replay always targets the active editor at invocation time. If that editor differs from the one used during recording, replay still attempts to apply the recorded edits — there is no document-identity check.
- **No recording outside the active text editor.** Command palette, file tree, search box, terminal — all out of scope.
- **No delete / rename for named macros in v1.** The user can manage them by overwriting (save under the same name) or by manually clearing `globalState`. A management UI is a v2 follow-up.
- **No export/import of named macros.** Storage is `globalState`-local to this VSCode install. Sharing macros across machines is a v2 follow-up.

### Deferred to Follow-Up Work

- A management UI for named macros (list, delete, rename, preview).
- Export/import of named macros to a JSON file (e.g., for syncing across machines or sharing).
- Hybrid `type`-command interception for higher-fidelity command-level recording.
- Promotion of macro storage from `globalState` to dedicated JSON files under `context.globalStorageUri` if size limits become a concern.
- Multi-cursor recording.

---

## Context & Research

### Relevant Code and Patterns

- [src/extension.ts](../../src/extension.ts) — current activation entry. The hover provider and `helloWorld` command registration patterns will be mirrored for the new commands.
- [package.json](../../package.json) — `contributes.commands`, `contributes.keybindings`, and `contributes.configuration` are added here.

### Institutional Learnings

- None applicable (no `docs/solutions/` entries in this repo yet).

### External References

- VSCode Extension API: `vscode.workspace.onDidChangeTextDocument` (provides `TextDocumentContentChangeEvent[]` with `range`, `rangeOffset`, `rangeLength`, `text`).
- VSCode Extension API: `vscode.window.onDidChangeTextEditorSelection` (provides selection change details and source `kind`).
- VSCode Extension API: `TextEditor.edit()` callback for applying programmatic edits with proper undo grouping.
- VSCode Extension API: `vscode.window.createStatusBarItem()` for the recording indicator.
- VSCode Extension API: `vscode.window.showInputBox()` for the save-name prompt and `vscode.window.showQuickPick()` for the load picker.
- VSCode Extension API: `context.globalState.get<T>()` / `context.globalState.update()` for persistent extension storage.

---

## Key Technical Decisions

- **Storage layer: `context.globalState`.** Standard VSCode extension persistence. Survives reloads and restarts. Stored at the user-data level (per VSCode install), not per-workspace. No file IO to manage. If recordings ever outgrow it, promote to JSON files under `context.globalStorageUri` — explicitly deferred for v1.
- **Storage shape:**
  - `textMate3.macros.current` → the active replayable macro (`MacroEvent[]` or null).
  - `textMate3.macros.named` → a map of `name → MacroEvent[]`, stored as a JSON-serializable object.
  - All event payloads are plain JSON (numbers, strings) so `globalState` (which JSON-serializes) round-trips them losslessly.
- **In-memory during active recording, flushed on stop.** Events accumulate in a recorder-local array while recording is in progress — no `globalState.update()` per keystroke. On stop (toggle, cap, or editor switch), the buffer is written once to `current`. Replay reads from `current`, falling back to the live recorder buffer if a recording is somehow active at replay time (defensive).
- **Event-based recording over `type`-command interception.** Subscribing to `onDidChangeTextDocument` + `onDidChangeTextEditorSelection` captures the *result* of every editor action (typed characters, command-driven edits, paste, cut, multi-cursor inserts) without enumerating which built-in commands to wrap. Trade-off: replay is positional, not semantic. Acceptable for v1.
- **Anchor-relative offsets.** At recording start, capture the active selection's primary anchor offset. Each recorded change stores `(rangeOffset - anchor, rangeLength, newText)`. At replay, the current cursor's offset becomes the new anchor and recorded deltas are translated.
- **Single "current" slot, multiple named slots.** The current slot is what replay always targets. Save copies current → named slot. Load copies named slot → current. This keeps the user-facing model simple (one button to replay; named slots are for storage).
- **Recording is bound to the editor that was active at start.** If `onDidChangeActiveTextEditor` fires while recording, stop recording, flush the buffer, and notify.
- **Replay uses a single `editor.edit()` callback.** All recorded edits are applied inside one edit callback so they form one undo step — consistent with TextMate2.
- **Status bar indicator.** A right-aligned `StatusBarItem` shows `● Recording macro` with a red error background while recording.
- **Macro schema versioning.** Persisted macros carry a `version` field (start at `1`). Loaders refuse to play a macro whose version they don't recognize, surfacing a friendly error rather than crashing or silently misinterpreting events. Cheap insurance against future schema changes.

---

## Open Questions

### Resolved During Planning

- **Where are recordings stored?** `context.globalState`. Survives reloads. In-memory while active recording is in progress; flushed on stop.
- **What does "reactivate a named macro" mean?** Load it back into the *current* slot via a `Load named macro…` command. Replay then plays it. Same affordance as a freshly recorded macro.
- **Should the save command overwrite silently if the name exists?** No — confirm with the user via a modal information message.
- **Where does recording happen — globally or per-editor?** Per-editor. Switching editors stops recording.
- **What event source captures everything we need?** `onDidChangeTextDocument` + `onDidChangeTextEditorSelection` together capture document edits and cursor movement. We do not need to override `type` for v1.
- **Default keybindings?** `Cmd+Option+M` for toggle-record, `Cmd+Shift+M` for replay. Save and Load have no default keybindings — they live in the palette only, since their cadence is much lower.

### Deferred to Implementation

- Whether `onDidChangeTextEditorSelection` events whose `kind` is `Mouse` should be filtered out during recording. Likely yes; verify the event's `kind` field semantics during implementation.
- Whether to deduplicate consecutive identical no-op selection changes the API may emit. Add only if implementation reveals noisy traces.
- Exact wording of user-facing messages (start, stop, replay, save, load, overwrite confirm, no-macro, cap-hit, editor-switch).
- Whether replay should reposition the final cursor at the end of the last recorded edit (TextMate2 behavior) or leave it where the last edit naturally placed it. Default to TextMate2 behavior.
- Whether to skip recording when the document change source is external (formatter, git revert). API does not expose source attribution directly; accept that programmatic edits during recording will be captured too.
- Sane upper bound on the number of named macros before the save command starts warning. `globalState` accepts large values but oversized state hurts startup. Pick a soft cap during implementation (e.g., 100) and warn past it.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
                         ┌──────────────────┐
   Cmd+Option+M ────────►│  toggleRecord()  │
                         └────────┬─────────┘
                                  │
              ┌───────────────────┴────────────────┐
              ▼                                    ▼
       recording == off                     recording == on
              │                                    │
   capture activeEditor                    flush buffer to
   capture anchor offset                   globalState["…current"]
   subscribe doc + selection               unsubscribe listeners
   show status bar                         hide status bar
              │                                    │
              ▼                                    ▼
    (events flow into                  current macro persisted;
     recorder.append)                   survives reload

   Cmd+Shift+M ────────► replay()
                            │
                            ▼
              load globalState["…current"]
              if null/empty: notify, return
              else apply at current cursor
              (single editor.edit, single undo step)

   "Save Macro As…"  ────►  prompt name → write globalState["…named"][name]
   "Load Named Macro…" ──►  quickpick   → copy globalState["…named"][name]
                                              → globalState["…current"]
```

Persisted macro shape (sketch — final form is implementer's call):

```
PersistedMacro = {
  version: 1,
  anchorOffset: number,           // original recording-start anchor (kept for diagnostics)
  events: RecordedEvent[]
}

RecordedEvent =
  | { kind: "edit",   offsetDelta: number, rangeLength: number, text: string }
  | { kind: "select", anchorDelta: number, activeDelta: number }
```

---

## Implementation Units

- U1. **Manifest contributions: commands, keybindings, configuration**

**Goal:** Declare all four new commands, default keybindings for the two that have them, and the configurable knobs. No runtime code yet.

**Requirements:** R1, R3, R6, R9, R10

**Dependencies:** None

**Files:**
- Modify: `package.json`

**Approach:**
- `contributes.commands`:
  - `textMate3.macros.toggleRecord` — "TextMate3: Toggle Macro Recording"
  - `textMate3.macros.replay` — "TextMate3: Replay Last Macro"
  - `textMate3.macros.saveAs` — "TextMate3: Save Current Macro As…"
  - `textMate3.macros.loadNamed` — "TextMate3: Load Named Macro…"
  - All under category "TextMate3" so they group in the palette.
- `contributes.keybindings`:
  - `cmd+alt+m` → `textMate3.macros.toggleRecord`, `when: editorTextFocus`
  - `cmd+shift+m` → `textMate3.macros.replay`, `when: editorTextFocus`
  - No default keybindings for save/load — palette-only.
- `contributes.configuration` properties:
  - `textMate3.macros.maxEvents` (number, default 10000, min 100, max 100000) — recording length cap.
  - `textMate3.macros.filterMouseSelection` (boolean, default true) — drop mouse-driven selection changes during recording.

**Patterns to follow:**
- Existing `textMate3.helloWorld` command + `textMate3.greeting` configuration patterns in [package.json](../../package.json).

**Test scenarios:**
- Test expectation: none — declarative manifest only. Manual verification: command palette shows all four commands; default keybindings appear in `Preferences: Open Keyboard Shortcuts`; settings UI shows the new properties.

**Verification:**
- `vsce ls` succeeds (manifest valid).
- Reloading the dev host shows all four commands in the palette.
- Default keybindings are listed in Keyboard Shortcuts.

---

- U2. **Recorder: capture document and selection events**

**Goal:** Implement the recording side. Module exposes `start(editor)`, `stop()`, and tracks the in-flight event buffer.

**Requirements:** R2, R5, R6

**Dependencies:** U1

**Files:**
- Create: `src/macros/recorder.ts`
- Modify: `src/extension.ts` (wire up `toggleRecord` command, status bar, active-editor change watcher)

**Approach:**
- `Recorder` holds: target `TextEditor`, anchor offset (computed from `editor.selection.active` via `document.offsetAt`), event buffer, max-events cap from config, disposables for the two event subscriptions.
- On `start(editor)`: capture anchor, subscribe to `vscode.workspace.onDidChangeTextDocument` (filter for `event.document === editor.document`) and `vscode.window.onDidChangeTextEditorSelection` (filter for `event.textEditor === editor`). Clear any previous in-flight buffer.
- On document change: for each `contentChange`, push an `edit` event with `offsetDelta = rangeOffset - anchor`, `rangeLength`, and `text`. If buffer length exceeds cap, stop and notify (R6).
- On selection change: if `filterMouseSelection` is true and `event.kind === Mouse`, skip. Otherwise push a `select` event with anchor and active offsets relative to the recording anchor. Primary selection only.
- On `stop()`: dispose subscriptions, return the captured event list and the original anchor offset.
- In `extension.ts`: maintain `currentRecorder: Recorder | null`. First press creates and starts; second press stops, hands the result to the storage layer (U5) for flushing to `globalState`, clears the recorder, hides the status bar.
- Subscribe to `vscode.window.onDidChangeActiveTextEditor`: if recording is active and the editor changed, call `stop()` (which flushes via U5) and show a warning.

**Patterns to follow:**
- Push every disposable onto `context.subscriptions` (already followed in [src/extension.ts](../../src/extension.ts)).
- Read configuration via `vscode.workspace.getConfiguration("textMate3.macros")` mirroring the existing `textMate3.greeting` pattern.

**Test scenarios:**
- Test expectation: none for v1 — no test framework in place per origin scaffold non-functional requirements (see [docs/brainstorms/personal-editor-extension-requirements.md](../brainstorms/personal-editor-extension-requirements.md)). Adding `@vscode/test-electron` is a deliberate v2 follow-up.
- Manual verification (during dev host F5):
  - **Happy path:** Toggle → status bar shows recording. Type "hello", move cursor, type more. Toggle again → status bar clears, no errors. Recorded buffer length matches actions.
  - **Switching editors:** Start recording in file A. Switch to file B. Recording stops automatically; warning shown; the partial macro is still flushed to `current`.
  - **Recording cap:** Set `maxEvents` to 5. Type 6 characters. Recording auto-stops with a notification.
  - **No active editor:** Close all editors. Toggle. Notification "Open a text editor to record a macro"; nothing else happens.
  - **Mouse-selection filter:** With `filterMouseSelection: true`, click around in the editor while recording. Clicks are not appended to the buffer.

**Verification:**
- F5 dev host: starting recording shows the indicator; typing and cursor movement complete without error.
- Stopping recording leaves the editor clean (no leftover listeners — verify by recording multiple times and confirming bounded listener count via Extension Host dev tools).
- Switching editors mid-recording surfaces the warning and stops cleanly.

---

- U5. **Storage layer: persistent current and named macro slots**

**Goal:** Centralize all `globalState` reads and writes. Provide a small typed API for the rest of the extension.

**Requirements:** R8, R9, R10

**Dependencies:** U1

**Files:**
- Create: `src/macros/storage.ts`
- Create: `src/macros/types.ts` (shared `MacroEvent` and `PersistedMacro` types)

**Approach:**
- Module accepts `context: ExtensionContext` at activation and exposes:
  - `getCurrent(): PersistedMacro | null`
  - `setCurrent(macro: PersistedMacro): Promise<void>`
  - `clearCurrent(): Promise<void>`
  - `listNamed(): string[]` (sorted)
  - `getNamed(name: string): PersistedMacro | null`
  - `saveNamed(name: string, macro: PersistedMacro): Promise<void>`
  - `hasNamed(name: string): boolean`
- Storage keys: `textMate3.macros.current` and `textMate3.macros.named`. The named map is a single object value `{ [name: string]: PersistedMacro }` updated atomically via `globalState.update`.
- All persisted values include `version: 1`. `getCurrent` and `getNamed` validate the version field; on mismatch they return `null` and emit a warning via VSCode's logger so future schema changes degrade gracefully instead of crashing.
- Defensive guards: `saveNamed` rejects empty or whitespace-only names. `getNamed` returns null for unknown names rather than throwing.

**Patterns to follow:**
- Pass `ExtensionContext` through `activate()` rather than reaching for it elsewhere — already the pattern in [src/extension.ts](../../src/extension.ts).

**Test scenarios:**
- Test expectation: none for v1. Manual verification covers the persistence behavior end-to-end.
- Manual verification (during dev host F5):
  - **Persistence round-trip:** Record a macro. Reload the dev host (Cmd+R in the dev host window). Trigger replay → macro plays correctly with the same content as before reload.
  - **Named save and recall:** Record macro A. Save as "alpha". Record macro B. Save as "beta". Load Named → "alpha". Replay → macro A plays. Reload dev host. Load Named → list still shows "alpha" and "beta" in sorted order.
  - **Version-mismatch resilience:** Manually edit the stored value's `version` to `99` via dev tools; trigger replay → user sees a friendly warning, no crash.

**Verification:**
- F5 dev host: persistence round-trip works after reload.
- Named slots list and survive reload.
- Schema version mismatch is handled gracefully.

---

- U3. **Player: replay current macro**

**Goal:** Implement replay. Read the current macro from storage, apply at the cursor as a single undoable edit, position the cursor at the natural end of the last recorded edit.

**Requirements:** R3, R7, R8

**Dependencies:** U2, U5

**Files:**
- Create: `src/macros/player.ts`
- Modify: `src/extension.ts` (wire up `replay` command)

**Approach:**
- `play(editor, macro)` translates each recorded `offsetDelta` into an absolute offset by adding the current selection's active offset (the new anchor).
- Apply all `edit` events inside a single `editor.edit(builder => …)` callback so the entire replay forms one undo step.
- Selection-change events are used during replay only to compute the **final** cursor position: the last `select` event's `activeDelta` is the destination. Intermediate selections are not re-applied (they'd be no-ops inside a single edit callback).
- After the edit callback resolves, set `editor.selection` to the translated final cursor (collapsed, zero-width selection at the active offset).
- Replay command handler:
  - Load `current` from storage (U5).
  - If null or empty: notification "No macro recorded yet" (or "Recorded macro is empty"); return.
  - If no active text editor: notification "Open a text editor to replay a macro"; return.
  - Otherwise call `play(activeEditor, macro)`.

**Patterns to follow:**
- Disposable command registration pattern from [src/extension.ts](../../src/extension.ts).

**Test scenarios:**
- Test expectation: none for v1.
- Manual verification (during dev host F5):
  - **Happy path:** Record typing "// note: " at start of a line. Move cursor elsewhere. Replay → same prefix appears at the new cursor.
  - **Empty macro:** Replay before any recording → notification; document unchanged.
  - **Record-stop-replay-replay:** Record once, replay twice in different positions. Each replay applies independently as one undo step each.
  - **Undo:** After replay, Cmd+Z once. The entire replayed macro reverts in a single undo step.
  - **Replay after reload:** Record a macro, reload dev host (Cmd+R), replay → still works (Covers R8).
  - **No active editor:** Close all editors, invoke replay → notification, no error.
  - **Replay across documents:** Record in file A, switch to file B, replay → edits apply in B at current cursor (positional behavior — surprising results possible if B is structurally different; documented in README).
  - **Edit-conflict failure:** If `editor.edit()` returns false (concurrent edit conflict), notification "Macro replay failed — try again".

**Verification:**
- F5 dev host: every manual scenario above behaves as described.
- Cmd+Z after a replay collapses the entire macro into one undo step.
- TypeScript compiles with no errors under strict mode.

---

- U6. **Save-as and Load-named commands**

**Goal:** Wire the two named-slot commands. Save prompts for a name, confirms overwrite, persists. Load offers a quickpick of saved names and copies the chosen macro into the current slot.

**Requirements:** R9, R10

**Dependencies:** U5

**Files:**
- Modify: `src/extension.ts`

**Approach:**
- **Save Current Macro As…**:
  - Read `current` from storage. If null/empty: notification "No current macro to save"; return.
  - Prompt with `vscode.window.showInputBox({ prompt: "Macro name", validateInput: trimming + non-empty check })`. Cancel returns silently.
  - If `storage.hasNamed(name)`: confirm overwrite via `vscode.window.showInformationMessage(…, { modal: true }, "Overwrite", "Cancel")`. Cancel returns silently.
  - `storage.saveNamed(name, current)`. Success notification including the name and event count.
- **Load Named Macro…**:
  - Read `storage.listNamed()`. If empty: notification "No saved macros"; return.
  - `vscode.window.showQuickPick(names, { placeHolder: "Pick a macro to make current" })`. Cancel returns silently.
  - `storage.setCurrent(storage.getNamed(name)!)`. Success notification "Loaded '<name>' as current macro".

**Patterns to follow:**
- Existing command registration pattern in [src/extension.ts](../../src/extension.ts).

**Test scenarios:**
- Test expectation: none for v1.
- Manual verification (during dev host F5):
  - **Save happy path:** Record macro. Run Save As → enter "alpha" → confirmation. Reload dev host. Run Load Named → "alpha" appears in picker → select → notification.
  - **Save with no current macro:** Save As before any recording → notification, no prompt shown.
  - **Save with empty name / whitespace name:** Input box rejects (validateInput) before submit.
  - **Save overwrite confirm:** Save As "alpha" twice with different recordings → second time the modal asks to overwrite; declining leaves the original in place.
  - **Load with no saved macros:** Load Named on a fresh install → notification, no picker shown.
  - **Load → Replay round-trip:** Save macro A as "alpha". Record macro B (now current is B). Load Named → "alpha". Replay → plays A, not B.
  - **Cancel paths:** Cancel the input box / picker / overwrite modal at each step; no side effects.

**Verification:**
- F5 dev host: every manual scenario above behaves as described.
- Saved names persist across dev-host reloads.

---

- U4. **Status bar indicator, notification copy, and README**

**Goal:** Hook up the status bar indicator and consolidate user-facing copy. Document the new feature.

**Requirements:** R4

**Dependencies:** U2, U3, U6

**Files:**
- Create: `src/macros/statusBar.ts` (or fold into recorder if it fits cleanly)
- Modify: `src/extension.ts`
- Modify: `README.md`
- Modify: `CHANGELOG.md` (entry for 0.0.2)

**Approach:**
- One `vscode.window.createStatusBarItem(StatusBarAlignment.Right, 100)` at activation. Hidden by default.
- On recording start: `text: "$(record) Recording macro"`, `backgroundColor: new ThemeColor("statusBarItem.errorBackground")`, then `show()`.
- On any stop path (toggle, cap, editor switch, error): `hide()`, clear `backgroundColor`. Centralize this in a single helper so no stop path is missed.
- Push the status bar item onto `context.subscriptions`.
- Notification copy passes — finalize wording for: recording started, recording stopped (with event count), replay applied, replay no-op (no macro / empty / no editor), cap hit (with event count), editor-switch auto-stop, save success, save no-current, save overwrite confirm, load success, load empty.
- README: new "Macros" section covering the four commands, default keybindings, persistence semantics (current macro survives reload, named macros persist forever), recording scope (active text editor only), and known caveats (positional replay, schema versioning).
- CHANGELOG: 0.0.2 entry summarizing the macro feature.

**Patterns to follow:**
- README structure already established in [README.md](../../README.md) — add a new section in the same voice.

**Test scenarios:**
- Test expectation: none — primarily UI/copy/docs work.
- Manual verification:
  - Status bar item appears only while recording, disappears on every stop path (toggle, cap, editor switch, error).
  - Each notification fires exactly once per its trigger and reads sensibly.
  - README accurately describes v1 behavior including persistence and caveats.

**Verification:**
- F5 dev host: every notification message is grammatical, specific, and shown at the right time.
- Status bar indicator never lingers after recording ends.
- README's macros section accurately describes v1 behavior.

---

## Alternative Approaches Considered

- **Temp-file storage instead of `globalState`.** User initially asked about temp files. Rejected: OS temp dirs are cleared unpredictably (boot, idle), so persistence wouldn't be reliable. `globalState` is the standard VSCode persistence mechanism and lives in stable user-data storage.
- **`type`-command override for command-level recording.** Register a handler for VSCode's built-in `type` command and intercept all typed characters; combine with manually wrapping common editor commands. Rejected for v1: the wrapping surface is large, fragile, and incomplete. Event-based recording captures the same effective edits with less code. Reconsider if positional replay turns out to be too limiting.
- **Periodic snapshot recording (record full document state, replay as diff).** Simpler to record but produces enormous replay edits and breaks down on large documents. Rejected.
- **Per-workspace storage (`workspaceState`) for current + named macros.** Considered. Rejected because the user's likely use case is reusing the same macro across projects (e.g., a snippet they record once and replay everywhere). Per-install (`globalState`) matches that intent. Per-workspace can be added later if scoping ever matters.
- **A single combined "Save and replay later" command with a name argument.** Rejected: separating save from load matches VSCode's idioms (save commands prompt, replay is keybindable) and keeps the keybinding-able replay command argument-free.

---

## System-Wide Impact

- **Interaction graph:** Subscribes to `onDidChangeTextDocument`, `onDidChangeTextEditorSelection`, and `onDidChangeActiveTextEditor`. Subscriptions are scoped to the lifetime of an active recording (created in `start`, disposed in `stop`).
- **Error propagation:** All command handlers wrap their bodies in try/catch and surface failures via `showErrorMessage`. A failed `editor.edit()` (returns false) surfaces a notification but does not throw. Storage write failures (`globalState.update` rejects) bubble up as error notifications.
- **State lifecycle risks:**
  - The status bar item must be hidden on every stop path or the indicator gets stuck. Centralized in U4.
  - `globalState` writes are async; back-to-back recordings could in theory race. Serialize storage writes by `await`ing each `update` before issuing the next; the recording-stop path is naturally sequential so this is mostly free.
  - Schema-version mismatches on persisted macros are surfaced as friendly warnings rather than crashes (U5).
- **API surface parity:** N/A.
- **Integration coverage:** Manual F5 dev-host walkthrough remains the v1 verification mechanism per scaffold non-functional requirements. The persistence and reload scenarios in U5/U3 specifically verify behavior across extension restarts.
- **Unchanged invariants:** The existing `textMate3.helloWorld` command, `textMate3.greeting` configuration, Markdown injection grammar, snippet, and hover provider remain unchanged. Activation events expand but do not remove existing entries.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Event-based replay is positional, not semantic. | Document explicitly in README. Most TextMate2 macro use cases work fine with positional replay. Reconsider with `type` override if real use shows the gap. |
| `onDidChangeTextDocument` fires for *all* document changes, including programmatic edits from other extensions. | Accept for v1 — Andy is aware of the constraint. Add a `filterExternalChanges` option in a follow-up if it becomes annoying. |
| Status bar indicator could get stuck visible if a stop path is missed. | Centralize show/hide in a single helper (U4). Manual verification scenario explicitly checks. |
| Recording an extremely long session could consume large amounts of memory before being flushed. | `maxEvents` cap (default 10,000) auto-stops with a notification. Buffer is in-memory only during active recording, so the worst case is bounded. |
| `globalState` has a soft size limit. Many large named macros could bloat it. | Monitor in practice; `listNamed` makes the surface visible. Promote to `globalStorageUri` JSON files in a follow-up if storage growth becomes a real concern. |
| Replay across different documents may produce surprising results when offsets fall outside the new document's bounds. | `editor.edit()` silently drops out-of-bound edits; defensive check at replay start surfaces a notification when the recorded anchor offset is beyond the target document length. |
| Persisted macros from an old extension version may not match a future event schema. | `version` field on every persisted macro; loaders refuse unknown versions with a friendly warning rather than misinterpreting. |
| Conflict with built-in or other-extension keybindings on `Cmd+Shift+M` and `Cmd+Option+M`. | Use `editorTextFocus` `when` clause so the binding only fires when the editor has focus. Document defaults in README; user can rebind freely. |
| Save Macro As… without confirmation could silently overwrite. | Modal overwrite confirm (U6). |

---

## Documentation / Operational Notes

- README gets a new "Macros" section in U4 covering all four commands, keybindings, persistence semantics, recording scope, and caveats.
- CHANGELOG: bump to 0.0.2 on shipping; entry summarizes the new feature, lists the new commands, default keybindings, configuration keys, and the `globalState` persistence semantics.
- No marketplace or rollout concerns — personal extension, sideload only.
- No telemetry. Status bar item and notifications are the only feedback channels.
- Power-user note (worth a one-line README mention): named macros can be cleared by hand via `Developer: Reload Window` after running the Command Palette command `Developer: Show Workspace Storage` and editing the relevant key, or by running a temporary `textMate3.macros.clearAll` command if the user adds one. Out of scope for v1 — flagged as a deferred enhancement.

---

## Sources & References

- **Origin document:** None — this plan was written directly from the user's request, not from a `ce-brainstorm` requirements doc. The earlier scaffold plan ([2026-05-04-001-feat-personal-editor-extension-scaffold-plan.md](2026-05-04-001-feat-personal-editor-extension-scaffold-plan.md)) is the chassis this feature builds on.
- Related code: [src/extension.ts](../../src/extension.ts), [package.json](../../package.json), [README.md](../../README.md).
- Related PRs/issues: none.
- External docs: VSCode Extension API reference for `workspace.onDidChangeTextDocument`, `window.onDidChangeTextEditorSelection`, `window.onDidChangeActiveTextEditor`, `TextEditor.edit`, `window.createStatusBarItem`, `ThemeColor`, `ExtensionContext.globalState`, `window.showInputBox`, `window.showQuickPick`. (`code.visualstudio.com/api`.)
