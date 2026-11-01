import { Injectable, Logger } from "@nestjs/common"

export type AiProviderType =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "mistral"
  | "openrouter"
  | "azure"
  | "ollama"
  | "openai_compatible"

export interface ProviderSpec {
  type: AiProviderType
  label: string
  needsBaseUrl: boolean
  hasDefaultBaseUrl: boolean
  defaultBaseUrl: string
  needsKey: boolean
  keyOptional: boolean
  baseUrlPlaceholder: string
  defaultModels: string[]
}

export interface AiChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface AiChatResult {
  reply: string
  model: string
  durationMs: number
  usage: { input: number | null; output: number | null; total: number | null }
}

export const PROVIDER_SPECS: ProviderSpec[] = [
  {
    type: "openai",
    label: "OpenAI",
    needsBaseUrl: false,
    hasDefaultBaseUrl: true,
    defaultBaseUrl: "https://api.openai.com",
    needsKey: true,
    keyOptional: false,
    baseUrlPlaceholder: "https://api.openai.com",
    defaultModels: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o4-mini"],
  },
  {
    type: "anthropic",
    label: "Anthropic",
    needsBaseUrl: false,
    hasDefaultBaseUrl: true,
    defaultBaseUrl: "https://api.anthropic.com",
    needsKey: true,
    keyOptional: false,
    baseUrlPlaceholder: "https://api.anthropic.com",
    defaultModels: ["claude-sonnet-4-5", "claude-3-5-haiku", "claude-opus-4-1"],
  },
  {
    type: "google",
    label: "Google Gemini",
    needsBaseUrl: false,
    hasDefaultBaseUrl: true,
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    needsKey: true,
    keyOptional: false,
    baseUrlPlaceholder: "https://generativelanguage.googleapis.com",
    defaultModels: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  },
  {
    type: "groq",
    label: "Groq",
    needsBaseUrl: false,
    hasDefaultBaseUrl: true,
    defaultBaseUrl: "https://api.groq.com",
    needsKey: true,
    keyOptional: false,
    baseUrlPlaceholder: "https://api.groq.com",
    defaultModels: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  },
  {
    type: "mistral",
    label: "Mistral AI",
    needsBaseUrl: false,
    hasDefaultBaseUrl: true,
    defaultBaseUrl: "https://api.mistral.ai",
    needsKey: true,
    keyOptional: false,
    baseUrlPlaceholder: "https://api.mistral.ai",
    defaultModels: ["mistral-large-latest", "mistral-small-latest", "codestral-latest"],
  },
  {
    type: "openrouter",
    label: "OpenRouter",
    needsBaseUrl: false,
    hasDefaultBaseUrl: true,
    defaultBaseUrl: "https://openrouter.ai",
    needsKey: true,
    keyOptional: false,
    baseUrlPlaceholder: "https://openrouter.ai",
    defaultModels: ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "meta-llama/llama-3.1-70b-instruct"],
  },
  {
    type: "azure",
    label: "Azure OpenAI",
    needsBaseUrl: true,
    hasDefaultBaseUrl: false,
    defaultBaseUrl: "https://<resource>.openai.azure.com/openai/deployments/<deployment>",
    needsKey: true,
    keyOptional: false,
    baseUrlPlaceholder: "https://<resource>.openai.azure.com/openai/deployments/<deployment>",
    defaultModels: [],
  },
  {
    type: "ollama",
    label: "Ollama (Local)",
    needsBaseUrl: true,
    hasDefaultBaseUrl: true,
    defaultBaseUrl: "http://localhost:11434",
    needsKey: false,
    keyOptional: true,
    baseUrlPlaceholder: "http://localhost:11434",
    defaultModels: ["llama3.2", "llama3.1", "qwen2.5", "gemma2", "mistral"],
  },
  {
    type: "openai_compatible",
    label: "OpenAI-Compatible (Self-hosted)",
    needsBaseUrl: true,
    hasDefaultBaseUrl: false,
    defaultBaseUrl: "http://localhost:8080/v1",
    needsKey: false,
    keyOptional: true,
    baseUrlPlaceholder: "http://<host>:<port>/v1  (vLLM, llama.cpp, LM Studio...)",
    defaultModels: [],
  },
]

export function specFor(type: string): ProviderSpec {
  return PROVIDER_SPECS.find((s) => s.type === type) ?? PROVIDER_SPECS[PROVIDER_SPECS.length - 1]
}

function toBase(baseUrl: string | null | undefined, type: string): string {
  return (baseUrl ?? specFor(type).defaultBaseUrl).replace(/\/+$/, "")
}

function authHeaders(key: string | null): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (key) headers.Authorization = `Bearer ${key}`
  return headers
}

async function fetchJson(url: string, init: RequestInit): Promise<{ status: number; data: unknown }> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(60_000),
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const detail =
      typeof data === "object" && data !== null && "error" in data
        ? JSON.stringify((data as { error: unknown }).error)
        : typeof data === "string"
          ? data
          : JSON.stringify(data)
    throw new Error(`Provider returned ${res.status}: ${detail}`)
  }
  return { status: res.status, data }
}

const apiKeyErr = (type: string) => new Error(`No API key configured for ${type} provider`)

