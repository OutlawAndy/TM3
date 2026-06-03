---
date: 2026-06-03
topic: ascii-comment-drawing
focus: make it easier to draw connected lines and arrows in code comments
mode: repo-grounded
---

# Ideation: Editor features for ASCII box/arrow drawings in code comments (TM3)

## Grounding Context

### Codebase Context (TM3)
Personal VSCode extension "chassis" — TypeScript, esbuild, engines vscode ^1.85. Features are commands
registered in `src/extension.ts`, ideally pure `(text)=>string` transforms applied as one atomic
`editor.edit`, declared in `package.json` (`contributes.commands` + `keybindings`), settings-driven and
lazy-activated. The closest existing analog is `tm3.source.sortCollection` (`src/ruby/transforms.ts:211-280`):
read selection / auto-scope via `findTransformScope()`, run a pure transform, atomic replace through the
`registerTransform()` harness (`extension.ts:284-314`). Ruby toggles follow the same shape. A macro
recorder/player exists (positional edits coalesced into one replay edit). No test suite; manual F5.
Design constraints: additive "well-paved diff", settings-driven config, lazy activation, slot into the
existing command pattern — avoid a heavyweight separate-canvas webview.

### Real use case (the artifact that motivated this)
`RoleModel/tarsco_bolted_tank/spec/models/accessory_part_context_regression_spec.rb` — branching dataflow
trees drawn in `#`-prefixed Ruby comments using box-drawing + arrow glyphs (`──▶ ─┬──▶ └───▶ ◀┐ ◀┤ ◀┘ │`).
NOTE: the user explicitly de-scoped the test-specific and alignment/arithmetic angles ("down the road").
The artifact's value *here* is as evidence of the glyph vocabulary and the connected-line/branch shapes the
user draws by hand.

### Current workflow pain (the thing to solve now)
The user keeps a note file of a handful of box-drawing/arrow symbols and **copy/pastes them one at a time**.
The immediate, general (not test-specific) job: make it easy to **draw connected lines and arrows in code
comments**.

