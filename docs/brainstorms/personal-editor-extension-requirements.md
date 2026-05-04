# Personal Editor Extension — Requirements

**Date:** 2026-05-04
**Status:** Brainstorm complete, ready for planning
**Scope:** Lightweight (scaffold only)

## Problem

Andy wants a single VSCode extension that acts as a personal "kitchen sink" — a long-lived home for grammar/syntax-highlighting tweaks, snippets, custom commands, and (eventually) language features. Today these would otherwise live as one-off gists, scratch files, or fragmented per-language extensions, which makes them hard to evolve, version, or share later.

## Goal

Stand up the **chassis** for that extension: a working, installable VSCode extension that compiles, packages, and sideloads cleanly, with empty-but-wired stubs for each contribution type. No real features in v1 — the win is that adding a new grammar, snippet, command, or language-feature provider is a small, well-paved diff.

## Non-Goals (v1)

- Publishing to the public Marketplace.
- A specific language grammar, snippet pack, or command — those are deliberately deferred.
- Heavy language features (LSP server, full formatters, diagnostics).
- Cross-editor portability (Cursor, Windsurf, etc.) — assume VSCode-compatible only for now.

## Audience & Distribution

- **Primary user:** Andy, on his own machines.
- **Distribution:** sideload via `.vsix` initially. Keep `package.json` clean enough that publishing to a private registry or the Marketplace later is a configuration change, not a rewrite.
- **Locked-in choices to handle carefully:** `publisher` field and the extension `name` (changing them post-publish is painful). Pick deliberate values up front; treat everything else as easy to evolve.

## Success Criteria

The scaffold is "done" when all of the following are true:

1. `code --install-extension <path>.vsix` installs the extension cleanly into VSCode.
2. The Extension Development Host (F5) launches the extension with no errors.
3. Each of the four contribution types has a wired-but-trivial stub that proves the pipeline works:
   - A grammar contribution that highlights a tiny demo language or a no-op injection.
   - A snippet contribution with at least one snippet.
   - A command contribution registered in the palette and bound to a no-op handler that shows an information message.
   - A language-feature stub (e.g., a hover provider) that returns a hardcoded value for a chosen scope.
4. A documented add-a-thing workflow exists in the README — "to add a new grammar/snippet/command/provider, do X."
5. Build, package, and (optional) lint commands run via a single `npm` script each.

## Functional Requirements

- **R1 — Grammar/highlighting slot:** `package.json` declares a `grammars` contribution; the repo has a `syntaxes/` directory with a sample `.tmLanguage.json` and a stub `language` contribution if a new language is registered.
- **R2 — Snippet slot:** `package.json` declares a `snippets` contribution pointing at a `snippets/` directory; at least one example snippet file exists.
- **R3 — Command slot:** `package.json` declares at least one `commands` contribution, contributed to the command palette, and bound in an activation entry point that registers it via `vscode.commands.registerCommand`.
- **R4 — Language-feature slot:** the activation entry point also registers one example provider (recommend a `HoverProvider`) against a chosen language selector, returning placeholder content. Demonstrates the provider-registration pattern without requiring an LSP.
- **R5 — Activation:** uses modern activation events (e.g., `onCommand`, `onLanguage`) so the extension is not always-on. Document which events are wired and why.
- **R6 — Settings hook (lightweight):** `package.json` declares one example `configuration` setting that the command stub reads, so the settings-driven config pattern is in place from day one.

## Non-Functional Requirements

- **Repo hygiene:** standard `.gitignore`, `.vscodeignore`, `README.md`, `CHANGELOG.md`, and a license placeholder.
- **Reproducible install:** lockfile committed; `npm ci && npm run package` produces a working `.vsix` on a clean machine.
- **Low ceremony:** no premature CI, no test framework, no bundler optimization — add those when a real feature needs them.
- **No secrets baked in:** anything user-specific lives in VSCode settings, not in source.

## Open Questions (for planning, not blocking)

- TypeScript vs JavaScript for the activation file. (Recommend TypeScript — better DX with the `vscode` API types, minor build cost.)
- Bundler choice: `tsc` only, `esbuild`, or `webpack`. (Recommend `esbuild` — fast and the current VSCode-recommended path.)
- Whether to register a real new language in v1 or use an injection grammar against an existing language for the demo.
- Repo layout if this ever needs to host *multiple* sibling extensions later (monorepo vs single extension). Defer until a second extension is actually needed.

## Dependencies / Assumptions

- VSCode-compatible editor (assumption: VSCode stable, current major version).
- Node.js + npm available locally.
- `vsce` (or `@vscode/vsce`) used for packaging.
- No marketplace publisher account required for v1.

## Handoff Notes

Next step: `/ce-plan` to turn this into an implementation plan covering repo layout, `package.json` contributions, the activation entry point, build/package scripts, and the README "how to add a new X" section.
