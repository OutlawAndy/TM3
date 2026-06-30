---
title: "feat: ASCII comment box-drawing toggle"
type: feat
status: active
date: 2026-06-03
origin: docs/brainstorms/2026-06-03-ascii-comment-drawing-requirements.md
---

# feat: ASCII comment box-drawing toggle

## Summary

Add one TM3 command that toggles a selected comment region between plain ASCII
(`- | + > < ^ v`) and Unicode box-drawing — upgrading lines and arrowheads and
resolving each `+` into the correct corner/tee/cross from its neighbors, and
reversing cleanly for re-editing. The conversion is a vscode-free pure module
mirroring the existing Ruby transforms, wired through the existing
selection-scoped transform-command harness, and shipped with the repo's first
unit tests.

---

## Problem Frame

Andy draws box-and-arrow diagrams inside code comments to document non-obvious
logic, using Unicode box-drawing glyphs (`──▶`, `─┬──▶`, `└───▶`, `│`, `◀`).
There is no fast way to produce them: he keeps a note file of the symbols and
copy/pastes them one at a time, and once a diagram is in Unicode, editing it
means hand-typing glyphs like `┼`/`├` that are hard to enter and easy to
misalign. The drawing itself (sketching with `- | + >`) is easy; only the glyph
translation is the friction. See origin: `docs/brainstorms/2026-06-03-ascii-comment-drawing-requirements.md`.

This plan implements only v1 — local beautify with a clean reverse. Inferring
undrawn connectors, live draw mode, and alignment/arithmetic are deferred (see
Scope Boundaries).

---

## Requirements

Carried from the origin brainstorm (R-IDs preserved for traceability; see origin).

**Beautify (ASCII to Unicode)**

- R1. Within the operated-on text, convert horizontal line runs `-` to `─` and vertical line runs `|` to `│`.
- R2. Convert each `+` to the box-drawing glyph implied by its connecting neighbors: `┼` (all four), `├ ┤ ┬ ┴` (three), `┌ ┐ └ ┘` (two perpendicular), `│`/`─` (two collinear). A `+` with zero or one connecting neighbor is left as `+`.
- R3. Convert arrowhead characters to filled triangles only when adjacent to a connecting line glyph: `>`→`▶` (line to its left), `<`→`◀` (line to its right), `^`→`▲` (line below), `v`→`▼` (line above). A character not adjacent to a line is left unchanged.

**Asciify (Unicode to ASCII)**

- R4. Reverse R1–R3: light box-drawing line glyphs to `-`/`|`, junction glyphs (`┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼`) to `+`, filled-triangle arrowheads (`▶ ◀ ▲ ▼`) to `> < ^ v`.
- R5. Asciify also downgrades heavy and rounded variants (e.g. `━ ┃ ╭ ╮`) to ASCII, so diagrams pasted from other sources become editable even though beautify never emits those weights.

**Toggle behavior**

- R6. A single command determines direction by content: if the operated-on text contains any Unicode box-drawing/arrow glyph, it asciifies (R4–R5); otherwise it beautifies (R1–R3). On a tie/ambiguous content, it beautifies.
- R7. The command operates on the current selection and requires one; with no selection it surfaces a brief "select the diagram first" message rather than acting.
- R8. Each direction is idempotent: beautify on already-beautified text (or asciify on already-ASCII text) makes no change, and beautify→asciify→beautify reproduces the same Unicode result (topology preserved).

**Comment-prefix and grid safety**

- R9. Leading comment markers in the selection (`#`, `//`) are preserved untouched, and column positions used for neighbor lookup account for the uniform prefix so junctions resolve correctly.
- R10. Neighbor lookups past the end of a shorter line, or into blank lines, are treated as empty (no connection); lines of differing length in the selection do not corrupt the grid.

---

## Key Technical Decisions

