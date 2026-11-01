import { execFile } from "child_process"
import { promisify } from "util"
import fs from "fs/promises"
import path from "path"

const exec = promisify(execFile)

export interface RuleMatch {
  rule_id: string
  rule_name: string
  severity: "critical" | "high" | "medium" | "low"
  category: string
  message: string
  suggestion: string
  line_number?: number
  fix_template?: string
  language?: string
  file?: string
  code_snippet?: string
}

export interface Metrics {
  lines_of_code: number
  cyclomatic_complexity: number
  maintainability_index: number
}

export interface FileResult {
  file: string
  language: string
  metrics: Metrics
  rules: RuleMatch[]
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

const EXT_TO_LANG: Record<string, string> = {
  rs: "rust",
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  go: "go",
  java: "java",
  c: "c",
  cpp: "cpp",
  h: "c",
  cs: "csharp",
  php: "php",
  rb: "ruby",
  swift: "swift",
  kt: "kotlin",
}

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "target",
  "dist",
  "build",
  ".next",
  "out",
  "vendor",
  ".venv",
  "venv",
  "__pycache__",
])

function languageOf(ext: string): string | null {
  return EXT_TO_LANG[ext.toLowerCase()] ?? null
}

// ---------------------------------------------------------------------------
// Heuristics
// ---------------------------------------------------------------------------

function countKeywords(source: string, keywords: string[]) {
  const lower = source.toLowerCase()
  let count = 0
  for (const kw of keywords) {
    const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")
    const m = lower.match(re)
    if (m) count += m.length
  }
  return count
}

const COMPLEXITY_KEYWORDS = [
  "if", "else if", "for", "while", "switch", "case", "catch",
  "function", "def", "=>", "return", "&&", "||",
  "match", "guard", "when",
]

function linesOf(source: string) {
  return source.split(/\r?\n/).length
}

function maxLineLength(source: string) {
  let max = 0
  for (const line of source.split(/\r?\n/)) max = Math.max(max, line.length)
  return max
}

function countLongLines(source: string, threshold = 140) {
  return source.split(/\r?\n/).filter((l) => l.length > threshold).length
}

function countMagicNumbers(source: string) {
  // Numbers that aren't 0/1 and not part of identifiers or comments
  // Heuristic: literal numbers in conditions/assignments
  const re = /(?<![\w.])[2-9]\d*(?![\w.]e)/g
  return (source.match(re) || []).length
}

