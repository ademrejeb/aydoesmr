/**
 * Predefined AI actions: build contexts, prompts and expected JSON outputs.
 * Each action is a self-contained task the AI performs against a configured provider,
 * producing structured output that the platform can preview and apply.
 */

export type AiActionKind = "optimize_dockerfile" | "optimize_pipeline" | "fix_scan_issues" | "explain_code"

export type AiActionMessage = { role: "system" | "user" | "assistant"; content: string }

export const AI_ACTION_KEYS = [
  "optimize_dockerfile",
  "optimize_pipeline",
  "fix_scan_issues",
  "explain_code",
] as const

export interface AiActionDef {
  key: AiActionKind
  description: string
}

export const AI_ACTION_CATALOG: AiActionDef[] = [
  {
    key: "optimize_dockerfile",
    description:
      "Reads a repository Dockerfile (or pasted content) and produces a full optimized version with notes.",
  },
  {
    key: "optimize_pipeline",
    description:
      "Improves the pipeline step list — caching, parallelism and CI/CD best practices — as a previewable diff.",
  },
  {
    key: "fix_scan_issues",
    description:
      "Takes selected code-scan issues and proposes a targeted fix suggestion for each one.",
  },
  {
    key: "explain_code",
    description:
      "Reviews pasted code and returns structured feedback: overview, strengths, concerns and improvements.",
  },
]

const JSON_ONLY =
  "Reply with JSON only, no markdown fences, and no commentary outside the JSON object."

function extractJson(reply: string): Record<string, unknown> {
  const cleaned = reply
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response was not JSON")
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
}

// ------------------------------------------------------------------ //
//  Prompt builders                                                     //
// ------------------------------------------------------------------ //

export function dockerfileSystemPrompt(): string {
  return (
    `${JSON_ONLY} Respond with the shape ` +
    `{"dockerfile":"<the ENTIRE optimized Dockerfile as one string>","notes":[{"title":"...","detail":"..."}]}.`
  )
}

export function dockerfileUserPrompt(source: string, displayPath: string): string {
  return `Optimize this Dockerfile (${displayPath}) for build cache reuse, smaller layers and security. Keep it correct and production-ready.\n\n\`\`\`dockerfile\n${source}\n\`\`\``
}

export function pipelineSystemPrompt(): string {
  return (
    `${JSON_ONLY} Respond with the shape ` +
    `{"steps":[{"name":"...","command":"..."}],"notes":[{"title":"...","detail":"..."}]}. ` +
    `"steps" must be the COMPLETE improved step list; commands are single-line shell commands.`
  )
}

export function pipelineUserPrompt(name: string, steps: { name: string; command: string }[]): string {
  const rendered = steps.map((s, i) => `${i + 1}. ${s.name}: ${s.command}`).join("\n")
  return `Optimize this "${name}" pipeline definition: keep the same overall flow but improve caching, parallelization and CI/CD best practices.\n\n${rendered}`
}

export function scanSystemPrompt(): string {
  return (
    `${JSON_ONLY} Respond with the shape ` +
    `{"fixes":[{"issueId":"...","suggestion":"concise actionable fix","code":"optional corrected snippet","reason":"why"}]}. ` +
    `Provide one entry per issue, matching issueId exactly.`
  )
}

export function scanUserPrompt(issues: { id: string; filePath: string; lineNumber: number | null; severity: string; message: string; category: string | null; ruleId: string | null }[]): string {
  const rendered = issues
    .map(
      (i) =>
        `- [${i.severity}] ${i.filePath}${i.lineNumber ? `:${i.lineNumber}` : ""} (${i.category ?? "general"}/${i.ruleId ?? "rule"}) — ${i.message}`
    )
    .join("\n")
  return `Propose a concrete fix for each of these code-scan issues.\n\n${rendered}`
}

export function explainSystemPrompt(): string {
  return (
    `${JSON_ONLY} Respond with the shape ` +
    `{"overview":"1-2 sentence summary","strengths":["..."],"concerns":["..."],"improvements":[{"title":"...","detail":"..."}]}.`
  )
}

export function explainUserPrompt(source: string, language: string | null): string {
  return `Review this ${language ?? "code"} for bugs, maintainability and performance.\n\n\`\`\`${language ?? ""}\n${source}\n\`\`\``
}

// ------------------------------------------------------------------ //
//  Shared helpers                                                     //
// ------------------------------------------------------------------ //

export function parseAiOutput(reply: string): Record<string, unknown> {
  try {
    return extractJson(reply)
  } catch {
    return { raw: reply }
  }
}