- **Single toggle command on the existing harness.** Register one command through `registerTransform(id, fn, selectionRequired=true)` in `src/extension.ts` (the same harness behind `sortCollection` and the Ruby toggles). `findTransformScope`'s smart-select expansion is grammar-token-oriented and unsuitable for a 2D block, so the command requires an explicit selection; the transform receives the full multi-line text and is applied as one atomic edit (no-op when unchanged, which gives R8 idempotency for free).
- **Direction by glyph presence.** The toggle asciifies when the selection contains any glyph in the Unicode box-drawing block (U+2500–U+257F) or the arrowhead set (`▶◀▲▼`); otherwise it beautifies. Simplest rule that satisfies R6; ties/empty default to beautify.
- **Junctions resolved by a 4-bit neighbor mask.** Each cell's connectivity is encoded as N/E/S/W bits; `+` maps to the glyph for its mask (see High-Level Technical Design). A `+` with fewer than two connecting neighbors stays `+`. This is the venn.nvim technique and is the reusable core a future live draw mode will build on (see origin Scope Boundaries).
- **Filled-triangle arrowheads, light weight only.** Beautify emits `▶ ◀ ▲ ▼` and light box-drawing (`─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼`), matching Andy's existing diagrams. Arrowhead conversion requires an adjacent line glyph so prose (`=>`, `x > y`, `dev`) is not mangled (R3).
- **Pure, vscode-free module.** Conversion logic lives in a new `src/ascii/` module that imports nothing from `vscode`, mirroring `src/ruby/transforms.ts`. This keeps it unit-testable in isolation (the bundle externalizes `vscode`, so a plain Node runner can exercise it).
- **Introduce a minimal test runner.** This is the repo's first feature genuinely worth automated tests (pure functions, fiddly junction logic, an idempotency contract that is painful to verify by hand). Add Node's built-in test runner (`node:test`) driven through `tsx` for direct TypeScript execution, plus a `test` npm script — node-native to honor the scaffold's low-ceremony ethos. (Vitest considered; rejected as a heavier dependency for a single pure module.) This decision is the one flagged at scoping; if manual-only verification is preferred, drop the test-scaffold unit and replace U2's test scenarios with manual Extension Dev Host steps.
- **No comment-gutter special-casing in v1.** The transform converts the full selected text. `#`/`//` markers are not in the conversion vocabulary so they pass through untouched, and a uniform gutter keeps grid columns aligned (R9). Comment styles whose marker *is* a vocabulary character (`--`, `;`, `*`) are deferred — they would require explicit gutter stripping.

---

## High-Level Technical Design

**Pipeline (single pure transform).** Selected text → split into lines, pad each
to the max line width to form a rectangular char grid → classify each cell →
emit. Beautify reads ASCII connectors and writes Unicode; asciify reverse-maps
glyph-by-glyph (no neighbor logic needed). The toggle picks direction by scanning
for any Unicode box-drawing/arrowhead glyph, then calls the matching half.

**Connectivity model.** A cell "connects" toward a neighbor when the drawn
character reaches that way: `-` reaches E/W, `|` reaches N/S, an arrowhead reaches
along its tail, and `+` reaches any orthogonal neighbor that reaches back. For a
`+`, compute the 4-bit mask from its four neighbors, then look up the glyph:

| N | E | S | W | Glyph | Name |
|---|---|---|---|-------|------|
| · | ● | ● | · | `┌` | corner |
| · | · | ● | ● | `┐` | corner |
| ● | ● | · | · | `└` | corner |
| ● | · | · | ● | `┘` | corner |
| ● | ● | ● | · | `├` | tee |
| ● | · | ● | ● | `┤` | tee |
| · | ● | ● | ● | `┬` | tee |
| ● | ● | · | ● | `┴` | tee |
| ● | · | ● | · | `│` | line |
| · | ● | · | ● | `─` | line |
| ● | ● | ● | ● | `┼` | cross |

Any mask with fewer than two set bits → leave the `+` unchanged (degenerate;
nothing meaningful to resolve).

**Directional guidance, not implementation spec** — the exact cell-classification
and neighbor-reach predicate are the implementer's to write; this table fixes the
mask→glyph contract the tests pin.

---

## Output Structure

