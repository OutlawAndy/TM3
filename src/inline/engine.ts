// Inference layer for inline completions, backed by the Pi harness's unified
// LLM client (`@earendil-works/pi-ai`). This is deliberately the *bottom* Pi
// layer — the multi-provider LLM client — not `pi-agent-core`. The agent loop
// is turn-based and tool-calling; inline completion needs a single low-latency,
// cancellable streaming/complete call per keystroke, which is exactly what
// `pi-ai` exposes (`models.complete` / `models.stream` with an `AbortSignal`).

import {
  createModels,
  createProvider,
  envApiKeyAuth,
  type Context,
  type Model,
  type MutableModels,
} from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";

const LOCAL_PROVIDER_ID = "local-openai";

export interface CompletionRequest {
  /** Text before the cursor (already windowed to a budget). */
  prefix: string;
  /** Text after the cursor (already windowed to a budget). */
  suffix: string;
  languageId: string;
  signal: AbortSignal;
}

export interface EngineConfig {
  /** pi-ai model id, e.g. "claude-haiku-4-5", or the model name your local server serves. */
  model: string;
  maxTokens: number;
  temperature: number;
  /**
   * When set, talk to an OpenAI-compatible server at this base URL (e.g. a local
   * MLX server's `http://localhost:PORT/v1`) instead of Anthropic. Leave empty
   * for hosted Anthropic.
   */
  baseUrl?: string;
  /** Token context window to advertise for the local model. */
  contextWindow?: number;
  /**
   * Explicit API key. For Anthropic, empty falls back to ANTHROPIC_API_KEY. For
   * a local server, empty falls back to MLX_API_KEY / OPENAI_API_KEY (most local
   * servers ignore the value, but pi-ai needs *some* key to consider the
   * provider configured — any non-empty placeholder works).
   */
  apiKey?: string;
}

// `createModels()` builds a provider registry. We cache one registry per
// distinct backend signature so toggling the baseUrl setting rebuilds cleanly.
let models: MutableModels | null = null;
let modelsSignature = "";

function backendSignature(cfg: EngineConfig): string {
  return cfg.baseUrl ? `local:${cfg.baseUrl}:${cfg.model}` : "anthropic";
}

// Build a one-model OpenAI-compatible provider pointed at a local server. Pi-ai
// auto-detects most compat quirks from the baseUrl; we only declare the model.
function localProvider(cfg: EngineConfig) {
  const model: Model<"openai-completions"> = {
    id: cfg.model,
    name: cfg.model,
    api: "openai-completions",
    provider: LOCAL_PROVIDER_ID,
    baseUrl: cfg.baseUrl!,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: cfg.contextWindow ?? 8192,
    maxTokens: cfg.maxTokens,
  };
  return createProvider({
    id: LOCAL_PROVIDER_ID,
    name: "Local OpenAI-compatible server",
    baseUrl: cfg.baseUrl,
    auth: { apiKey: envApiKeyAuth("Local server", ["MLX_API_KEY", "OPENAI_API_KEY"]) },
    models: [model],
    api: openAICompletionsApi(),
  });
}

function getModels(cfg: EngineConfig): MutableModels {
  const sig = backendSignature(cfg);
  if (!models || sig !== modelsSignature) {
    models = createModels();
    models.setProvider(cfg.baseUrl ? localProvider(cfg) : anthropicProvider());
    modelsSignature = sig;
  }
  return models;
}

function providerId(cfg: EngineConfig): string {
  return cfg.baseUrl ? LOCAL_PROVIDER_ID : "anthropic";
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
  const m = getModels(cfg);
  const provider = providerId(cfg);
  const model = m.getModel(provider, cfg.model);
  if (!model) {
    throw new Error(
      `Unknown pi-ai model "${cfg.model}" for provider "${provider}".`,
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
