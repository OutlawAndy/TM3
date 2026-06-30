// VSCode glue for inline (ghost-text) suggestions. This is the *native*
// inline-completion surface — `vscode.languages.registerInlineCompletionItemProvider`
// — deliberately NOT a language server. A native provider runs in-process, has
// the lowest latency, and is the path GitHub Copilot itself uses. An LSP would
// only buy cross-editor reuse (Neovim/JetBrains) at the cost of an out-of-process
// boundary, so the PoC skips it.

import * as vscode from "vscode";
import { generateCompletion } from "./engine";

interface InlineConfig {
  enabled: boolean;
  model: string;
  baseUrl: string;
  contextWindow: number;
  debounceMs: number;
  maxTokens: number;
  temperature: number;
  maxPrefixChars: number;
  maxSuffixChars: number;
  apiKey: string;
}

function readConfig(): InlineConfig {
  const cfg = vscode.workspace.getConfiguration("tm3.inline");
  return {
    enabled: cfg.get<boolean>("enabled", false),
    model: cfg.get<string>("model", "claude-haiku-4-5"),
    baseUrl: cfg.get<string>("baseUrl", ""),
    contextWindow: cfg.get<number>("contextWindow", 8192),
    debounceMs: cfg.get<number>("debounceMs", 300),
    maxTokens: cfg.get<number>("maxTokens", 256),
    temperature: cfg.get<number>("temperature", 0.1),
    maxPrefixChars: cfg.get<number>("maxPrefixChars", 2000),
    maxSuffixChars: cfg.get<number>("maxSuffixChars", 1000),
    apiKey: cfg.get<string>("apiKey", ""),
  };
}

function sleep(ms: number, token: vscode.CancellationToken): Promise<void> {
  return new Promise((resolve) => {
    const handle = setTimeout(resolve, ms);
    token.onCancellationRequested(() => {
      clearTimeout(handle);
      resolve();
    });
  });
}

// Window the document around the cursor to a character budget so we don't ship
// an entire large file on every keystroke.
function windowedPrefix(
  document: vscode.TextDocument,
  position: vscode.Position,
  maxChars: number,
): string {
  const start = document.offsetAt(position) - maxChars;
  const from = document.positionAt(Math.max(0, start));
  return document.getText(new vscode.Range(from, position));
}

function windowedSuffix(
  document: vscode.TextDocument,
  position: vscode.Position,
  maxChars: number,
): string {
  const end = document.offsetAt(position) + maxChars;
  const to = document.positionAt(end);
  return document.getText(new vscode.Range(position, to));
}

export function registerInlineCompletions(
  context: vscode.ExtensionContext,
): void {
  const provider: vscode.InlineCompletionItemProvider = {
    async provideInlineCompletionItems(document, position, _ctx, token) {
      const cfg = readConfig();
      if (!cfg.enabled) {
        return undefined;
      }

      // Debounce: wait out the quiet period; if a newer keystroke arrives VSCode
      // cancels this token and we bail before spending a request.
      await sleep(cfg.debounceMs, token);
      if (token.isCancellationRequested) {
        return undefined;
      }

      const prefix = windowedPrefix(document, position, cfg.maxPrefixChars);
      const suffix = windowedSuffix(document, position, cfg.maxSuffixChars);
      if (prefix.trim().length === 0) {
        return undefined;
      }

      // Bridge VSCode cancellation → pi-ai AbortSignal.
      const ac = new AbortController();
      token.onCancellationRequested(() => ac.abort());

      let text: string;
      try {
        text = await generateCompletion(
          {
            prefix,
            suffix,
            languageId: document.languageId,
            signal: ac.signal,
          },
          {
            model: cfg.model,
            baseUrl: cfg.baseUrl || undefined,
            contextWindow: cfg.contextWindow,
            maxTokens: cfg.maxTokens,
            temperature: cfg.temperature,
            apiKey: cfg.apiKey || undefined,
          },
        );
      } catch (err) {
        // Surface once, quietly — inline providers must never throw into the UI.
        console.error("[tm3.inline] completion failed:", err);
        return undefined;
      }

      if (!text || token.isCancellationRequested) {
        return undefined;
      }

      const item = new vscode.InlineCompletionItem(
        text,
        new vscode.Range(position, position),
      );
      return [item];
    },
  };

  // `{ pattern: "**" }` registers for every file; gate per-language later via
  // config if desired.
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: "**" },
      provider,
    ),
  );
}
