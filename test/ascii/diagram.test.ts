import { test } from "node:test";
import assert from "node:assert/strict";

import { beautify, asciify, toggle } from "../../src/ascii/diagram";

const lines = (...rows: string[]): string => rows.join("\n");

// AE1 — corners resolve from neighbors (Covers AE1, R2)
test("AE1: resolves corners from neighbors", () => {
  const input = lines("----+", "    |", "    +--->");
  const expected = lines("────┐", "    │", "    └───▶");
  assert.equal(beautify(input), expected);
});

// AE2 — tee and cross (Covers AE2, R2)
test("AE2: resolves tee and cross from neighbors", () => {
  assert.equal(beautify(lines("--+--", "  |")), lines("──┬──", "  │"));
  assert.equal(
    beautify(lines("  |", "--+--", "  |")),
    lines("  │", "──┼──", "  │"),
  );
});

// AE3 — arrowheads convert only when adjacent to a drawn line run (Covers AE3, R3)
test("AE3: arrowhead adjacency rule", () => {
  assert.equal(beautify("---> dev"), "───▶ dev"); // run of 3 dashes -> converts
  assert.equal(beautify("-> dev"), "-> dev"); // lone dash -> unchanged
  assert.equal(beautify("x > y"), "x > y"); // comparison -> unchanged
  assert.equal(beautify("a v b"), "a v b"); // lone v (letter-like) -> unchanged
});

// AE4 — toggle flips direction and round-trips (Covers AE4, R6, R8)
test("AE4: toggle flips direction and round-trips", () => {
  const ascii = lines("----+", "    |", "    +--->");
  const uni = beautify(ascii);
  assert.equal(toggle(ascii), uni); // ascii selection -> beautify
  assert.equal(toggle(uni), asciify(uni)); // unicode selection -> asciify
  assert.equal(beautify(toggle(uni)), uni); // toggling back reproduces identical unicode
});

// Asciify reverse mapping (R4)
test("asciify reverses lines, junctions, and arrowheads", () => {
  assert.equal(asciify("────┐"), "----+");
  assert.equal(asciify("│"), "|");
  assert.equal(asciify("└───▶"), "+--->");
  assert.equal(asciify("◀ ▲ ▼"), "< ^ v");
});

// Asciify downgrades heavy and rounded variants (R5)
test("asciify downgrades heavy and rounded variants", () => {
  assert.equal(asciify("━ ┃ ╭ ╮ ╰ ╯"), "- | + + + +");
});

// Idempotency (R8)
test("beautify and asciify are each idempotent", () => {
  const ascii = lines("----+", "    |", "    +--->");
  const uni = beautify(ascii);
  assert.equal(beautify(uni), uni);
  assert.equal(asciify(asciify(uni)), asciify(uni));
});

// Round-trip invariant: beautify -> asciify -> beautify is stable (F3, R8)
test("round-trips a multi-junction box without drift", () => {
  const box = lines("+--+", "|  |", "+--+");
  const uni = beautify(box);
  assert.equal(uni, lines("┌──┐", "│  │", "└──┘"));
  assert.equal(beautify(asciify(uni)), uni);
  assert.equal(beautify(asciify(beautify(uni))), beautify(uni));
});

// Degenerate junctions: fewer than two connections stay '+' (R2)
test("isolated or single-arm + is left unchanged", () => {
  assert.equal(beautify("+"), "+");
  assert.equal(beautify("a + b"), "a + b");
  assert.equal(beautify("+-"), "+─"); // line converts; + has one arm -> stays +
});

// Comment prefix preserved; line lengths preserved; no trailing whitespace (R9, R10, F4)
test("preserves comment prefix and original line lengths", () => {
  const input = lines("# ----+", "#     |", "#     +--->");
  assert.equal(beautify(input), lines("# ────┐", "#     │", "#     └───▶"));

  const ragged = lines("+--", "|", "+--");
  const out = beautify(ragged).split("\n");
  const orig = ragged.split("\n");
  out.forEach((line, i) =>
    assert.equal([...line].length, [...orig[i]].length, `line ${i} length changed`),
  );
  // no trailing whitespace introduced anywhere
  out.forEach((line) => assert.equal(line, line.replace(/\s+$/, "")));
});

// Toggle direction detection by Unicode presence (R6)
test("toggle picks direction from content", () => {
  assert.equal(toggle("--->"), "───▶"); // pure ascii -> beautify
  assert.equal(toggle("───▶"), "--->"); // contains box-drawing -> asciify
});

// Detection covers the whole box-drawing block, not just emitted glyphs (R5, R6)
test("asciify and toggle handle mixed/exotic box-drawing weights", () => {
  // heavy + mixed-weight corners all downgrade
  assert.equal(asciify("┍━━┑"), "+--+");
  assert.equal(asciify("┃ ╎ ╿ ╷"), "| | | |");
  // a diagram drawn with exotic weights is detected as Unicode and asciified
  assert.equal(toggle("┍━━┑"), "+--+");
});

// Plain prose arrows do NOT flip an ASCII selection toward asciify (R6)
test("prose arrows are not a toggle trigger", () => {
  assert.equal(toggle("---> →"), "───▶ →"); // U+2192 prose arrow -> still beautifies
});
