# Spike: Pi-backed Copilot-style inline suggestions

**Date:** 2026-06-30
**Branch:** `claude/language-server-pi-copilot-o90rer`
**Question:** How large an effort is a language server that uses the Pi harness
to provide Copilot-like inline suggestions?

## What "Pi harness" turned out to be

[`earendil-works/pi`](https://github.com/earendil-works/pi) — an open-source,
provider-agnostic (BYOK) agentic coding harness. It ships as layered packages:

| Package | Role | Used here? |
| --- | --- | --- |
| `@earendil-works/pi-ai` | Unified multi-provider LLM client | ✅ the inference layer |
| `@earendil-works/pi-agent-core` | Agent loop (tool calling, state) | ❌ wrong shape for completion |
| `@earendil-works/pi-coding-agent` | Interactive TUI CLI | ❌ |
| `@earendil-works/pi-tui` | Terminal UI | ❌ |

The key decision: integrate at the **bottom** layer (`pi-ai`), not the agent
loop. The agent loop is turn-based and tool-calling — high latency by design.
Inline completion needs one low-latency, cancellable call per keystroke.

## What the spike confirmed about `pi-ai` (v0.80.2)

Both open questions from the estimate are answered — **yes** to both:

- **Streaming:** `models.stream(model, context, opts)` yields `text_delta`
  events with `s.result()` for the final message.
- **Cancellation:** `StreamOptions.signal?: AbortSignal`; aborted requests
  return `stopReason === "aborted"`. Maps cleanly onto VSCode's
  `CancellationToken`.
- **One-shot call:** `models.complete(model, context, opts)` returns a full
  `AssistantMessage` — what the PoC uses.
- **Model lookup:** `models.getModel("anthropic", "claude-haiku-4-5")`.
- **Key handling:** `opts.apiKey`, else falls back to `ANTHROPIC_API_KEY`.

## What was built

A **native** inline-completion provider — deliberately *not* a language server.
`vscode.languages.registerInlineCompletionItemProvider` runs in-process at the
lowest latency and is the path Copilot itself uses; an LSP would only add value
for cross-editor reuse (Neovim/JetBrains) at the cost of an out-of-process hop.

- `src/inline/engine.ts` — `pi-ai` integration: provider registration, FIM-style
  prompt assembly (`<PREFIX>`/`<SUFFIX>`), `complete()` call, fence stripping.
- `src/inline/provider.ts` — VSCode glue: debounce, document windowing to a char
  budget, `CancellationToken` → `AbortController` bridge, ghost-text item.
- `package.json` — `tm3.inline.*` settings (off by default) + `onStartupFinished`.
- `tsconfig.json` — `module: ESNext` / `moduleResolution: Bundler` so `tsc`
  resolves pi-ai's `exports` map (matches esbuild's bundling).

## How to try it

1. `npm ci && npm run build`
2. Set `tm3.inline.apiKey` (or export `ANTHROPIC_API_KEY`) and flip
   `tm3.inline.enabled` to `true`.
3. **F5** to launch the Extension Development Host, open any file, and type —
   ghost text appears after the debounce; **Tab** accepts.

## Reflections / what the PoC is *not*

The plumbing (VSCode surface + `pi-ai` call) is genuinely small — this is the
~3–5 day PoC tier. The remaining distance to a Copilot-quality feature is in the
parts this spike intentionally stubbed:

- **Context assembly is naive** — a single prefix/suffix window, no neighbor-file
  retrieval, no symbol context, no token-budget management. This is the real
  quality lever (the multi-week piece).
- **Latency** — general chat models aren't purpose-built FIM endpoints, so p50
  will trail Copilot. `complete()` is used; switching to `stream()` would let us
  show partial ghost text sooner. BYOK means a faster/local model is a config
  change, not a rewrite.
- **No acceptance telemetry, caching, or multi-suggestion cycling.**
- **`apiKey` setting is plaintext** — should move to `SecretStorage` before real use.

Bottom line unchanged: Pi removes the "build/maintain a multi-provider LLM client"
cost entirely; the effort that remains is context engineering and latency tuning,
not editor plumbing.