### External prior art (web research)
- WYSIWYG grid: ASCIIFlow, Textik, Monodraw (Monodraw = format lock-in, can't re-import text).
- Editor-integrated overwrite-mode drawing: vim DrawIt, **venn.nvim (4-bit N/E/S/W directional-flag
  junction lookup — OR the masks to pick `┬└┼├`)**, vim-boxdraw, emacs artist/picture-mode.
- DSL → render: ditaa, graph-easy (`[A]-->[B]`), Mermaid.
- Orthogonal connector routing: Lee/BFS wavefront (VLSI/PCB) for elbow paths avoiding obstacles.
- Existing VSCode extensions (vscode-box-drawing, ascii-sketch) are minimal — the gap is wide.
- Cross-cutting caution: VSCode decoration APIs (`before`/`after`, whitespace render) and font glyph
  coverage drift — verify at design time.

## Topic Axes
1. Glyph & junction mechanics  *(primary after pivot)*
2. Alignment & reflow  *(parked — "down the road")*
3. Diagram structure & semantics  *(parked — "down the road")*
4. Connection routing  *(primary after pivot)*
5. Authoring & navigation workflow

## Ranked Ideas

### 1. Beautify & Connect (sketch in plain ASCII → resolved box-drawing + filled connectors)
**Description:** Draw fast with plain ASCII (`- | + > < ^ v`); one command upgrades a selected comment region
to proper box-drawing, resolving every junction from its neighbors (`-`→`─`, `|`→`│`, `>`→`▶`, and `+`→
`┌┐└┘├┤┬┴┼` per the 4-bit neighbor mask). Treats `+` as a **connector anchor**: where a vertical (or elbow)
segment is *implied between two open anchors but not drawn*, the command fills it in (R5 routing), then
resolves the resulting junctions. Pairs with an inverse **`asciify`** (Unicode → ASCII) so beautified diagrams
remain hand-editable: sketch → beautify (view/commit) → asciify (edit) → beautify. `beautify(asciify(x)) == x`
gives idempotency and a built-in test oracle. Pure-transform-friendly; fits TM3's `sortCollection` shape.
**Axis:** 1 (glyph/junction) + 4 (connection routing)
**Basis:** `direct:` user's stated workflow (copy/paste symbols one at a time) + the connected/branching shapes
in the real spec file; `external:` venn.nvim 4-bit junction lookup, Lee/BFS orthogonal routing, vim-boxdraw.
**Rationale:** Sidesteps glyph entry entirely (you never type a Unicode glyph), handles *connected* lines and
branches (not just isolated arrows), and the beautify+route engine is exactly what R3 draw mode needs later —
so it's the right first brick, de-risked as a deterministic transform.
**Downsides:** Local beautify can't infer implied segments — routing is a genuinely separate capability.
Same-column vertical fill is deterministic; **cross-column elbow routing introduces path-choice ambiguity**
(which row to jog on, obstacle avoidance) and needs careful rules. Anchor-pairing heuristics can guess wrong.
**Confidence:** 78%
**Complexity:** Medium (same-column fill) → Medium-High (cross-column elbow routing)
**Status:** Explored
**Scoping note:** v1 = beautify + same-column vertical fill (deterministic); cross-column elbow routing =
immediate fast-follow. Open design questions for brainstorm: anchor marker & open-direction inference;
anchor-pairing rules (nearest-open vs explicit two-endpoint selection); elbow path policy; obstacle handling;
operating scope (selection vs auto-detected comment block); comment-prefix safety (don't convert `#`/`//`);
ASCII vocabulary (handle `\`/`/` diagonals in v1 or skip); isolated-`+` resolution; charset variants
(heavy `━┃`, rounded `╭╮`).

### 2. Searchable glyph palette (QuickPick)
**Description:** A command opens a fuzzy-searchable QuickPick of every box-drawing + arrow glyph, named
("arrow right", "tee down", "corner", "cross"), recently-used floating to the top; Enter inserts at cursor.
**Axis:** 1 (glyph/junction)
**Basis:** `direct:` the user's note-file-of-symbols copy/paste workflow.
**Rationale:** Directly replaces the copy/paste ritual; live and searchable. Trivial VSCode API, no webview,
no learning curve — could ship immediately as a complement to idea #1.
**Downsides:** Still one-glyph-at-a-time; doesn't draw *connected* runs by itself.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

### 3. Mnemonic expansion / completions
**Description:** Type a short trigger that expands to the glyph: `->`→`──▶`, `>>`→`→`, `+tee`→`┬`,
`+elbow`→`└─▶`, etc., on-type or via a CompletionItemProvider. Builds on TM3's existing snippets.
**Axis:** 1 (glyph/junction)
**Basis:** `direct:` the copy/paste pain; `reasoned:` type-don't-hunt is faster than any picker once memorized.
**Rationale:** Lowest-friction entry for single glyphs and short horizontal arrows; complements #1 and #2.
**Downsides:** Requires memorizing triggers; the trivial `--->`→`──▶` case overlaps with idea #1's horizontal path.
**Confidence:** 80%
**Complexity:** Low
**Status:** Unexplored

### 4. Directional draw mode (modal arrow-key drawing)
**Description:** Toggle a mode; arrow keys lay connected `─`/`│` runs in overwrite, auto-computing corners/tees
via the 4-bit neighbor mask; a key drops arrowheads (`▶◀▲▼`). The richest "really drawing" feel.
**Axis:** 1 (glyph/junction) + 4 (routing)
**Basis:** `external:` vim DrawIt, emacs artist-mode, venn.nvim; `direct:` "connected lines" is the explicit ask.
**Rationale:** The interaction the user is most excited about long-term. Its hard core (junction resolution +
connector routing) is built by idea #1 first, so #1 is the natural foundation.
**Downsides:** Heaviest lift — modal key handling, overwrite edits, live cursor management in a text buffer.
**Confidence:** 70%
**Complexity:** Medium-High
**Status:** Unexplored (explicit future direction)

### 5. Connector between two points (standalone)
**Description:** Cursor at A, run command, point at B → draw the line/elbow + arrowhead and resolve crossings.
Folded into idea #1 as its routing half, but also viable as a lighter standalone command.
**Axis:** 4 (routing)
**Basis:** `external:` ASCIIFlow line tool; `reasoned:`.
**Rationale:** "Arrow from here to there" without drawing each segment.
**Downsides:** Largely subsumed by idea #1.
**Confidence:** 70%
**Complexity:** Medium
**Status:** Unexplored (merged into #1)

## Parked (down the road — user explicitly deferred)
These were the original strongest survivors before the pivot to "make drawing easier first." Preserved for later.
- **Diagram block formatter (align/normalize):** pad `=N`, stack `◀` arrowheads, hold `│` columns, position
  dotted-leader totals, preserve `# ` prefix. Pure transform. (axis 2)
- **Arithmetic recompute & verify:** parse `partN(q *p)=r`, recompute, reconcile against `expect(...).to eq N`
  — verify/flag by default, never blind-rewrite test expectations. (axis 3)
- **Template + data block stamping:** author one block shape, stamp N recomputed/aligned blocks; dedupe back. (axis 5)
- **Diagram model keystone:** comment-prefix virtual canvas + `parse↔render` + GridBuffer; makes the above thin
  transforms; `render(parse(x))` is an idempotent normalize + regression oracle. (axis 3/all)

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Decoration overlay (render Unicode from plain ASCII) | Doesn't touch the entry/drawing pain; decoration + monospace alignment is fragile (API-drift warning); user already uses Unicode. Brainstorm variant. |
| 2 | Mouse-drag draw mode | Generic paint answer; cheaper covered by keyboard draw mode (#4) / beautify (#1); high interaction cost. |
| 3 | ASCII↔Unicode toggle | Speculative value; user already consistent on Unicode; thin pain evidence. |
| 4 | Structural find/replace over grid (Comby-style) | No evidence of need (blocks differ in numbers, not names); partly covered by template stamping. |
| 5 | Stroke-level undo | Premature; depends on a draw-mode not yet chosen; native undo suffices for atomic transforms. |
| 6 | Generate diagram from fixtures (run the `let()`s) | Requires executing domain logic / effectively the test — out of scope for a generic editor extension. (Good brainstorm seed for verify.) |
| 7 | Tree↔table round-trip | Branching structure resists flat tables; adds a representation to keep in sync; weaker than the diagram model. |
