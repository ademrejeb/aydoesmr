import { randomBytes, createHash } from "crypto"
import { spawn } from "child_process"
import { promises as fs } from "fs"
import { tmpdir } from "os"
import { join, resolve, dirname } from "path"

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function randomToken(): string {
  return randomBytes(30).toString("hex")
}

export function storageRoot(): string {
  return process.env.GIT_DATA_DIR || join(process.cwd(), "data", "git")
}

export function repoStoragePath(orgId: string, name: string): string {
  return join(storageRoot(), orgId, `${name}.git`)
}

/** Run `git` and return stdout as a buffer (no stdin). */
export function runGitGet(args: string[], timeoutMs = 45_000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
    const out: Buffer[] = []
    const err: Buffer[] = []
    child.stdout.on("data", (d) => out.push(d))
    child.stderr.on("data", (d) => err.push(d))
    child.on("error", reject)
    const timer = setTimeout(() => { child.kill(); reject(new Error(`git timeout (${args[0]})`)) }, timeoutMs)
    child.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(Buffer.concat(out))
      else reject(new Error(Buffer.concat(err).toString("utf8").trim() || `git exited ${code}`))
    })
  })
}

/** Run a stateless-rpc git command, feeding `input` to stdin, returning stdout. */
export function runGitPiped(args: string[], input: Buffer, timeoutMs = 600_000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] })
    const out: Buffer[] = []
    const err: Buffer[] = []
    child.stdout.on("data", (d) => out.push(d))
    child.stderr.on("data", (d) => err.push(d))
    child.on("error", reject)
    const timer = setTimeout(() => { child.kill(); reject(new Error(`git timeout (${args[0]})`)) }, timeoutMs)
    child.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(Buffer.concat(out))
      else reject(new Error(Buffer.concat(err).toString("utf8").trim() || `git exited ${code}`))
    })
    child.stdin.on("error", () => undefined)
    child.stdin.end(input)
  })
}

/** Initialise a bare repository on disk. */
export async function initBareRepo(dir: string, branch = "main"): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
  await runGitGet(["init", "--bare", `--initial-branch=${branch}`, dir])
}

function servicePacket(service: string): Buffer {
  const payload = `# service=${service}\n`
  const len = payload.length + 4
  return Buffer.concat([Buffer.from(len.toString(16).padStart(4, "0")), Buffer.from(payload)])
}

/** GET /info/refs advertisement for the Smart HTTP protocol. */
export async function advertiseRefs(dir: string, service: "git-upload-pack" | "git-receive-pack"): Promise<Buffer> {
  const cmd = service.replace(/^git-/, "")
  const out = await runGitGet([cmd, "--stateless-rpc", "--advertise-refs", dir])
  return Buffer.concat([servicePacket(service), Buffer.from("0000"), out])
}

export interface CommitInfo {
  sha: string
  author: string
  email: string
  date: string
  message: string
}

export async function listBranches(bareDir: string): Promise<string[]> {
  const out = await runGitGet(["-C", bareDir, "for-each-ref", "--format=%(refname:short)", "refs/heads"])
  return out.toString("utf8").split("\n").map((l) => l.trim()).filter(Boolean)
}

export async function listCommits(bareDir: string, n = 40): Promise<CommitInfo[]> {
  const out = await runGitGet(["-C", bareDir, "log", `-n ${n}`, "--pretty=format:%H%x1f%an%x1f%ae%x1f%aI%x1f%s"])
  return out
    .toString("utf8")
    .split("\n")
    .filter((l) => l.includes("\u001f"))
    .map((l) => {
      const [sha, author, email, date, message] = l.split("\u001f")
      return { sha, author, email, date, message }
    })
}

export async function headSha(bareDir: string): Promise<string | null> {
  try {
    const out = await runGitGet(["-C", bareDir, "rev-parse", "HEAD"])
    return out.toString("utf8").trim() || null
  } catch {
    return null
  }
}

/** Full recursive tree of the default branch: [{ type: "blob"|"tree", path }] */
export async function listTree(bareDir: string): Promise<{ type: string; path: string }[]> {
  const out = await runGitGet(["-C", bareDir, "ls-tree", "-r", "HEAD"])
  return out
    .toString("utf8")
    .split("\n")
    .map((l) => {
      const [meta, path] = l.split("\t")
      if (!path) return null
      const type = meta?.split(" ")?.slice(1, 2)?.[0]
      if (type !== "blob" && type !== "tree") return null
      return { type, path }
    })
    .filter((e): e is { type: string; path: string } => e !== null)
}

