// Pure ASCII <-> Unicode box-drawing conversion for code-comment diagrams.
// No vscode imports — this module is unit-tested in isolation.
//
// Vocabulary
//   ASCII:   - | +  and arrowheads > < ^ v
//   Unicode: ─ │ and corners/tees/cross ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼, arrowheads ▶ ◀ ▲ ▼
//
// `beautify` upgrades a sketched ASCII region to Unicode, resolving each `+`
// from its neighbours (a 4-bit N/E/S/W mask). `asciify` reverses it. `toggle`
// picks the direction by detecting whether the text already contains Unicode
// box-drawing glyphs. All three preserve line lengths exactly (no padding is
// emitted) so comment gutters and surrounding code are never disturbed.

const N = 1;
const E = 2;
const S = 4;
const W = 8;

const MASK_TO_GLYPH: Record<number, string> = {
  [E | S]: "┌",
  [S | W]: "┐",
  [N | E]: "└",
  [N | W]: "┘",
  [N | E | S]: "├",
  [N | S | W]: "┤",
  [E | S | W]: "┬",
  [N | E | W]: "┴",
  [N | E | S | W]: "┼",
  [N | S]: "│",
  [E | W]: "─",
};

// A `+`'s arm in a direction is "live" when the neighbour reaches back toward it.
// Arrowheads sit on a line's axis, so they count as connectors on that axis.
const VERTICAL_CONNECTORS = new Set(["|", "+", "^", "v"]);
const HORIZONTAL_CONNECTORS = new Set(["-", "+", "<", ">"]);

export function beautify(text: string): string {
  const grid = text.split("\n").map((line) => Array.from(line));

  const at = (r: number, c: number): string => {
    if (r < 0 || r >= grid.length) return " ";
    const row = grid[r];
    if (c < 0 || c >= row.length) return " ";
    return row[c];
  };

  // A `-` is part of a drawn horizontal line when it touches another `-` or a
  // junction on either side. A lone dash (prose like "-> x") stays ASCII.
  const isHLine = (r: number, c: number): boolean => {
    if (at(r, c) !== "-") return false;
    const w = at(r, c - 1);
    const e = at(r, c + 1);
    return w === "-" || w === "+" || e === "-" || e === "+";
  };

  const isVLine = (r: number, c: number): boolean => {
    if (at(r, c) !== "|") return false;
    const n = at(r - 1, c);
    const s = at(r + 1, c);
    return n === "|" || n === "+" || s === "|" || s === "+";
  };

  // An arrowhead converts only when its tail-side neighbour is a drawn line
  // (a junction, or a `-`/`|` that itself converts). This is what separates
  // "--->" (an arrow) from "-> dev" (prose).
  const hLineTail = (r: number, c: number): boolean => {
    const ch = at(r, c);
    return ch === "+" || isHLine(r, c);
  };
  const vLineTail = (r: number, c: number): boolean => {
    const ch = at(r, c);
    return ch === "+" || isVLine(r, c);
  };

  return grid
    .map((row, r) =>
      row
        .map((ch, c) => {
          switch (ch) {
            case "-":
              return isHLine(r, c) ? "─" : ch;
            case "|":
              return isVLine(r, c) ? "│" : ch;
            case "+": {
              let mask = 0;
              if (VERTICAL_CONNECTORS.has(at(r - 1, c))) mask |= N;
              if (VERTICAL_CONNECTORS.has(at(r + 1, c))) mask |= S;
              if (HORIZONTAL_CONNECTORS.has(at(r, c + 1))) mask |= E;
              if (HORIZONTAL_CONNECTORS.has(at(r, c - 1))) mask |= W;
              return MASK_TO_GLYPH[mask] ?? "+";
            }
            case ">":
              return hLineTail(r, c - 1) ? "▶" : ch; // line to the west
            case "<":
              return hLineTail(r, c + 1) ? "◀" : ch; // line to the east
            case "^":
              return vLineTail(r + 1, c) ? "▲" : ch; // line below
            case "v":
              return vLineTail(r - 1, c) ? "▼" : ch; // line above
            default:
              return ch;
          }
        })
        .join(""),
    )
    .join("\n");
}

// Reverse map: every box-drawing weight (light, heavy, double, rounded) and
// arrowhead collapses back to the ASCII vocabulary. Glyph-by-glyph, no
// neighbour logic — topology is preserved for a faithful re-beautify.
const ASCIIFY = new Map<string, string>();
// Horizontal lines and right/left half-stubs of every weight.
for (const ch of "─━═╌╍┄┅┈┉╴╶╸╺╼╾") ASCIIFY.set(ch, "-");
// Vertical lines and up/down half-stubs of every weight.
for (const ch of "│┃║╎╏┆┇┊┋╵╷╹╻╽╿") ASCIIFY.set(ch, "|");
// Corners, tees, and crosses across light/heavy/double/rounded/mixed weights.
for (const ch of "┌┐└┘├┤┬┴┼┍┎┑┒┕┖┙┚┝┞┟┠┡┢┥┦┧┨┩┪┭┮┯┰┱┲┵┶┷┸┹┺┽┾┿╀╁╂╃╄╅╆╇╈╉╊┏┓┗┛┣┫┳┻╋╒╓╕╖╘╙╛╜╞╟╡╢╤╥╧╨╪╫╔╗╚╝╠╣╦╩╬╭╮╰╯")
  ASCIIFY.set(ch, "+");
ASCIIFY.set("╱", "/").set("╲", "\\").set("╳", "+");
ASCIIFY.set("▶", ">").set("►", ">").set("→", ">");
ASCIIFY.set("◀", "<").set("◄", "<").set("←", "<");
ASCIIFY.set("▲", "^").set("↑", "^");
ASCIIFY.set("▼", "v").set("↓", "v");

export function asciify(text: string): string {
  let out = "";
  for (const ch of text) out += ASCIIFY.get(ch) ?? ch;
  return out;
}

// Filled-triangle arrowheads beautify emits (and their ► ◄ variants). Plain
// text arrows (→ ← ↑ ↓) are deliberately excluded — they occur in prose and
// must not flip an otherwise-ASCII selection toward asciify.
const TRIANGLE_ARROWHEADS = new Set(["▶", "◀", "▲", "▼", "►", "◄"]);

// A region is already "drawn" when it contains any glyph from the box-drawing
// block (U+2500–U+257F) or a triangle arrowhead. Detecting the whole block —
// not just the glyphs ASCIIFY happens to enumerate — keeps toggle from
// beautifying (wrong direction) a Unicode diagram drawn with exotic weights.
function isUnicodeDiagram(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x2500 && cp <= 0x257f) return true;
    if (TRIANGLE_ARROWHEADS.has(ch)) return true;
  }
  return false;
}

export function toggle(text: string): string {
  return isUnicodeDiagram(text) ? asciify(text) : beautify(text);
}
