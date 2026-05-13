---
title: feat: Add Sort Collection command
type: feat
status: active
date: 2026-05-13
---

# feat: Add Sort Collection command

## Overview

Add a `TextMate3: Sort Collection` command that alphabetically sorts the items in a selected
collection — Ruby array literals (`[]`, `%i()`, `%w()`), or a bare comma-separated list —
then writes them back in the same form. Available in any file type.

---

## Problem Frame

When editing arrays or comma-separated lists, manually sorting items is tedious. The command
detects the input format automatically, sorts items case-insensitively, and returns the
collection unchanged in format but sorted in content.

---

## Requirements Trace

- R1. Sort Ruby bracket array literals (`[:foo, :bar]`, `["foo", "bar"]`) — preserve sigils and bracket form.
- R2. Sort `%i(...)` and `%w(...)` word-list literals — preserve percent-literal form.
- R3. Sort bare comma-separated text as a fallback when no array form is detected.
- R4. Sort alphabetically, case-insensitively (`localeCompare`).
- R5. Return the collection in the same form as input.
- R6. Selection required — operate on the active selection only.
- R7. Available in any file type (source scope, not Ruby-only).

---

## Scope Boundaries

- No nested or multi-dimensional array support.
- No numeric sort — all items treated as strings.
- No deduplication — sort only.
- No keyed data structures (hashes, objects).

---

## Context & Research

### Relevant Code and Patterns

- `src/ruby/transforms.ts` — all existing transforms; `sortCollection` follows the same pure-function, no-VSCode-import pattern.
- `src/extension.ts` — `registerTransform` helper with `selectionRequired = true`, identical to `wrapInBraces` and `toggleArrayLiteral` registration.
- `package.json` — `contributes.commands` declaration pattern.
- `toggleArrayLiteral` in `src/ruby/transforms.ts` — parsing logic for `[]` and `%i/%w` forms to mirror.

### Institutional Learnings

- Keep `transforms.ts` a pure module (no VSCode imports) so transforms remain independently testable in a Node REPL.
- Use `registerTransform(..., true)` for selection-required commands.

---

## Key Technical Decisions

- **Scope: source (any file)** — comma-separated lists appear in many file types, not just Ruby.
- **Case-insensitive sort** — `localeCompare` with `{ sensitivity: "base" }` matches natural alphabetical expectations.
- **Format detection order**: `[]` bracket array → `%i/%w` word literal → comma-separated fallback. Returns input unchanged if none match.
- **No keybinding** — no TextMate original to port; Command Palette is sufficient.

---

## Implementation Units

- U1. **Add `sortCollection` pure transform**

**Goal:** Implement sorting logic as a pure function exported from `src/ruby/transforms.ts`.

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** None

**Files:**
- Modify: `src/ruby/transforms.ts`

**Approach:**

- Detect `[...]`: extract items by splitting on `,`, strip leading `:`, `"`, `'` sigils and trailing `"`, `'`, trim whitespace; sort; reconstruct with matching sigils and `[ item, item ]` spacing.
- Detect `%i(...)` / `%w(...)`: split inner content on whitespace; sort; reconstruct with the same delimiter form.
- Fallback comma-separated: split on `,`, trim each token, sort, rejoin with `, `.
- Return input unchanged when no format matches.
- Sort comparator: `a.localeCompare(b, undefined, { sensitivity: "base" })`.

**Patterns to follow:**
- `toggleArrayLiteral` in `src/ruby/transforms.ts` for array and `%i/%w` parsing.

**Test scenarios:**
- Happy path: `[ :foo, :baz, :bar ]` → `[ :bar, :baz, :foo ]`
- Happy path: `["Charlie", "alice", "Bob"]` → `["alice", "Bob", "Charlie"]` (case-insensitive)
- Happy path: `%i( foo baz bar )` → `%i( bar baz foo )`
- Happy path: `%w( cherry apple banana )` → `%w( apple banana cherry )`
- Happy path (comma list): `foo, baz, bar` → `bar, baz, foo`
- Happy path (already sorted): input returned with items in same order
- Edge case: single-item array `[:foo]` → `[:foo]` unchanged
- Edge case: empty array `[]` → `[]` unchanged
- Edge case: unrecognized format (plain word, no commas) → return input unchanged
- Edge case: mixed-case symbols `:Apple, :apple` — case-insensitive sort groups them stably

**Verification:**
- Node REPL tests pass for all scenarios above.
- `npm run typecheck` passes.

---

- U2. **Register `textMate3.source.sortCollection` command**

**Goal:** Wire the transform into VSCode via the existing `registerTransform` helper and manifest entry.

**Requirements:** R6, R7

**Dependencies:** U1

**Files:**
- Modify: `src/extension.ts`
- Modify: `package.json`

**Approach:**
- Import `sortCollection` from `./ruby/transforms` alongside existing imports.
- Call `registerTransform("textMate3.source.sortCollection", (t) => sortCollection(t), true)` in `activate`.
- Add `{ "command": "textMate3.source.sortCollection", "title": "TextMate3: Sort Collection", "category": "TextMate3" }` to `contributes.commands` in `package.json`.

**Patterns to follow:**
- `toggleArrayLiteral` registration in `src/extension.ts`.
- Existing command declaration format in `package.json`.

**Test scenarios:**
- Test expectation: none — command wiring verified manually via Command Palette in the F5 dev host.

**Verification:**
- `npm run typecheck` passes.
- `npm run build` passes.
- `TextMate3: Sort Collection` appears in the Command Palette in the F5 dev host.
- Selecting a Ruby array literal or comma-separated list and running the command sorts it in place.

---

- U3. **Update docs and bump version**

**Goal:** Document the new command; bump version to `0.0.4`.

**Requirements:** R1–R7 (documentation coverage)

**Dependencies:** U1, U2

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json` (version bump `0.0.3` → `0.0.4`)

**Approach:**
- Add `TextMate3: Sort Collection` row to the Source commands table in `README.md` (no default keybinding, note the three supported input forms).
- Add `## 0.0.4 — 2026-05-13` entry to `CHANGELOG.md`.
- Bump `package.json` `"version"` to `"0.0.4"`.
- Update the README install snippet `vsix` filename reference from `0.0.3` to `0.0.4`.

**Patterns to follow:**
- `0.0.3` CHANGELOG entry and Source commands table in `README.md`.

**Test scenarios:**
- Test expectation: none — documentation and version bump only.

**Verification:**
- README Source commands table includes the Sort Collection row.
- CHANGELOG `0.0.4` entry is present and accurate.
- `package.json` version reads `0.0.4`.

---

## System-Wide Impact

- **Interaction graph:** Pure addition — no callbacks or middleware affected. Existing eight transforms unchanged.
- **Error propagation:** N/A — no external calls or persistent state.
- **State lifecycle risks:** None.
- **Unchanged invariants:** All existing commands, keybindings, and grammar/snippet contributions remain unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Comma-fallback may activate on partial selections that look like lists but aren't | Selection is user-controlled; document that the command requires a deliberate selection of the list to sort |

---

## Sources & References

- Related code: `src/ruby/transforms.ts` (`toggleArrayLiteral`)
- Related code: `src/extension.ts` (`registerTransform`)
- Prior plan: `docs/plans/2026-05-13-001-feat-ruby-text-transforms-plan.md`
