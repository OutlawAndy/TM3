// Pure string-transform functions ported from TextMate Ruby/Source bundle commands.
// No VSCode imports — all functions are independently verifiable in a Node REPL.

// ---------------------------------------------------------------------------
// R1 — Hash syntax toggle: { :key => val } ↔ { key: val }
// ---------------------------------------------------------------------------

export function toggleHashSyntax(str: string): string {
  if (/=>/.test(str)) {
    // rocket → new syntax
    return str.replace(/:(\w+)\s*=>\s*/g, "$1: ");
  }
  if (/\w+:/.test(str)) {
    // new syntax → rocket  (value pattern mirrors original Ruby regex)
    return str.replace(
      /(\w+):(\s*(?:"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\w+\([^)]*\)|[^,\n}]+))/g,
      ":$1 =>$2",
    );
  }
  return str;
}

// ---------------------------------------------------------------------------
// R2 — String/symbol toggle: "word" / 'word' ↔ :word
// ---------------------------------------------------------------------------

export function toggleStringSymbol(str: string): string {
  if (/("|')(\w+)\1/.test(str)) {
    // quoted word → symbol
    return str.replace(/("|')(\w+)\1/g, ":$2");
  }
  if (/:(\w+)/.test(str)) {
    // symbol → double-quoted string
    return str.replace(/:(\w+)/g, '"$1"');
  }
  return str;
}

// ---------------------------------------------------------------------------
// R3 — Quote style cycle (three-way + esoteric forms)
// Ported from TextMate Ruby bundle: Toggle Quote Style.plist
//
// Cycle: "…" → '…' → %Q{…} → "…"
// Esoteric %q/%Q/[] styles collapse → "…"
// Backtick ↔ %x{…}
// ---------------------------------------------------------------------------

function escapeChar(str: string, char: string): string {
  const escaped = char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Replace unescaped occurrences of char with \char
  return str.replace(new RegExp(`\\\\.|${escaped}`, "gs"), (match) =>
    match === char ? `\\${char}` : match,
  );
}

function unescapeChar(str: string, char: string): string {
  const target = `\\${char}`;
  return str.replace(/\\./gs, (match) => (match === target ? char : match));
}

export function toggleQuoteStyle(str: string): string {
  let m: RegExpMatchArray | null;

  // Standard double-quoted → single-quoted
  m = str.match(/^"([\s\S]*)"\s*$/);
  if (m) {
    return "'" + unescapeChar(m[1], '"').replace(/'/g, "\\'") + "'";
  }

  // Standard single-quoted → %Q{…}
  m = str.match(/^'([\s\S]*)'\s*$/);
  if (m) {
    return "%Q{" + unescapeChar(m[1], "'") + "}";
  }

  // %Q{…} or %q{…} or plain %{…} → double-quoted
  m = str.match(/^%[Qq]?\{([\s\S]*)\}\s*$/);
  if (m) {
    return '"' + escapeChar(unescapeChar(m[1], "}"), '"') + '"';
  }

  // Esoteric bracket/paren/angle openers → double-quoted (collapse)
  m = str.match(/^%[Qq]?\[([\s\S]*)\]\s*$/);
  if (m) return '"' + escapeChar(unescapeChar(m[1], "]"), '"') + '"';
  m = str.match(/^%[Qq]?\(([\s\S]*)\)\s*$/);
  if (m) return '"' + escapeChar(unescapeChar(m[1], ")"), '"') + '"';
  m = str.match(/^%[Qq]?<([\s\S]*)>\s*$/);
  if (m) return '"' + escapeChar(unescapeChar(m[1], ">"), '"') + '"';

  // Arbitrary delimiter %Q!…! etc.
  m = str.match(/^%[Qq]?(.)([\s\S]*)\1\s*$/);
  if (m) return '"' + escapeChar(unescapeChar(m[2], m[1]), '"') + '"';

  // Backtick shell string → %x{…}
  m = str.match(/^`([\s\S]*)`\s*$/);
  if (m) return "%x{" + unescapeChar(m[1], "`") + "}";

  // %x{…} → backtick
  m = str.match(/^%x\{([\s\S]*)\}\s*$/);
  if (m) return "`" + escapeChar(unescapeChar(m[1], "}"), "`") + "`";

  return str;
}

// ---------------------------------------------------------------------------
// R4 — Identifier case cycle: PascalCase → snake_case → camelCase → PascalCase
// Ported from TextMate Source bundle: Toggle CamelCase vs Underscore.tmCommand
// Preserves any leading non-letter prefix (e.g. ":" in ":foo_bar").
// ---------------------------------------------------------------------------

function pascalToSnake(word: string): string {
  return word
    .replace(/\B([A-Z])(?=[a-z0-9])|([a-z0-9])([A-Z])/g, (_, a, b, c) =>
      a ? `_${a}` : `${b}_${c}`,
    )
    .toLowerCase();
}

function snakeToCamel(word: string): string {
  return word.replace(/_([^_]+)/g, (_, part: string) =>
    part.charAt(0).toUpperCase() + part.slice(1),
  );
}

function camelToPascal(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function toggleCamelSnake(str: string): string {
  // Strip leading non-letter prefix
  const prefixMatch = str.match(/^([^A-Za-z]*)([\s\S]*)$/);
  if (!prefixMatch) return str;
  const prefix = prefixMatch[1];
  const word = prefixMatch[2];
  if (!word) return str;

  let result: string;
  if (/^[A-Z]/.test(word)) {
    result = pascalToSnake(word);
  } else if (word.includes("_")) {
    result = snakeToCamel(word);
  } else if (/^[a-z]/.test(word)) {
    result = camelToPascal(word);
  } else {
    return str;
  }

  return prefix + result;
}

// ---------------------------------------------------------------------------
// R5 — Wrap in braces
// Ported from TextMate Source bundle: Wrap in Braces.tmCommand
// tabStr: the indentation unit (e.g. "  " for 2-space, "\t" for tabs)
// ---------------------------------------------------------------------------

export function wrapInBraces(str: string, tabStr: string): string {
  if (!str.includes("\n")) {
    return `{${str}}`;
  }

  // Find minimum indentation of non-empty lines
  const lines = str.split("\n");
  const indents = lines
    .filter((l) => l.trim().length > 0)
    .map((l) => l.match(/^(\s*)/)?.[1] ?? "");
  const leading = indents.reduce((min, ind) =>
    ind.length < min.length ? ind : min,
  );

  if (lines.length === 1) {
    // Single logical line but content has leading whitespace
    const stripped = leading.slice(tabStr.length);
    return `${stripped}{\n${str}${stripped}}\n`;
  }

  // Multi-line: indent each line by one tab, wrap with braces
  const indented = str.replace(/^(?=.)/gm, tabStr);
  return `${leading}{\n${indented}${leading}}\n`;
}

// ---------------------------------------------------------------------------
// R6 — Unwrap braces
// Ported from TextMate Source bundle: Unwrap Braces.tmCommand
// ---------------------------------------------------------------------------

export function unwrapBraces(str: string, tabStr: string): string {
  const m = str.match(/^\s*\{\s*\n([\s\S]*\n)\s*\}\s*$/);
  if (!m) return str;

  const inner = m[1];
  // Strip one level of indentation from multi-line inner content
  if (/\n.*\n/.test(inner)) {
    return inner.replace(new RegExp(`^${escapeRegex(tabStr)}`, "gm"), "");
  }
  return inner;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// R7 — Ruby block style toggle: { … } ↔ do … end
// Operates on the selected block text.
// Handles block parameters (|x|), single-line collapse, multi-line expansion.
// ---------------------------------------------------------------------------

export function toggleBlockStyle(str: string, tabStr: string = "  "): string {
  const trimmed = str.trim();

  if (trimmed.startsWith("{")) {
    // Brace block → do…end
    // Strip outer braces
    const inner = trimmed.slice(1, -1).trim();
    const paramMatch = inner.match(/^\|([^|]*)\|/);
    const params = paramMatch ? `|${paramMatch[1]}|` : null;
    const body = params ? inner.slice(paramMatch![0].length).trim() : inner;

    if (!body.includes("\n")) {
      // Single-line expansion
      const paramStr = params ? ` ${params}` : "";
      return `do${paramStr}\n${tabStr}${body}\nend`;
    } else {
      // Multi-line: body is already multi-line, wrap in do/end
      const paramStr = params ? ` ${params}` : "";
      const indented = body
        .split("\n")
        .map((l) => tabStr + l)
        .join("\n");
      return `do${paramStr}\n${indented}\nend`;
    }
  }

  if (/^do\b/.test(trimmed)) {
    // do…end → brace block (collapse to single line)
    const withoutDo = trimmed.slice(2).trim(); // remove "do"
    const withoutEnd = withoutDo.replace(/\nend\s*$/, "").trim();

    const paramMatch = withoutEnd.match(/^\|([^|]*)\|/);
    const params = paramMatch ? `|${paramMatch[1]}|` : null;
    const body = params ? withoutEnd.slice(paramMatch![0].length).trim() : withoutEnd;

    // Collapse multi-line body: join lines with "; "
    const collapsed = body
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join("; ");

    const paramStr = params ? ` ${params} ` : " ";
    return `{${paramStr}${collapsed} }`;
  }

  return str;
}

// ---------------------------------------------------------------------------
// R8 — Array literal toggle: [ :foo, :bar ] ↔ %i( foo bar )
//                             [ "foo", "bar" ] ↔ %w( foo bar )
// Ported from TextMate Rangular bundle: %i( syms ).tmCommand
// ---------------------------------------------------------------------------

export function toggleArrayLiteral(str: string): string {
  const trimmed = str.trim();

  if (trimmed.startsWith("[")) {
    // Array literal → %i or %w
    const innerMatch = trimmed.match(/^\[([\s\S]*)\]$/);
    if (!innerMatch) return str;
    const inner = innerMatch[1];

    // Detect whether content uses symbols (:foo) — determines %i vs %w
    const hasSymbols = /:\w/.test(inner);

    // Split by ",\n" (row boundaries) then "," within a row; strip sigils
    const rows = inner.split(/,\n/).map((row) =>
      row
        .split(",")
        .map((item) => item.trim().replace(/^[:"']|['"]\s*$/g, "").trim())
        .filter(Boolean)
        .join(" "),
    );

    const content = rows.join("\n");
    if (hasSymbols) {
      return `%i( ${content} )`;
    } else {
      // Strip any remaining quotes from content
      return `%w( ${content.replace(/['"]/g, "")} )`;
    }
  }

  if (/^%[iw]/.test(trimmed)) {
    // %i or %w → array literal
    const isSymbol = trimmed[1] === "i";
    const innerMatch = trimmed.match(/^%[iw][\(\[\|<]([\s\S]*)[\)\]\|>]\s*$/);
    if (!innerMatch) return str;
    const inner = innerMatch[1];

    // Split by whitespace across lines, preserving row structure
    const items: string[] = [];
    for (const row of inner.split("\n")) {
      const rowItems = row
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((item) => item.replace(/['"]/g, ""));
      items.push(
        ...rowItems.map((item) => (isSymbol ? `:${item}` : `"${item}"`)),
      );
    }

    return `[ ${items.join(", ")} ]`;
  }

  return str;
}
