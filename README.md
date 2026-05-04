# TextMate3

Personal VSCode extension chassis. A long-lived home for grammar tweaks, snippets, custom commands, and small language features. The repo ships with one trivial example of each so adding the next tweak is a small diff, not a fresh project.

**Extension ID:** `outlawandy.text-mate-3`

## What's in the box

- **Injection grammar** — highlights `TODO`, `FIXME`, `NOTE`, `HACK`, `XXX` inside Markdown.
- **Snippet** — type `hello` in Markdown or plaintext to expand "Hello, world!".
- **Command** — `TextMate3: Hello World` in the palette; reads the `textMate3.greeting` setting.
- **Hover provider** — placeholder hover on any Markdown text.

## Install

```bash
npm ci
npm run package         # produces text-mate-3-0.0.1.vsix
code --install-extension text-mate-3-0.0.1.vsix
```

To remove:

```bash
code --uninstall-extension outlawandy.text-mate-3
```

## Develop

Press **F5** in VSCode to launch an Extension Development Host with the extension loaded. Run `npm run watch` in a terminal for incremental rebuilds while iterating.

```bash
npm run build       # one-shot esbuild
npm run watch       # esbuild --watch
npm run typecheck   # tsc --noEmit
npm run package     # build + vsce package
```

## Adding a new contribution

### Grammar (injection)

1. Drop a `.tmLanguage.json` (or `.json`) file in [syntaxes/](syntaxes/).
2. Add a `contributes.grammars` entry in [package.json](package.json) with `scopeName`, `path`, and either `injectTo` (for injections) or `language` (for new-language registration).
3. For a brand-new language, also declare `contributes.languages` with the language id, file extensions, and configuration.

See [syntaxes/markdown-todo.injection.json](syntaxes/markdown-todo.injection.json) for the injection pattern.

### Snippet

1. Add a snippet file in [snippets/](snippets/) following the [VSCode snippet syntax](https://code.visualstudio.com/api/language-extensions/snippet-guide).
2. Add a `contributes.snippets` entry in [package.json](package.json) with `language` and `path`.

See [snippets/example.code-snippets](snippets/example.code-snippets).

### Command

1. Declare the command in `contributes.commands` (id, title, optional category) in [package.json](package.json).
2. Register the handler in [src/extension.ts](src/extension.ts) via `vscode.commands.registerCommand` and push the disposable onto `context.subscriptions`.
3. VSCode auto-generates the `onCommand:` activation event from the manifest in modern engine versions — no manual `activationEvents` entry needed.

### Language-feature provider (hover, completion, definition, etc.)

1. Register the provider in [src/extension.ts](src/extension.ts) via the matching `vscode.languages.register*Provider` API.
2. Add `onLanguage:<id>` to `activationEvents` in [package.json](package.json) so the extension activates when files of that type open.

See the `HoverProvider` registration in [src/extension.ts](src/extension.ts).

### Settings

Read at runtime with `vscode.workspace.getConfiguration("textMate3").get<T>("key", default)`. Declare new settings under `contributes.configuration.properties` in [package.json](package.json) so they appear in the Settings UI and pick up types and defaults.

## Repo layout

```
src/extension.ts          # activation entry: commands + providers
syntaxes/                 # TextMate grammars
snippets/                 # snippet files
package.json              # manifest + contributions
esbuild.config.mjs        # bundler
```

## Notes

- `publisher` (`outlawandy`) and extension `name` (`text-mate-3`) are sticky once published. Don't change them casually.
- No test suite yet. Verification is manual via the F5 dev host plus a clean install/uninstall loop.
- Built `.vsix` artifacts are gitignored.
