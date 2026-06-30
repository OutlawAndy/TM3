// Inference layer for inline completions, backed by the Pi harness's unified
// LLM client (`@earendil-works/pi-ai`). This is deliberately the *bottom* Pi
// layer — the multi-provider LLM client — not `pi-agent-core`. The agent loop
// is turn-based and tool-calling; inline completion needs a single low-latency,
// cancellable streaming/complete call per keystroke, which is exactly what
// `pi-ai` exposes (`models.complete` / `models.stream` with an `AbortSignal`).

import {
  createModels,
  type Context,
  type MutableModels,
} from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";

export interface CompletionRequest {
  /** Text before the cursor (already windowed to a budget). */
  prefix: string;
  /** Text after the cursor (already windowed to a budget). */
  suffix: string;
  languageId: string;
  signal: AbortSignal;
}

export interface EngineConfig {
  /** pi-ai model id, e.g. "claude-haiku-4-5". */
  model: string;
  maxTokens: number;
  temperature: number;
  /** Optional explicit key; when empty, pi-ai falls back to ANTHROPIC_API_KEY. */
  apiKey?: string;
}

// `createModels()` builds a provider registry; we register Anthropic once and
// reuse it across requests. Lazy so we don't touch the SDK until the feature is
// actually used.
let models: MutableModels | null = null;

function getModels(): MutableModels {
  if (!models) {
    models = createModels();
    models.setProvider(anthropicProvider());
  }
  return models;
}

const SYSTEM_PROMPT = [
  "You are an inline code-completion engine, like GitHub Copilot.",
  "You receive the code before the cursor (<PREFIX>) and after it (<SUFFIX>).",
  "Reply with ONLY the raw text to insert at the cursor — the continuation that",
  "bridges prefix and suffix. No explanations, no commentary, no markdown code",
  "fences. Preserve the surrounding indentation style. If no useful completion",
  "is possible, reply with an empty string.",
].join(" ");

function buildUserPrompt(req: CompletionRequest): string {
  return [
    `Language: ${req.languageId}`,
    "<PREFIX>",
    req.prefix,
    "</PREFIX>",
    "<SUFFIX>",
    req.suffix,
    "</SUFFIX>",
    "Insertion at cursor (between PREFIX and SUFFIX):",
  ].join("\n");
}

// Models occasionally wrap output in a fence despite the instruction; strip a
// single leading/trailing fence if present.
function stripCodeFence(text: string): string {
  const fence = /^```[^\n]*\n([\s\S]*?)\n?```$/;
  const m = text.match(fence);
  return m ? m[1] : text;
}

/**
 * Generate a single inline completion. Returns the insertion text, or "" when
 * there is nothing useful to suggest or the request was cancelled.
 */
export async function generateCompletion(
  req: CompletionRequest,
  cfg: EngineConfig,
): Promise<string> {
  const m = getModels();
  const model = m.getModel("anthropic", cfg.model);
  if (!model) {
    throw new Error(
      `Unknown pi-ai model "${cfg.model}" for provider "anthropic".`,
    );
  }

  const context: Context = {
    systemPrompt: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: buildUserPrompt(req), timestamp: Date.now() },
    ],
  };

  const message = await m.complete(model, context, {
    maxTokens: cfg.maxTokens,
    temperature: cfg.temperature,
    signal: req.signal,
    ...(cfg.apiKey ? { apiKey: cfg.apiKey } : {}),
  });

  // Cancelled mid-flight (a newer keystroke superseded this request).
  if (message.stopReason === "aborted") {
    return "";
  }
  if (message.stopReason === "error") {
    throw new Error(message.errorMessage ?? "pi-ai completion failed.");
  }

  const text = message.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");

  return stripCodeFence(text.trim());
}