export async function treeSize(paths: { path: string }[]): Promise<{ files: number; dirs: number }> {
  const dirs = new Set<string>()
  for (const p of paths) {
    const parts = p.path.split("/")
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"))
  }
  return { files: paths.length, dirs: dirs.size }
}

export async function catBlob(bareDir: string, treePath: string): Promise<Buffer> {
  return runGitGet(["-C", bareDir, "show", `HEAD:${treePath}`])
}

export async function catBlobSize(bareDir: string, treePath: string): Promise<number> {
  const out = await runGitGet(["-C", bareDir, "cat-file", "-s", `HEAD:${treePath}`])
  return parseInt(out.toString("utf8").trim(), 10) || 0
}

export async function calculateRepoBytes(dir: string): Promise<number> {
  let total = 0
  async function walk(current: string) {
    let entries: import("fs").Dirent[]
    try { entries = await fs.readdir(current, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (e.name === ".git") continue
      if (e.isDirectory()) await walk(join(current, e.name))
      else if (e.isFile()) total += (await fs.stat(join(current, e.name))).size
    }
  }
  await walk(dir)
  return total
}

const README_NAMES = ["README.md", "README.txt", "README", "readme.md"]
export async function findReadme(bareDir: string): Promise<string | null> {
  const tree = await listTree(bareDir)
  for (const name of README_NAMES) {
    if (tree.some((e) => e.type === "blob" && e.path === name)) return name
  }
  const lower = tree.find((e) => e.type === "blob" && e.path.split("/").length === 1 && e.path.toLowerCase().startsWith("readme"))
  return lower ? lower.path : null
}

/** Commit a new file into a bare repository (HEAD branch), creating the branch if empty. */
export async function commitFileInBare(opts: {
  bareDir: string
  branch: string
  path: string
  content: string
  message: string
  authorName: string
  authorEmail: string
}): Promise<CommitInfo> {
  const { bareDir, branch, path, content, message, authorName, authorEmail } = opts
  if (!/^[0-9A-Za-z._\/-]+$/.test(path)) throw new Error("Invalid file path")
  const tmp = await fs.mkdtemp(join(tmpdir(), "tv-commit-"))
  try {
    const work = join(tmp, "work")
    // Clone the bare repo (empty clones are fine), then stage the change in the worktree.
    await runGitGet(["clone", bareDir, work])
    const safeRoot = resolve(work)
    const abs = resolve(join(work, path))
    if (!abs.startsWith(safeRoot)) throw new Error("Invalid file path")
    await fs.mkdir(dirname(abs), { recursive: true })
    await fs.writeFile(abs, content, "utf8")

    // Ensure the target branch is checked out (creates it on empty repos).
    await runGitGet(["-C", work, "checkout", "-B", branch]).catch(() => runGitGet(["-C", work, "checkout", "--orphan", branch]))
    await runGitGet(["-C", work, "add", "--", path])
    await runGitGet(["-C", work, "-c", `user.name=${authorName}`, "-c", `user.email=${authorEmail}`, "commit", "-m", message])
    await runGitGet(["-C", work, "push", bareDir, `HEAD:refs/heads/${branch}`])
    const commits = await listCommits(bareDir, 1)
    return commits[0] ?? { sha: "", author: authorName, email: authorEmail, date: new Date().toISOString(), message }
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined)
  }
}

/** Resolve a repo identifier from a git URL segment, tolerating a trailing `.git`. */
export function cleanRepoName(raw: string): string {
  return raw.replace(/\.git$/i, "").trim()
}

export const NAME_RE = /^[a-zA-Z0-9_.-]{1,100}$/
export interface CommitFilesInput {
  bareDir: string
  branch: string
  baseBranch?: string | null
  files: { path: string; content: string }[]
  message: string
  authorName: string
  authorEmail: string
}

/**
 * Commit a set of files into one new commit on `branch` (created from
 * `baseBranch` when supplied). Paths are validated before touching disk; the
 * caller is responsible for content policy (protected paths, size).
 */
