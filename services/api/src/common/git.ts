import { execFile } from "child_process"
import { promises as fs } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

export type Provider = "github" | "gitlab" | "bitbucket" | "azure" | "other"

const EXT_LANGUAGE: Record<string, string> = {
  ".ts": "typescript", ".tsx": "typescript", ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
  ".rs": "rust", ".py": "python", ".go": "go", ".java": "java", ".kt": "kotlin", ".c": "c", ".h": "c", ".cpp": "cpp", ".hpp": "cpp",
  ".cs": "csharp", ".rb": "ruby", ".php": "php", ".swift": "swift", ".sh": "shell", ".sql": "sql", ".html": "html", ".css": "css",
  ".json": "json", ".yml": "yaml", ".yaml": "yaml", ".md": "markdown", ".vue": "vue", ".svelte": "svelte", ".ex": "elixir",
}

const SKIP_DIRS = new Set(["node_modules", ".git", "vendor", "dist", "build", ".next", ".nuxt", "target", "out", "coverage", ".cache", ".venv", "venv", "__pycache__", ".gradle", ".idea", ".vscode"])
const SKIP_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".pdf", ".zip", ".gz", ".tar", ".jar", ".class", ".exe", ".dll", ".so", ".dylib", ".woff", ".woff2", ".ttf", ".lock"])

export function providerFromUrl(url: string): Provider {
  const u = url.toLowerCase()
  if (u.includes("github.com")) return "github"
  if (u.includes("gitlab.com") || u.includes("gitlab.")) return "gitlab"
  if (u.includes("bitbucket.org")) return "bitbucket"
  if (u.includes("visualstudio.com") || u.includes("dev.azure.com")) return "azure"
  return "other"
}

export function repoNameFromUrl(url: string): string {
  const clean = url.trim().replace(/\.git$/, "").replace(/\/$/, "")
  const parts = clean.split("/")
  return parts[parts.length - 1] || "repository"
}

function withCredentials(url: string, token?: string | null): string {
  if (!token) return url
  if (url.startsWith("https://") || url.startsWith("http://")) {
    try {
      const u = new URL(url)
      u.username = token
      return u.toString()
    } catch {
      return url
    }
  }
  return url
}

async function runGit(args: string[], timeoutMs = 60_000): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024, windowsHide: true })
  return stdout
}

/** List remote branch names (refs/heads/*) without cloning. */
export async function listRemoteBranches(url: string, token?: string | null): Promise<string[]> {
  const out = await runGit(["ls-remote", "--heads", withCredentials(url, token)])
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.includes("\trefs/heads/"))
    .map((l) => l.split("\t")[1].replace("refs/heads/", ""))
    .sort()
}

export function cacheDirFor(repoId: string): string {
  return join(tmpdir(), "techverse-git", repoId)
}

export async function ensureClone(url: string, dir: string, branch: string, token?: string | null): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
  const gitDir = join(dir, ".git")
  const hasGit = await fs.access(gitDir).then(() => true).catch(() => false)
  const credentialed = withCredentials(url, token)
  if (!hasGit) {
    try {
      await runGit(["clone", "--depth", "1", "--single-branch", "--branch", branch, credentialed, dir], 120_000)
    } catch {
      // Branch may not exist yet — fall back to cloning default.
      await runGit(["clone", "--depth", "1", credentialed, dir], 120_000)
    }
    return
  }
  // Refresh existing clone and hard-reset to the target branch head.
  await runGit(["-C", dir, "fetch", "--depth", "1", "--force", credentialed, `${branch}:refs/remotes/origin/${branch}`], 120_000)
  await runGit(["-C", dir, "checkout", "-B", branch, `origin/${branch}`], 60_000)
  await runGit(["-C", dir, "reset", "--hard", `origin/${branch}`], 60_000)
}

export async function headSha(dir: string): Promise<string> {
  return (await runGit(["-C", dir, "rev-parse", "HEAD"])).trim()
}

export async function listCommits(dir: string, n = 25): Promise<{ sha: string; author: string; email: string; date: string; message: string }[]> {
  const out = await runGit(["-C", dir, "log", `-n ${n}`, "--pretty=format:%H%x1f%an%x1f%ae%x1f%aI%x1f%s"])
  return out
    .split("\n")
    .filter((l) => l.includes("\u001f"))
    .map((l) => {
      const [sha, author, email, date, message] = l.split("\u001f")
      return { sha, author, email, date, message }
    })
}

export async function detectLanguageOfRepo(dir: string): Promise<string | null> {
  const counts = new Map<string, number>()
  const files = await listSourceFiles(dir)
  for (const f of files) {
    const lang = EXT_LANGUAGE[(f.ext).toLowerCase()]
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1)
  }
  let best: string | null = null
  let max = 0
  for (const [lang, c] of counts) {
    if (c > max) {
      max = c
      best = lang
    }
  }
  return best
}

export async function listSourceFiles(
  dir: string,
  opts: { maxFiles?: number; maxBytes?: number } = {}
): Promise<{ path: string; rel: string; ext: string; size: number }[]> {
  const { maxFiles = 2000, maxBytes = 1_000_000 } = opts
  const out: { path: string; rel: string; ext: string; size: number }[] = []

  async function walk(current: string, rel: string) {
    if (out.length >= maxFiles) return
    let entries: import("fs").Dirent[]
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (out.length >= maxFiles) return
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        await walk(join(current, entry.name), rel ? `${rel}/${entry.name}` : entry.name)
      } else if (entry.isFile()) {
        const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase()
        if (SKIP_EXTS.has(ext)) continue
        const size = (await fs.stat(join(current, entry.name))).size
        if (size > maxBytes) continue
        out.push({ path: join(current, entry.name), rel: rel ? `${rel}/${entry.name}` : entry.name, ext, size })
      }
    }
  }

  await walk(dir, "")
  return out
}

export const DETECT_LANGUAGE = EXT_LANGUAGE