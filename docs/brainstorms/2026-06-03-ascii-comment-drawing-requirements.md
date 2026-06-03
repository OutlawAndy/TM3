---
date: 2026-06-03
topic: ascii-comment-drawing
---

# ASCII Comment Drawing — Beautify Toggle

## Summary

A single TM3 command that toggles a selected comment region between plain ASCII
(`- | + > < ^ v`) and proper Unicode box-drawing — upgrading line and arrow
characters and resolving each `+` into the correct corner / tee / cross from its
neighbors, and reversing cleanly so the diagram can be edited in ASCII and
re-beautified. In v1 the author draws every segment themselves; nothing is inferred.

## Problem Frame

Andy regularly draws box-and-arrow diagrams inside code comments — branching
dataflow trees, connector diagrams — to document non-obvious logic (e.g. the
nested-part quantity trees in `tarsco_bolted_tank`'s
`spec/models/accessory_part_context_regression_spec.rb`). These use Unicode
box-drawing glyphs (`──▶`, `─┬──▶`, `└───▶`, `│`, `◀`).

Today there is no fast way to produce these glyphs. Andy keeps a note file of the
handful of symbols he needs and copy/pastes them into the comment one at a time.
That is slow on first draft and worse on edit: once a diagram is in Unicode,
nudging a line or moving a branch means hand-editing characters like `┼`/`├` that
are hard to type and easy to misalign — so the second edit re-incurs the original
pain. The drawing itself (sketching boxes and arrows in plain `- | + >`) is easy
and natural; only the glyph translation is the friction.

## Key Decisions

- **Single toggle command, not two.** One command detects whether the selection is
  predominantly ASCII or predominantly Unicode and converts to the other form. One
  keybinding to learn; the direction is inferred from content rather than chosen by
  the user.
- **Beautify-only in v1 — no inference.** The command converts and resolves only the
  characters the author actually drew. It does not fill in undrawn segments or route
  connectors. Auto-pairing dangling `+` anchors (filling implied verticals/elbows) is
  the intended next step, deliberately deferred (see Scope Boundaries) to keep v1
  fully deterministic with zero guessing.
- **Junctions resolved by 4-bit neighbor mask.** Each `+` becomes a corner, tee, or
  cross based on which of its four neighbors (N/E/S/W) connect to it — the
  venn.nvim approach. A `+` with fewer than two connecting neighbors is left
  unchanged. This resolver is the reusable core that a future live "draw mode" will
  build on.
- **Filled-triangle arrowheads.** Arrowheads render as `▶ ◀ ▲ ▼` (matching Andy's
  existing diagrams), not thin arrows (`→ ← ↑ ↓`). Light box-drawing weight only
  (`─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼`); heavy/rounded variants are deferred.
- **Operates on an explicit selection.** v1 transforms the selected text (the
  command requires a selection), which also makes the toggle's ASCII-vs-Unicode
  detection scope unambiguous. Auto-detecting the diagram's comment-block bounds is
  deferred.
- **Reuse the existing transform-command harness.** The feature fits TM3's
  established pure-`(text) => string` transform pattern (the same harness behind the
  Ruby toggles and Sort Collection) applied as one atomic edit — no new architecture.

## Requirements

**Beautify (ASCII to Unicode)**

- R1. Within the operated-on text, convert horizontal line runs `-` to `─` and
  vertical line runs `|` to `│`.
- R2. Convert each `+` to the box-drawing glyph implied by its connecting neighbors:
  `┼` (all four), `├ ┤ ┬ ┴` (three), `┌ ┐ └ ┘` (two perpendicular), `│` or `─` (two
  collinear). A `+` with zero or one connecting neighbor is left as `+`.
- R3. Convert arrowhead characters to filled triangles only when adjacent to a
  connecting line glyph: `>` to `▶` (line to its left), `<` to `◀` (line to its
  right), `^` to `▲` (line below), `v` to `▼` (line above). A character not adjacent
  to a line is left unchanged (so prose like `dev` or `=>` is not mangled).

**Asciify (Unicode to ASCII)**

- R4. Reverse R1–R3: all light box-drawing line glyphs to `-`/`|`, all junction
  glyphs (`┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼`) to `+`, and filled-triangle arrowheads
  (`▶ ◀ ▲ ▼`) to `> < ^ v`.
- R5. Asciify also accepts heavy and rounded box-drawing variants (e.g. `━ ┃ ╭ ╮`)
  and downgrades them to ASCII, so a diagram pasted from another source can still be
  brought back to editable ASCII even though beautify never emits those weights.

**Toggle behavior**

- R6. A single command determines direction by content: if the operated-on text
  contains any Unicode box-drawing/arrow glyphs, it asciifies (R4–R5); otherwise it
  beautifies (R1–R3). On a tie or ambiguous content, it beautifies.
