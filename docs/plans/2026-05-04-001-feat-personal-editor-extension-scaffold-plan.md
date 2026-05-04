---
title: "feat: Personal editor extension scaffold"
type: feat
status: active
date: 2026-05-04
origin: docs/brainstorms/personal-editor-extension-requirements.md
---

# feat: Personal editor extension scaffold

## Overview

Stand up a fresh VSCode extension in this empty repo that wires stubs for all four contribution types (grammar/highlighting, snippets, commands, language features) so that future personal tweaks have a paved path to land. No real feature behavior in this plan — the deliverable is a chassis that compiles, packages to a `.vsix`, sideloads cleanly, and documents how to add each kind of contribution.

Toolchain locked in: **TypeScript** activation source, **esbuild** bundler, **injection grammar** for the highlighting demo (no new language registration).

---

## Problem Frame

Andy maintains a growing pile of personal editor tweaks — grammar snippets, snippets, custom commands — that today live as gists, scratch files, or fragmented per-language extensions. He wants a single long-lived home so adding the next tweak is a small, well-paved diff rather than a fresh project. (See origin: [docs/brainstorms/personal-editor-extension-requirements.md](../brainstorms/personal-editor-extension-requirements.md).)

The repo at `/Users/andy/CODE/editor-extension` is currently empty (no commits yet), so this plan is greenfield.

---

## Requirements Trace

- R1. Grammar/highlighting slot — `package.json` declares a `grammars` contribution backed by a sample injection grammar in `syntaxes/`. (origin R1)
- R2. Snippet slot — `package.json` declares a `snippets` contribution backed by an example file in `snippets/`. (origin R2)
- R3. Command slot — `package.json` declares at least one command, contributed to the palette and wired in the activation entry. (origin R3)
- R4. Language-feature slot — activation entry registers a `HoverProvider` against a chosen selector, returning placeholder content. (origin R4)
- R5. Modern activation — uses `onCommand` / `onLanguage` style activation, not always-on. (origin R5)
- R6. Settings hook — `package.json` declares one example `configuration` setting that the command stub reads. (origin R6)
- R7. Reproducible install — `npm ci && npm run package` produces a working `.vsix` on a clean machine; `code --install-extension` succeeds. (origin success criteria 1, 5; non-functional)
- R8. Documented add-a-thing workflow — README explains how to add a new grammar / snippet / command / provider. (origin success criterion 4)

---

## Scope Boundaries

- No real feature content — grammars, snippets, commands, and providers are deliberately trivial stubs.
- No test framework, no CI, no bundler optimization — explicit non-goal in origin.
- No marketplace publishing in this plan; structure must remain *publishable later*, but no `vsce publish` step here.
- No LSP server, formatter, or diagnostics provider.
- No cross-editor compatibility work (Cursor, Windsurf, etc.).

---

## Context & Research

### Relevant Code and Patterns

None — empty repo, no prior commits. All structure is greenfield and follows standard VSCode extension conventions.

### Institutional Learnings

None applicable — no prior `docs/solutions/` exists in this repo.

### External References

Standard VSCode extension authoring docs apply (manifest contribution points, activation events, `vscode` API). No version-specific external research needed for a scaffold; verify exact `engines.vscode` and `@types/vscode` versions against the user's installed VSCode at implementation time.

---

## Key Technical Decisions

- **TypeScript over JavaScript for activation source.** Strong DX with the `vscode` API types; minor build cost is acceptable. (origin open question — resolved.)
- **esbuild over tsc-only or webpack.** Fast, current VSCode-recommended bundling path, single config file. (origin open question — resolved.)
- **Injection grammar over registering a new language.** The demo injects into an existing language (Markdown chosen as the default target — highlights `TODO`, `FIXME`, `NOTE` keywords inside Markdown). Avoids the ceremony of language registration while still proving the grammar pipeline. (origin open question — resolved.)
- **Single extension, not a monorepo.** Origin defers monorepo until a second extension is actually needed.
- **Activation events:** `onCommand:<commandId>` for the command stub, `onLanguage:markdown` for the hover provider. Keeps the extension off when not needed.
- **Publisher and extension `name` chosen deliberately at scaffold time.** These are sticky post-publish; pick once and don't churn. Recommend `andycohen` as publisher and `personal-editor-extension` as the extension name (confirmable at implementation time).
- **Hover provider attached to Markdown** to share the same activation surface as the injection grammar — one demo file exercises both.

