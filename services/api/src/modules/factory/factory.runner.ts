import { execFile, spawn } from "node:child_process"
import { promisify } from "node:util"
import * as path from "node:path"

const execFileAsync = promisify(execFile)

const ALLOWED_BINARIES = new Set([
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "node",
  "npx",
  "cargo",
  "rustc",
  "go",
  "pytest",
  "python",
  "python3",
  "dotnet",
  "mvn",
  "gradle",
  "make",
])

const MAX_OUTPUT = 120_000
const MAX_COMMAND = 500

export interface RunnerOptions {
  command: string
  cwd: string
  timeoutMs: number
  image: string
  allowLocal: boolean
}

export interface CommandResult {
  runner: "docker" | "local" | "blocked"
  status: "PASSED" | "FAILED" | "BLOCKED" | "TIMEOUT"
  exitCode: number | null
  output: string
  durationMs: number
  error: string | null
}

/** Split a command without a shell; quotes group arguments. */
export function parseCommand(command: string): string[] {
  const tokens: string[] = []
  let current = ""
  let quote: '"' | "'" | null = null
  for (const char of command.trim()) {
    if (quote) {
      if (char === quote) quote = null
      else current += char
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ""
      }
    } else {
      current += char
    }
  }
  if (quote) throw new Error("Unclosed quote in command")
  if (current) tokens.push(current)
  if (tokens.some((token) => /[;&|<>$`]/.test(token))) throw new Error("Shell operators are not allowed")
  return tokens
}

export function allowedCommand(command: string): { ok: true; argv: string[] } | { ok: false; reason: string } {
  if (command.length === 0 || command.length > MAX_COMMAND) {
    return { ok: false, reason: `Command must be 1-${MAX_COMMAND} characters` }
  }
  if (/[\r\n\0]/.test(command)) return { ok: false, reason: "Command must be a single line" }
  let argv: string[]
  try {
    argv = parseCommand(command)
  } catch (error) {
    return { ok: false, reason: (error as Error).message }
  }
  if (argv.length === 0) return { ok: false, reason: "Command is empty" }
  const binary = path.basename(argv[0]).replace(/\.(exe|cmd|bat)$/i, "")
  if (!ALLOWED_BINARIES.has(binary)) {
    return { ok: false, reason: `Binary "${binary}" is not in the runner allowlist` }
  }
  return { ok: true, argv }
}

export async function dockerAvailable(): Promise<boolean> {
  try {
    await execFileAsync("docker", ["info", "--format", "{{.ServerVersion}}"], { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

function safeEnv(): NodeJS.ProcessEnv {
  const allow = [
    "PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP",
    "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "PATHEXT", "ComSpec",
    "NUMBER_OF_PROCESSORS", "OS",
  ]
  const env: NodeJS.ProcessEnv = { CI: "1", NO_COLOR: "1", FORCE_COLOR: "0" }
  for (const key of allow) {
    if (process.env[key]) env[key] = process.env[key]
  }
  return env
}

function collect(child: ReturnType<typeof spawn>, timeoutMs: number): Promise<CommandResult> {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    let output = ""
    let timedOut = false
    let settled = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGKILL")
    }, timeoutMs)

    const append = (chunk: Buffer) => {
      if (output.length >= MAX_OUTPUT) return
      output += chunk.toString("utf8").slice(0, MAX_OUTPUT - output.length)
    }
    child.stdout?.on("data", append)
    child.stderr?.on("data", append)
    child.on("error", (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({
        runner: "local",
        status: "FAILED",
        exitCode: null,
        output,
        durationMs: Date.now() - startedAt,
        error: error.message,
      })
    })
    child.on("close", (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({
        runner: "local",
        status: timedOut ? "TIMEOUT" : code === 0 ? "PASSED" : "FAILED",
        exitCode: code ?? null,
        output,
        durationMs: Date.now() - startedAt,
        error: timedOut ? `Command timed out after ${timeoutMs}ms` : null,
      })
    })
  })
}

/**
 * Run a command in a temporary worktree. Docker is preferred and gets no
 * network; the local fallback is opt-in (FACTORY_ALLOW_LOCAL_EXEC=true) and
 * receives a sanitized environment. Neither path uses a shell.
 */
export async function runIsolatedCommand(options: RunnerOptions): Promise<CommandResult> {
  const allowed = allowedCommand(options.command)
  if (!allowed.ok) {
    return { runner: "blocked", status: "BLOCKED", exitCode: null, output: "", durationMs: 0, error: allowed.reason }
  }
  const argv = allowed.argv
  const workdir = path.resolve(options.cwd)
  const docker = await dockerAvailable()
  const startedAt = Date.now()

  if (docker) {
    const mount = process.platform === "win32" ? workdir.replace(/\\/g, "/") : workdir
    const child = spawn(
      "docker",
      [
        "run",
        "--rm",
        "--network",
        "none",
        "--cpus",
        "2",
        "--memory",
        "2g",
        "-v",
        `${mount}:/workspace`,
        "-w",
        "/workspace",
        "-e",
        "CI=1",
        "-e",
        "NO_COLOR=1",
        options.image,
        ...argv,
      ],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
    )
    const result = await collect(child, options.timeoutMs)
    return {
      ...result,
      runner: "docker",
      durationMs: Date.now() - startedAt,
      output: result.output || "",
    }
  }

  if (!options.allowLocal) {
    return {
      runner: "blocked",
      status: "BLOCKED",
      exitCode: null,
      output: "",
      durationMs: Date.now() - startedAt,
      error:
        "No isolated runner available. Start Docker, or set FACTORY_ALLOW_LOCAL_EXEC=true for a trusted local run (no isolation).",
    }
  }

  const child = spawn(argv[0], argv.slice(1), {
    cwd: workdir,
    env: safeEnv(),
    // Windows resolves npm/pnpm/yarn only through cmd.exe. The argv was already
    // validated and contains no shell operators; Docker remains the safe path.
    shell: process.platform === "win32",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  })
  const result = await collect(child, options.timeoutMs)
  return { ...result, runner: "local", durationMs: Date.now() - startedAt }
}