// ------------------------------------------------------------------ //
//  Model lists                                                         //
// ------------------------------------------------------------------ //

function stripModelPrefix(name: string): string {
  return name.startsWith("models/") ? name.slice("models/".length) : name
}

/** Best-effort fetch of the provider's model catalog. May return [] for providers without a list API. */
export async function fetchModelList(type: AiProviderType, baseUrl: string | null, apiKey: string | null): Promise<string[]> {
  const base = toBase(baseUrl, type)
  try {
    if (type === "google") {
      if (!apiKey) return []
      const { data } = await fetchJson(`${base}/v1beta/models?key=${encodeURIComponent(apiKey)}`, {
        headers: { "Content-Type": "application/json" },
      })
      const res = data as { models?: { name: string }[] }
      return (res.models ?? []).map((m) => stripModelPrefix(m.name)).filter(Boolean)
    }
    if (type === "anthropic") {
      const headers = authHeaders(apiKey)
      headers["anthropic-version"] = "2023-06-01"
      const { data } = await fetchJson(`${base}/v1/models`, { headers })
      const res = data as { data?: { id: string }[] }
      return (res.data ?? []).map((m) => m.id).filter(Boolean)
    }
    if (type === "azure") return []
    // OpenAI-compatible family (openai, groq, mistral, openrouter, ollama, openai_compatible)
    const { data } = await fetchJson(`${base}/v1/models`, { headers: authHeaders(apiKey) })
    const res = data as { data?: { id: string }[] }
    return (res.data ?? []).map((m) => m.id).filter(Boolean)
  } catch (err) {
    if (type === "azure") return []
    throw err
  }
}

// ------------------------------------------------------------------ //
//  Chat                                                               //
// ------------------------------------------------------------------ //

interface ChatResponseMeta {
  text: string | null
  usage: { input: number | null; output: number | null; total: number | null }
}

function chatResponseMeta(data: unknown): ChatResponseMeta {
  const d = data as {
    choices?: { message?: { content?: string | null } }[]
    content?: { type?: string; text?: string }[]
    usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
    usageMetadata?: { totalTokenCount?: number } | null
  }
  const text = d?.choices?.[0]?.message?.content ?? d?.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ?? null
  return {
    text,
    usage: {
      input: d?.usage?.input_tokens ?? null,
      output: d?.usage?.output_tokens ?? null,
      total: d?.usage?.total_tokens ?? d?.usageMetadata?.totalTokenCount ?? null,
    },
  }
}

/** Send a chat/completion request to any provider. Works for cloud, hosted and fully local endpoints. */
export async function providerChat(
  type: AiProviderType,
  baseUrl: string | null,
  apiKey: string | null,
  model: string,
  messages: AiChatMessage[],
  maxTokens: number
): Promise<AiChatResult> {
  const startedAt = Date.now()
  const base = toBase(baseUrl, type)

  if (type === "anthropic") {
    if (!apiKey) throw apiKeyErr(type)
    const headers = authHeaders(apiKey)
    headers["anthropic-version"] = "2023-06-01"
    const { data } = await fetchJson(`${base}/v1/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
    })
    const meta = chatResponseMeta(data)
    return { reply: meta.text ?? "", model, durationMs: Date.now() - startedAt, usage: meta.usage }
  }

  if (type === "google") {
    if (!apiKey) throw apiKeyErr(type)
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }))
    const { data } = await fetchJson(`${base}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    })
    const d = data as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const reply = d?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""
    const meta = chatResponseMeta(data)
    return { reply, model, durationMs: Date.now() - startedAt, usage: meta.usage }
  }

  if (type === "azure") {
    if (!apiKey) throw apiKeyErr(type)
    const headers = authHeaders(apiKey)
    delete headers.Authorization
    headers["api-key"] = apiKey
    const separator = base.includes("?") ? "&" : "?"
    const { data } = await fetchJson(`${base}${separator}api-version=${encodeURIComponent("2024-02-15-preview")}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
    })
    const meta = chatResponseMeta(data)
    return { reply: meta.text ?? "", model, durationMs: Date.now() - startedAt, usage: meta.usage }
  }

  // OpenAI-compatible family (openai, groq, mistral, openrouter, ollama, openai_compatible)
  const { data } = await fetchJson(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.2 }),
  })
  const meta = chatResponseMeta(data)
  return { reply: meta.text ?? "", model, durationMs: Date.now() - startedAt, usage: meta.usage }
}

// ------------------------------------------------------------------ //
//  Connection test                                                     //
// ------------------------------------------------------------------ //

export async function testProviderConnection(
  type: AiProviderType,
  baseUrl: string | null,
  apiKey: string | null,
  defaultModel: string | null
): Promise<{ ok: boolean; models: string[]; error?: string }> {
  try {
    let models = await fetchModelList(type, baseUrl, apiKey)
    if (models.length === 0 && defaultModel) {
      // Providers without a list API (e.g. Azure): fall back to a tiny chat to prove connectivity.
      const res = await providerChat(type, baseUrl, apiKey, defaultModel, [{ role: "user", content: "ping" }], 8)
      if (res.reply) models = [defaultModel]
    }
    return { ok: true, models }
  } catch (err) {
    return { ok: false, models: [], error: (err as Error).message }
  }
}