function detectStringConcatInLoop(source: string) {
  // look for `x = x +` or `+=` on strings inside a loop { ... } block
  const loopBlock = /(for|while)\s*\(?[^{]*\)?\s*\{([\s\S]*?)\}/g
  let m
  let found = false
  while ((m = loopBlock.exec(source)) !== null) {
    const body = m[2]
    if (/\+=\s*["'`]/.test(body) || /\w\s*=\s*\w\s*\+/.test(body)) {
      found = true
      break
    }
  }
  return found
}

function detectSqlInjection(source: string) {
  const lower = source.toLowerCase()
  const execPatterns = ["execute", "query", "session.query", "db.query", "exec", "run"]
  const sqlKeywords = ["select", "insert", "update", "delete", "from", "where", "drop", "union"]
  const hasSql = sqlKeywords.some((k) => lower.includes(k))
  const hasExec = execPatterns.some((k) => lower.includes(k))
  const hasConcat = lower.includes(" + ") || lower.includes('" + ') || lower.includes("' + ") || lower.includes("${") || lower.includes("f\"")
  return hasExec && hasSql && hasConcat
}

const SECRET_PATTERNS = [
  /\b(api[_-]?key|apikey)\b\s*[:=]\s*["'][A-Za-z0-9_\-]{8,}["']/i,
  /\b(secret|token|password|passwd|jwt)\b\s*[:=]\s*["'][^"']{6,}["']/i,
  /\b(aws_access_key_id|aws_secret_access_key|AKIA[0-9A-Z]{16})\b/i,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\b(sk|pk)-(live|test)-[A-Za-z0-9]{20,}\b/,
  /\bslack[-_]?(token|xox[baprs])[-_][A-Za-z0-9-]{20,}\b/i,
]

function findSecretLines(source: string): number[] {
  const lines = source.split(/\r?\n/)
  const hits: number[] = []
  lines.forEach((line, idx) => {
    if (SECRET_PATTERNS.some((re) => re.test(line))) hits.push(idx + 1)
  })
  return hits
}

function nestingDepth(source: string) {
  // Rough max brace-nesting across the file
  let depth = 0
  let max = 0
  for (const ch of source) {
    if (ch === "{" || ch === "(" || ch === "[") {
      depth++
      if (depth > max) max = depth
    } else if (ch === "}" || ch === ")" || ch === "]") {
      depth = Math.max(0, depth - 1)
    }
  }
  return max
}

// ---------------------------------------------------------------------------
// Core analyzer
// ---------------------------------------------------------------------------

export function analyzeSource(source: string, language = "rust", file?: string): FileResult {
  const loc = linesOf(source)
  const complexity = countKeywords(source, COMPLEXITY_KEYWORDS)
  const mi = Math.max(0, Math.min(100, 171.9 - 5.2 * complexity - 0.23 * loc))
  const metrics: Metrics = {
    lines_of_code: loc,
    cyclomatic_complexity: complexity,
    maintainability_index: Math.round(mi * 10) / 10,
  }

  const rules: RuleMatch[] = []
  const srcLines = source.split(/\r?\n/)

  const severity = (s: RuleMatch["severity"]): RuleMatch["severity"] => s
  const push = (rule: Omit<RuleMatch, "language"> & { line_number?: number }) => {
    rules.push({ language, ...rule, file })
  }

  // 1. high_complexity
  if (complexity > 10) {
    push({
      rule_id: "high_complexity",
      rule_name: "High Cyclomatic Complexity",
      severity: severity("high"),
      category: "complexity",
      message: `Cyclomatic complexity is ${complexity} (threshold: 10).`,
      suggestion: "Break the function into smaller, focused functions.",
      fix_template: "function_name() { ... } → extract sub-logic into helpers",
      line_number: 1,
    })
  }

  // 2. deep_nesting
  const nesting = nestingDepth(source)
  if (nesting > 5) {
    push({
      rule_id: "deep_nesting",
      rule_name: "Deep Nesting",
      severity: severity("medium"),
      category: "complexity",
      message: `Maximum nesting depth is ${nesting} (threshold: 5).`,
      suggestion: "Use guard clauses or early returns to flatten nesting.",
      line_number: 1,
    })
  }

  // 3. low_maintainability
  if (mi < 50) {
    push({
      rule_id: "low_maintainability",
      rule_name: "Low Maintainability Index",
      severity: severity("medium"),
      category: "maintainability",
      message: `Maintainability index is ${mi.toFixed(1)} (below 50).`,
      suggestion: "Refactor for clarity: split logic, name things well, add comments.",
    })
  }

  // 4. hardcoded_secrets
  const secretLines = findSecretLines(source)
  if (secretLines.length > 0) {
    const lineNum = secretLines[0]
    push({
      rule_id: "hardcoded_secrets",
      rule_name: "Hardcoded Secrets / API Keys",
      severity: severity("critical"),
      category: "security",
      message: "Potential hardcoded credentials detected in source.",
      suggestion:
        "Move secrets to environment variables or a secrets manager. Never commit them.",
      fix_template: "process.env.API_KEY access, not a string literal",
      line_number: lineNum,
      code_snippet: srcLines[lineNum - 1]?.trim()?.slice(0, 120),
    })
  }

  // 5. sql_injection
  if (detectSqlInjection(source)) {
    push({
      rule_id: "sql_injection",
      rule_name: "Potential SQL Injection",
      severity: severity("critical"),
      category: "security",
      message:
        "String concatenation detected in a SQL query/execution path.",
      suggestion: "Use parameterized queries / prepared statements.",
      fix_template: "query('SELECT * FROM t WHERE id = $1', [id])",
    })
  }

  // 6. long_line
  const longLines = countLongLines(source)
  if (longLines > 0) {
    push({
      rule_id: "long_line",
      rule_name: "Long Lines",
      severity: severity("low"),
      category: "style",
      message: `${longLines} line(s) exceed 140 characters.`,
      suggestion: "Wrap long lines for readability.",
    })
  }

  // 7. magic_number
  const magicNumbers = countMagicNumbers(source)
  if (magicNumbers > 8) {
    push({
      rule_id: "magic_number",
      rule_name: "Magic Numbers",
      severity: severity("low"),
      category: "style",
      message: `${magicNumbers} unexplained numeric literals found.`,
      suggestion: "Extract literals into named constants.",
      fix_template: "const MAX_RETRIES = 3;",
    })
  }

  // 8. string_concat_loop
  if (detectStringConcatInLoop(source)) {
    push({
      rule_id: "string_concat_loop",
      rule_name: "String Concatenation in Loop",
      severity: severity("medium"),
      category: "performance",
      message: "Strings concatenated inside a loop (potential O(n²)).",
      suggestion: "Use an array/collect then join, or a string builder.",
      fix_template: "parts.push(x); ...; parts.join('')",
    })
  }

  return { file: file ?? "(inline)", language, metrics, rules }
}

// ---------------------------------------------------------------------------
// Project walker
// ---------------------------------------------------------------------------

const MAX_FILES = 500

async function walk(dir: string, includeHidden: boolean): Promise<string[]> {
  const out: string[] = []
  const stack = [dir]

  while (stack.length > 0 && out.length < MAX_FILES) {
    const current = stack.pop()!
    let entries: import("fs").Dirent[]
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue
        if (!includeHidden && entry.name.startsWith(".")) continue
        stack.push(full)
      } else if (entry.isFile()) {
        if (!includeHidden && entry.name.startsWith(".")) continue
        const ext = path.extname(entry.name).slice(1)
        if (languageOf(ext)) out.push(full)
        if (out.length >= MAX_FILES) break
      }
    }
  }
  return out
}

export async function analyzeProject(
  dir: string,
  includeHidden = false
): Promise<{ files: FileResult[]; total_metrics: Metrics; issues_found: number }> {
  const files = await walk(dir, includeHidden)
  const results: FileResult[] = []

  let tl = 0
  let tc = 0
  let issues = 0

  for (const file of files) {
    let content: string
    try {
      content = await fs.readFile(file, "utf8")
    } catch {
      continue
    }
    if (content.length > 200_000) content = content.slice(0, 200_000)
    const ext = path.extname(file).slice(1)
    const lang = languageOf(ext) ?? "unknown"
    const rel = path.relative(dir, file)
    const res = analyzeSource(content, lang, rel)
    results.push(res)
    tl += res.metrics.lines_of_code
    tc += res.metrics.cyclomatic_complexity
    issues += res.rules.length
    if (issues > 10_000) break
  }

  return {
    files: results,
    total_metrics: {
      lines_of_code: tl,
      cyclomatic_complexity: tc,
      maintainability_index: results.length
        ? Math.max(
            0,
            Math.min(100, Math.round((171.9 - 5.2 * (tc / results.length) - 0.23 * (tl / results.length)) * 10) / 10)
          )
        : 100,
    },
    issues_found: issues,
  }
}

// ---------------------------------------------------------------------------
// Git integration
// ---------------------------------------------------------------------------

async function git(repo: string, args: string[]) {
  try {
    const { stdout } = await exec("git", ["-C", repo, ...args], { timeout: 15000 })
    return stdout.trim()
  } catch {
    return null
  }
}

export interface GitInfo {
  branch: string
  last_commit: string
  author: string
  date: string
  remote: string
  total_commits: number
  status: string
  tracked_files: number
}

export async function getGitInfo(repo: string): Promise<GitInfo> {
  const inRepo = await git(repo, ["rev-parse", "--is-inside-work-tree"])
  if (inRepo !== "true") throw new Error("Not a git repository")

  const branch = (await git(repo, ["branch", "--show-current"])) || "HEAD"
  const lastCommit = (await git(repo, ["log", "-1", "--pretty=%s"])) || "—"
  const author = (await git(repo, ["log", "-1", "--pretty=%an"])) || "—"
  const date = (await git(repo, ["log", "-1", "--pretty=%ad"])) || "—"
  const remote = (await git(repo, ["remote", "get-url", "origin"])) || "—"
  const totalCommits = Number((await git(repo, ["rev-list", "--count", "HEAD"])) || 0)
  const statusLines = (await git(repo, ["status", "--porcelain"])) || ""
  const tracked = (await git(repo, ["ls-files"])) || ""
  const trackedFiles = tracked ? tracked.split(/\r?\n/).filter((l) => l).length : 0

  return {
    branch,
    last_commit: lastCommit,
    author,
    date,
    remote,
    total_commits: totalCommits,
    status: statusLines ? "dirty" : "clean",
    tracked_files: trackedFiles,
  }
}

export async function analyzeGitRepo(
  repo: string,
  includeHidden = true
): Promise<{ repo: GitInfo; files: FileResult[]; total_metrics: Metrics; issues_found: number }> {
  const info = await getGitInfo(repo)
  const project = await analyzeProject(repo, includeHidden)
  return { repo: info, ...project }
}

export const SUPPORTED_EXTENSIONS = Object.keys(EXT_TO_LANG)