- R7. The command operates on the current selection and requires one; with no
  selection it surfaces a brief "select the diagram first" message rather than acting.
- R8. Each direction is idempotent: running beautify on already-beautified text (or
  asciify on already-ASCII text) makes no change. Beautify then asciify then beautify
  reproduces the same Unicode result (topology is preserved through the round trip).

**Comment-prefix and grid safety**

- R9. Leading comment markers in the selection (`#`, `//`) are preserved untouched —
  they are not part of the conversion vocabulary, and column positions used for
  neighbor lookup account for the uniform prefix so junctions resolve correctly.
- R10. Neighbor lookups past the end of a shorter line, or into blank lines, are
  treated as empty (no connection) rather than erroring; lines of differing length in
  the selection do not corrupt the grid.

## Acceptance Examples

- AE1. Corner resolution. **Covers R2.**
  - **Given** the selection (in a `#` comment):
    ```
    ----+
        |
        +--->
    ```
  - **When** beautify runs
  - **Then** it becomes:
    ```
    ────┐
        │
        └───▶
    ```
  - The top `+` has west+south neighbors (`┐`); the bottom `+` has north+east (`└`).

- AE2. Tee and cross resolution. **Covers R2.**
  - **Given** `--+--` with a `|` directly below the `+`, and `--+--` with `|` both
    above and below — **When** beautify runs — **Then** the first `+` becomes `┬`
    (W+E+S) and the second becomes `┼` (all four).

- AE3. Arrowhead adjacency. **Covers R3.**
  - **Given** the comment text `# returns -> dev builds (x > y)` with the diagram
    arrow `--->` elsewhere in the selection — **When** beautify runs — **Then** the
    `>` in `--->` becomes `▶`, while the `>` in `-> dev` (the `-` is not a drawn line
    run adjacent on the diagram grid) and `x > y` are left unchanged, and `v` in
    `dev` is left unchanged.

- AE4. Toggle direction + round trip. **Covers R6, R8.**
  - **Given** a beautified diagram is selected — **When** the command runs — **Then**
    it asciifies; running it again beautifies back to the identical Unicode form.

## Scope Boundaries

**Deferred for later**

- Auto-pairing dangling `+` anchors — inferring and filling the undrawn vertical/elbow
  segments between two open endpoints. This is the explicit next milestone after v1.
- Cross-column connector routing (elbow/jog paths, obstacle avoidance).
- Live "draw mode" (arrow keys draw connected lines with junctions auto-resolving).
  v1's junction resolver is intended to be its reusable core.
- Diagonal segments (`\`, `/`).
- Charset options (heavy `━ ┃`, rounded `╭ ╮`) as a setting; v1 emits light weight only.
- Auto-detecting the diagram's comment-block bounds instead of requiring a selection.
- Alignment / reflow, arithmetic recompute, and totals/assertion verification — strong
  ideas from the upstream ideation, parked by choice.

**Outside this feature's identity**

- A separate drawing canvas / webview. The diagram lives as plain text in the buffer;
  the command only translates characters in place.

## Dependencies / Assumptions

- The diagram is viewed in a monospace font; alignment is the author's responsibility
  (the command preserves columns, it does not realign).
- The editing font covers the light box-drawing block (U+2500–U+257F) and the
  geometric-shape arrowheads (`▶ ◀ ▲ ▼`); if not, beautified glyphs may render as
  tofu — an assumption to verify, not a guarantee the command makes.
- Targets `#`- and `//`-style line comments in v1; `--`, `;`, `*`, and block-comment
  styles are an untested edge.

## Outstanding Questions

**Deferred to planning**

- Exact command id, title, and default keybinding (follow the `tm3.<domain>.<action>`
  convention; `selectionRequired` is available on the existing harness).
- How the 2D character grid is built from the selected lines for neighbor lookup, and
  how the uniform comment-prefix offset is detected.
- The precise ASCII-vs-Unicode detection threshold for R6 (any-Unicode-present is the
  proposed rule; confirm it holds for mixed/partially-converted selections).

## Sources / Research

- Upstream ideation: `docs/ideation/2026-06-03-ascii-comment-drawing-ideation.md`
  (note: under Andy's normal convention ideation lives under
  `$HOME/compound-engineering/`; this project keeps docs in-repo).
- Motivating artifact: `tarsco_bolted_tank` repo,
  `spec/models/accessory_part_context_regression_spec.rb`.
- Existing transform-command harness and closest analog: `src/extension.ts`
  (`registerTransform`) and `src/ruby/transforms.ts` (`sortCollection`).
- Junction-resolution technique: venn.nvim 4-bit directional-flag intersection lookup.