```
src/ascii/
  diagram.ts          # new — pure beautify/asciify/toggle + grid + mask resolver
test/ascii/
  diagram.test.ts     # new — unit tests (node:test)
```

(Plus edits to existing `src/extension.ts`, `package.json`, and `tsconfig.json`.)

---

## Implementation Units

### U1. Test runner scaffold

- **Goal:** Give the repo its first automated-test capability so U2 can be built test-first.
- **Requirements:** Enables verification of R1–R10; no behavior of its own.
- **Dependencies:** none.
- **Files:** `package.json` (add `tsx` devDependency and a `test` script), `tsconfig.json` (ensure `test/` is covered by typechecking).
- **Approach:** Use Node's built-in `node:test` runner executed through `tsx` so `.test.ts` files run without a separate build step (e.g., a `test` script that runs `tsx` over `test/**/*.test.ts`). No assertion-library dependency — `node:assert` is sufficient. Keep it additive: `build`, `watch`, `package`, `typecheck` stay unchanged.
- **Patterns to follow:** Mirror the existing minimal-tooling style in `package.json` `scripts`; no CI wiring (consistent with the scaffold's "add when a real feature needs them" stance).
- **Test scenarios:** Test expectation: none — scaffolding. Verification is that the runner executes and discovers `test/` files.
- **Verification:** `npm test` runs and reports zero tests (or U2's tests once present) with a clean exit; `npm run typecheck` still passes.

### U2. Pure diagram transform module

- **Goal:** Implement `beautify`, `asciify`, and `toggle` over a comment region as pure functions, including the grid builder and the mask→glyph resolver.
- **Requirements:** R1, R2, R3, R4, R5, R6, R8, R9, R10.
- **Dependencies:** U1.
- **Files:** `src/ascii/diagram.ts` (new), `test/ascii/diagram.test.ts` (new).
- **Approach:** Build a rectangular char grid from the input lines (pad short lines; out-of-bounds and blank cells count as no connection per R10). Beautify: convert `-`/`|` runs (R1), resolve each `+` via the 4-bit neighbor mask from the High-Level Technical Design (R2), convert arrowheads only when adjacent to a line glyph (R3). Asciify: glyph-by-glyph reverse map including heavy/rounded downgrades (R4, R5). Toggle: scan for any Unicode box-drawing/arrowhead glyph to choose direction, defaulting to beautify (R6). The module imports nothing from `vscode`; it takes and returns a string. Comment markers are left untouched by virtue of not being in the vocabulary (R9).
- **Execution note:** Implement test-first — the Acceptance Examples are precise enough to write as failing tests before the resolver exists.
- **Patterns to follow:** `src/ruby/transforms.ts` — pure exported `(string) => string` functions, no editor dependencies.
- **Test scenarios:**
  - Covers AE1. Corner resolution: `----+ / | / +--->` (same column) beautifies to `────┐ / │ / └───▶`.
  - Covers AE2. Tee/cross: `--+--` with `|` below → `┬`; `--+--` with `|` above and below → `┼`.
  - Covers AE3. Arrowhead adjacency: `--->` → `──▶`; a `>` in `-> dev` (no drawn line run adjacent on the grid) and in `x > y` are unchanged, and `v` in `dev` is unchanged.
  - Covers AE4. Toggle direction + round trip: a beautified selection toggles to ASCII; toggling again reproduces the identical Unicode.
  - Asciify reverse: each junction glyph → `+`, `─`/`│` → `-`/`|`, `▶◀▲▼` → `><^v`; heavy/rounded variants (`━ ┃ ╭ ╮`) downgrade to ASCII (R5).
  - Idempotency (R8): beautify(beautify(x)) == beautify(x); asciify(asciify(y)) == asciify(y).
  - Degenerate `+`: a `+` with zero or one connecting neighbor is left as `+` (R2).
  - Prefix/grid safety (R9, R10): a `#`-prefixed multi-line selection keeps the `#` column and resolves junctions correctly; ragged-length and blank lines in the selection do not throw and treat missing cells as empty.
- **Verification:** All `test/ascii/diagram.test.ts` scenarios pass via `npm test`; `npm run typecheck` passes.

### U3. Command registration and contributions

- **Goal:** Expose the toggle as a TM3 command with a keybinding, wired through the existing transform harness.
- **Requirements:** R6, R7.
- **Dependencies:** U2.
- **Files:** `src/extension.ts` (import `toggle` from `src/ascii/diagram`, register the command), `package.json` (`contributes.commands` entry; `contributes.keybindings` entry).
- **Approach:** Add `registerTransform("tm3.ascii.toggleBoxDrawing", (t) => toggle(t), true)` in `activate()` (selection required per R7 — the harness already surfaces the "select the text to transform first" message when the selection is empty, satisfying R7's prompt). Declare the command (`title: "TM3: Toggle ASCII/Unicode Box Drawing"`, `category: "TM3"`) and a default keybinding under `editorTextFocus` — propose `ctrl+cmd+b`; the exact chord is easy to adjust and not load-bearing. No new `activationEvents` needed (commands auto-infer `onCommand`).
- **Patterns to follow:** The `tm3.source.sortCollection` registration and its `package.json` command entry; the existing `keybindings` entries for chord/`when` shape.
- **Test scenarios:** Test expectation: none for the registration wiring itself (no pure logic) — covered by manual verification below; all behavior logic is tested in U2.
- **Verification:** In the Extension Dev Host (F5): select an ASCII sketch in a comment and run the command → it beautifies; run again on the result → it asciifies. Running with no selection shows the "select the text" message. `npm run typecheck` and `npm run package` succeed.

---

## Scope Boundaries

**Deferred for later** (from origin)

- Auto-pairing dangling `+` anchors — inferring and filling undrawn vertical/elbow segments between open endpoints. The explicit next milestone.
- Cross-column connector routing (elbow/jog paths, obstacle avoidance).
- Live "draw mode" (arrow keys draw connected lines with junctions auto-resolving); U2's resolver is its intended core.
- Diagonal segments (`\`, `/`).
- Charset options (heavy/rounded) as a setting; v1 emits light weight only.
- Auto-detecting the comment-block bounds instead of requiring a selection.
- Alignment/reflow, arithmetic recompute, and totals/assertion verification.

**Deferred to follow-up work** (plan-local)

- Explicit-direction commands (separate `beautify` / `asciify`) as a safety valve if the toggle's auto-detection proves surprising in practice.
- Comment styles whose marker is a vocabulary character (`--`, `;`, `*`) — require gutter stripping before transform.

**Outside this feature's identity**

- A separate drawing canvas / webview. The diagram stays plain text in the buffer; the command only translates characters in place.

---

## Risks & Dependencies

- **Font glyph coverage (assumption, verify at design time).** The editing font must cover the light box-drawing block and `▶◀▲▼`; otherwise beautified glyphs render as tofu. Not something the command can guarantee — noted for the user.
- **VSCode API drift.** No new API surface beyond the established `registerTransform`/`editor.edit` path, so exposure is low; the prior learning that VSCode contracts drift applies mainly to decoration APIs, which this feature does not use.
- **`tsx` devDependency.** Adds one dev dependency (and its transitive tree) to a previously dep-light repo. Confined to `devDependencies`; does not ship in the bundle.

---

## Sources / Research

- Origin brainstorm: `docs/brainstorms/2026-06-03-ascii-comment-drawing-requirements.md`.
- Upstream ideation: `docs/ideation/2026-06-03-ascii-comment-drawing-ideation.md` (under Andy's normal convention this lives under `$HOME/compound-engineering/`; this project keeps docs in-repo).
- Transform harness and closest analog: `src/extension.ts` (`registerTransform`, `findTransformScope`) and `src/ruby/transforms.ts` (`sortCollection`).
- Build/test reality: `esbuild.config.mjs` (bundles `src/extension.ts`, externalizes `vscode`); `package.json` scripts (no test runner present).
- Junction-resolution technique: venn.nvim 4-bit directional-flag intersection lookup.