---

## Open Questions

### Resolved During Planning

- TypeScript vs JavaScript → TypeScript.
- Bundler choice → esbuild.
- New language vs injection grammar → injection (Markdown target).
- Repo layout (single extension vs monorepo) → single extension; defer monorepo.

### Deferred to Implementation

- Exact `engines.vscode` floor — pin to the user's currently installed VSCode major at implementation time.
- Final `publisher` and extension `name` strings — recommended values above; confirm before first `vsce package`.
- Whether to commit the generated `.vsix` artifact or `.gitignore` it — default to `.gitignore`, revisit if distribution workflow changes.

---

## Output Structure

```
editor-extension/
├── .gitignore
├── .vscode/
│   └── launch.json                 # F5 dev host config
├── .vscodeignore
├── CHANGELOG.md
├── LICENSE
├── README.md
├── esbuild.config.mjs
├── package.json
├── package-lock.json
├── snippets/
│   └── example.code-snippets
├── src/
│   └── extension.ts                # activation entry: command + hover provider + config read
├── syntaxes/
│   └── markdown-todo.injection.json
├── tsconfig.json
└── docs/
    ├── brainstorms/                # already exists
    └── plans/                      # already exists
```

The `dist/` build output and any `.vsix` artifacts are git-ignored.

---

## Implementation Units

- U1. **Project scaffold and toolchain**

**Goal:** Establish a buildable, packageable empty extension with TypeScript + esbuild wired up. No contributions yet — just the chassis.

**Requirements:** R7

**Dependencies:** None

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `.gitignore`
- Create: `.vscodeignore`
- Create: `.vscode/launch.json`
- Create: `LICENSE`
- Create: `CHANGELOG.md`
- Create: `src/extension.ts` (minimal `activate`/`deactivate` exports, no real behavior yet)

**Approach:**
- `package.json`: set `name`, `displayName`, `publisher`, `version` (`0.0.1`), `engines.vscode`, `main` pointing at `dist/extension.js`, `activationEvents: []` (filled in later units), and `contributes: {}` (filled in later units).
- `devDependencies`: `@types/vscode`, `@types/node`, `typescript`, `esbuild`, `@vscode/vsce`.
- `scripts`: `build` (esbuild bundle), `watch` (esbuild watch), `package` (build + `vsce package`), `vscode:prepublish` (build).
- `tsconfig.json`: target ES2022, module commonjs, strict, `outDir` is irrelevant since esbuild bundles — keep `noEmit: true` and let esbuild handle output.
- `esbuild.config.mjs`: bundle `src/extension.ts` to `dist/extension.js`, `platform: node`, `format: cjs`, `external: ['vscode']`, sourcemaps in dev.
- `.vscodeignore`: exclude `src/`, `node_modules/`, `tsconfig.json`, `esbuild.config.mjs`, `docs/`, `.vscode/`, source maps in production builds.
- `.vscode/launch.json`: standard "Run Extension" config that launches the Extension Development Host with `--extensionDevelopmentPath`.

**Patterns to follow:**
- Standard VSCode extension layout per official authoring docs.

**Test scenarios:**
- Test expectation: none — pure project scaffold. Per origin non-functional requirements ("no test framework... add those when a real feature needs them"). Manual verification only.

**Verification:**
- `npm install` succeeds.
- `npm run build` produces `dist/extension.js` with no errors.
- Pressing F5 in VSCode launches the Extension Development Host without errors.
- `npm run package` produces a `.vsix` file in the repo root.

---

- U2. **Declarative contributions: grammar, snippets, command, configuration**