export async function commitFilesInBare(input: CommitFilesInput): Promise<CommitInfo> {
  const { bareDir, branch, baseBranch, files, message, authorName, authorEmail } = input
  if (files.length === 0) throw new Error("No files to commit")
  for (const file of files) {
    if (!/^[0-9A-Za-z._\/-]+$/.test(file.path)) throw new Error(`Invalid file path: ${file.path}`)
  }
  const tmp = await fs.mkdtemp(join(tmpdir(), "tv-factory-"))
  try {
    const work = join(tmp, "work")
    await runGitGet(["clone", bareDir, work])
    if (baseBranch) await runGitGet(["-C", work, "checkout", baseBranch])
    await runGitGet(["-C", work, "checkout", "-B", branch]).catch(() =>
      runGitGet(["-C", work, "checkout", "--orphan", branch])
    )
    const safeRoot = resolve(work)
    for (const file of files) {
      const abs = resolve(join(work, file.path))
      if (abs !== safeRoot && !abs.startsWith(safeRoot + (process.platform === "win32" ? "\\" : "/"))) {
        throw new Error(`Invalid file path: ${file.path}`)
      }
      await fs.mkdir(dirname(abs), { recursive: true })
      await fs.writeFile(abs, file.content, "utf8")
    }
    await runGitGet(["-C", work, "add", "--", ...files.map((file) => file.path)])
    await runGitGet([
      "-C",
      work,
      "-c",
      `user.name=${authorName}`,
      "-c",
      `user.email=${authorEmail}`,
      "commit",
      "-m",
      message,
    ])
    await runGitGet(["-C", work, "push", bareDir, `HEAD:refs/heads/${branch}`])
    const commits = await listCommits(bareDir, 1)
    return commits[0] ?? { sha: "", author: authorName, email: authorEmail, date: new Date().toISOString(), message }
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined)
  }
}

/** Fast-forward `target` to `source`; refuses if the move is not a fast-forward. */
export async function mergeFastForward(bareDir: string, source: string, target: string): Promise<string> {
  const sourceSha = (await runGitGet(["-C", bareDir, "rev-parse", `refs/heads/${source}`])).toString("utf8").trim()
  if (!sourceSha) throw new Error("Source branch has no commits")
  try {
    await runGitGet(["-C", bareDir, "merge-base", "--is-ancestor", `refs/heads/${target}`, sourceSha])
  } catch {
    throw new Error("Merge is not a fast-forward; rebase the factory branch before merging")
  }
  await runGitGet(["-C", bareDir, "update-ref", `refs/heads/${target}`, sourceSha])
  return sourceSha
}

export interface DiffEntry {
  path: string
  status: string
  additions: number
  deletions: number
}

/** Real numstat/name-status between two refs in a hosted bare repository. */
export async function diffBetween(bareDir: string, base: string, head: string): Promise<{
  entries: DiffEntry[]
  additions: number
  deletions: number
}> {
  const range = `${base}..${head}`
  const numstat = (await runGitGet(["-C", bareDir, "diff", "--numstat", range])).toString("utf8")
  const names = (await runGitGet(["-C", bareDir, "diff", "--name-status", range])).toString("utf8")
  const nameByPath = new Map<string, string>()
  for (const line of names.split("\n")) {
    const [status, ...rest] = line.split("\t")
    const path = rest.join("\t").trim()
    if (path && status) nameByPath.set(path, status.slice(0, 1))
  }
  let additions = 0
  let deletions = 0
  const entries: DiffEntry[] = []
  for (const line of numstat.split("\n")) {
    const [add, del, path] = line.split("\t")
    if (!path) continue
    const addNum = Number(add)
    const delNum = Number(del)
    const safeAdd = Number.isFinite(addNum) ? addNum : 0
    const safeDel = Number.isFinite(delNum) ? delNum : 0
    additions += safeAdd
    deletions += safeDel
    entries.push({
      path: path.trim(),
      status: nameByPath.get(path.trim()) ?? "M",
      additions: safeAdd,
      deletions: safeDel,
    })
  }
  return { entries, additions, deletions }
}

/** Read a blob at a ref without checkout; returns null when the path is absent. */
export async function showBlob(bareDir: string, rev: string, treePath: string): Promise<string | null> {
  if (!/^[0-9A-Za-z._\/-]+$/.test(treePath)) return null
  try {
    const out = await runGitGet(["-C", bareDir, "show", `${rev}:${treePath}`])
    return out.toString("utf8")
  } catch {
    return null
  }
}