**Goal:** Wire all four declarative manifest contributions and their backing static files. No activation code yet — this unit is pure JSON.

**Requirements:** R1, R2, R3, R6

**Dependencies:** U1

**Files:**
- Modify: `package.json` (add `contributes.grammars`, `contributes.snippets`, `contributes.commands`, `contributes.configuration`, and corresponding `activationEvents`)
- Create: `syntaxes/markdown-todo.injection.json`
- Create: `snippets/example.code-snippets`

**Approach:**
- **Grammar (injection):** declares an injection scope targeting `text.html.markdown` (Markdown's TextMate scope), matching the words `TODO`, `FIXME`, `NOTE` and assigning them a meaningful scope name (e.g., `keyword.todo.markdown`) so VSCode themes will color them.
- **Snippets:** one example snippet file scoped to a sensible language (e.g., `markdown` or `plaintext`) with a single trivial snippet (`hello` → "Hello, world!"). Matches `snippets/example.code-snippets` per VSCode convention.
- **Commands:** declare one command — e.g., `personalEditorExtension.helloWorld` with title "Personal: Hello World" — contributed to the palette via the `commands` array.
- **Configuration:** declare one setting — e.g., `personalEditorExtension.greeting` (type string, default "Hello") — that the command stub will read in U3.
- **Activation events:** add `onCommand:personalEditorExtension.helloWorld` and `onLanguage:markdown`. The grammar contribution itself activates implicitly on language load; the explicit `onLanguage:markdown` is for the hover provider added in U3.

**Patterns to follow:**
- VSCode TextMate injection grammar conventions (`injectionSelector`, `scopeName`).
- VSCode snippet file format.

**Test scenarios:**
- Test expectation: none — declarative manifest changes only. Manual verification via the dev host.

**Verification:**
- F5 dev host: open a Markdown file containing `TODO: something` — the `TODO` is highlighted differently from surrounding prose.
- F5 dev host: in a Markdown file, type the snippet prefix (`hello`) and confirm the snippet expands.
- F5 dev host: command palette shows "Personal: Hello World" (it will fail to run until U3, which is expected).
- VSCode Settings UI shows the `personalEditorExtension.greeting` setting under the extension's section.

---

- U3. **Activation entry: command handler and hover provider**

**Goal:** Implement the TypeScript activation source. Register the command (reading the configuration setting) and a `HoverProvider` for Markdown returning placeholder content. This unit proves the dynamic side of the contribution pipeline end-to-end.

**Requirements:** R3, R4, R5, R6

**Dependencies:** U1, U2

**Files:**
- Modify: `src/extension.ts`

**Approach:**
- `activate(context)`:
  - Register the `personalEditorExtension.helloWorld` command. Handler reads `vscode.workspace.getConfiguration('personalEditorExtension').get<string>('greeting', 'Hello')` and shows it via `vscode.window.showInformationMessage`. Push the disposable onto `context.subscriptions`.
  - Register a `HoverProvider` against `{ language: 'markdown' }`. The provider returns a `vscode.Hover` with a hardcoded `MarkdownString` (e.g., "Personal extension hover stub — replace me."). Push onto `context.subscriptions`.
- `deactivate()`: empty — disposables handle cleanup.
- Keep the file small (under ~50 lines). The shape is the deliverable, not the behavior.

**Patterns to follow:**
- VSCode `vscode.commands.registerCommand` and `vscode.languages.registerHoverProvider` conventions.
- Always push disposables onto `context.subscriptions` for proper cleanup.

**Test scenarios:**
- Test expectation: none — scaffold-only stub behavior, per origin non-functional requirements. Test framework deferred until a real feature lands. Manual verification via the dev host (below).

**Verification:**
- F5 dev host: run "Personal: Hello World" from the palette — an info message shows "Hello" (or the configured greeting if changed).
- F5 dev host: hover over any text in a Markdown file — the placeholder hover message appears.
- Changing `personalEditorExtension.greeting` in settings and re-running the command shows the new value (no reload required because `getConfiguration` reads live).
- TypeScript compiles with no errors under strict mode.

---

- U4. **README, add-a-thing workflow docs, and final packaging check**

**Goal:** Write the README that documents the chassis and explains how to add each of the four contribution types. Confirm the full install/uninstall loop works.

**Requirements:** R7, R8

**Dependencies:** U1, U2, U3

**Files:**
- Create: `README.md`
- Modify: `CHANGELOG.md` (add a `0.0.1 — initial scaffold` entry)

**Approach:**
- README sections:
  - **What this is** — one paragraph, personal extension chassis.
  - **Install** — `npm ci`, then `npm run package`, then `code --install-extension <file>.vsix`. Note: also `code --uninstall-extension <publisher>.<name>`.
  - **Develop** — F5 in VSCode launches the dev host; `npm run watch` for incremental rebuilds.
  - **Adding a new grammar** — drop a `.tmLanguage.json` in `syntaxes/`, add a `contributes.grammars` entry; injection vs language registration noted briefly.
  - **Adding a new snippet** — drop a file in `snippets/`, add a `contributes.snippets` entry.
  - **Adding a new command** — declare in `contributes.commands`, add an `onCommand:` activation event, register the handler in `src/extension.ts`.
  - **Adding a new language-feature provider** — register via the appropriate `vscode.languages.register*Provider` in `src/extension.ts`, add an `onLanguage:` activation event if needed.
  - **Settings** — explain how to read `vscode.workspace.getConfiguration` values.
- Keep each section to 3-6 lines. The README's job is to be a navigable index, not a tutorial.

**Patterns to follow:**
- Match the structure of existing well-known personal extensions (e.g., one section per contribution type, code-fence examples lifted from this repo's own files).

**Test scenarios:**
- Test expectation: none — documentation and packaging confirmation only.

**Verification:**
- `npm ci && npm run package` on a clean clone produces a `.vsix`.
- `code --install-extension <vsix>` installs without errors.
- After install, the command appears in a non-dev VSCode instance, the snippet expands in a Markdown file, the injection grammar highlights `TODO`, and the hover stub fires.
- `code --uninstall-extension <publisher>.<name>` cleanly removes it.
- README's "adding a new X" sections each match the actual file layout produced by U1–U3.

---

## System-Wide Impact

- **Interaction graph:** N/A — the extension is self-contained and does not integrate with other repos or services.
- **Error propagation:** Activation errors surface in the VSCode "Extensions" output channel; no custom error handling needed for stubs.
- **State lifecycle risks:** None — disposables registered on `context.subscriptions` are the only state.
- **API surface parity:** N/A.
- **Integration coverage:** Manual F5 dev-host verification covers all integration paths for this scaffold.
- **Unchanged invariants:** Greenfield repo — no prior code or contracts to preserve.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Picking a `publisher` / `name` that's hard to change later | Confirm both values once before first `vsce package`; document in CHANGELOG that 0.0.1 establishes them. |
| `engines.vscode` floor too high or too low | Pin to the user's installed VSCode major at implementation time; revisit if Cursor or older VSCode is added as a target later. |
| Scope creep during implementation (e.g., wanting to add a real command immediately) | The plan is explicit: scaffold only. Any real feature lands in a follow-up plan. |
| Injection grammar scope name conflicts with theme expectations | Use a descriptive scope (`keyword.todo.markdown` or similar); accept that exact coloring depends on theme. |

---

## Documentation / Operational Notes

- README is the operational doc; no separate runbook needed for a personal extension.
- No monitoring, rollout, or migration concerns.
- Commit `package-lock.json` so `npm ci` is reproducible.

---

## Sources & References

- **Origin document:** [docs/brainstorms/personal-editor-extension-requirements.md](../brainstorms/personal-editor-extension-requirements.md)
- Related code: none (greenfield).
- Related PRs/issues: none.
- External docs: VSCode Extension API (`code.visualstudio.com/api`) — manifest contribution points, activation events, `HoverProvider`, TextMate injection grammars.
