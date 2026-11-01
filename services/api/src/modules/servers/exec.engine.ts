import { execFile } from "child_process"
import { promisify } from "util"
import { readdir, readFile, stat } from "fs/promises"
import * as path from "path"
import {
  arch,
  cpus,
  freemem,
  homedir,
  hostname,
  platform,
  release,
  totalmem,
  type as osType,
  uptime,
  userInfo,
  tmpdir,
} from "os"

const execFileAsync = promisify(execFile)

export interface ExecResult {
  ok: boolean
  command: string
  output: string
  exitCode: number
  simulated: boolean
  error?: string
}

export interface ProvisionFile {
  path: string
  content: string
}

export interface ProvisionArtifact {
  template: string
  name: string
  files: ProvisionFile[]
  steps: string[]
  deployCommand: string
}

// ------------------------------------------------------------------ //
//  Command sandbox                                                    //
// ------------------------------------------------------------------ //

const MAX_CAT_BYTES = 64 * 1024
const BLOCKED_FILE_PATTERNS = [
  /(^|[/\\])\.env(?:\.[a-z0-9]+)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /(^|[/\\])\.gitconfig$/,
  /credential/i,
  /password/i,
  /secret/i,
  /token/i,
]
const SHELL_FORBIDDEN = /[;&|<>`$\\*?[\]{}(),!^'\s]/u

function stripQuotes(token: string): string {
  let t = token
  if (t.length >= 2 && t[0] === '"' && t[t.length - 1] === '"') t = t.slice(1, -1)
  else if (t.length >= 2 && t[0] === "'" && t[t.length - 1] === "'") t = t.slice(1, -1)
  return t
}

function tokenize(input: string): string[] {
  const tokens: string[] = []
  let cur = ""
  let quote: "'" | '"' | null = null
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quote) {
      if (ch === quote) quote = null
      else cur += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (/\s/.test(ch)) {
      if (cur) {
        tokens.push(cur)
        cur = ""
      }
    } else {
      cur += ch
    }
  }
  if (quote) throw new Error("Unclosed quote in command")
  if (cur) tokens.push(cur)
  return tokens
}

function allowedRoots(): string[] {
  return [...new Set([process.cwd(), tmpdir(), homedir()])]
}

function resolveRestricted(target: string): { ok: true; resolved: string } | { ok: false; reason: string } {
  const roots = allowedRoots()
  const resolved = path.isAbsolute(target) ? path.resolve(target) : path.resolve(process.cwd(), target)
  const inside = roots.some((root) => {
    const r = path.resolve(root)
    return resolved === r || resolved.startsWith(r + path.sep)
  })
  if (!inside) {
    return { ok: false, reason: `Path is outside the sandbox roots (${roots.join(", ")})` }
  }
  if (BLOCKED_FILE_PATTERNS.some((re) => re.test(resolved))) {
    return { ok: false, reason: "Reading this file is not allowed in the sandbox console" }
  }
  return { ok: true, resolved }
}

function fmtMemory(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

type Handler = (args: string[]) => ExecResult | Promise<ExecResult>

function out(lines: string[], simulated = true): ExecResult {
  return { ok: true, command: "", output: lines.join("\n"), exitCode: 0, simulated }
}

async function versionOf(binary: string, flag: string, label: string): Promise<ExecResult> {
  try {
    const { stdout } = await execFileAsync(binary, [flag], { timeout: 5000 })
    return { ok: true, command: "", output: `${label}${stdout.trim()}`, exitCode: 0, simulated: false }
  } catch {
    return out([`${label}not installed on the host`, "(simulated)"], true)
  }
}

async function curlHandler(args: string[]): Promise<ExecResult> {
  if (args.length !== 2) return out(["curl usage: curl -sI|-sIL|-s <https?://url>"], true)
  const flag = args[0]
  const url = args[1]
  if (!["-s", "-sI", "-sIL"].includes(flag)) {
    return out(["curl usage: curl -sI|-sIL|-s <https?://url>"], true)
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return out(["curl: invalid URL"], true)
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return out(["curl: only http:// and https:// URLs are allowed"], true)
  }
  const headOnly = flag === "-sI" || flag === "-sIL"
  const started = Date.now()
  try {
    const res = await fetch(url, {
      method: headOnly ? "HEAD" : "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    })
    const lines: string[] = []
    lines.push(`HTTP/1.1 ${res.status} ${res.statusText}`)
    if (res.status !== 200 && res.status !== 301 && res.status !== 302 && res.status !== 304) {
      lines.push("")
    }
    res.headers.forEach((value, key) => lines.push(`${key}: ${value}`))
    if (!headOnly && res.ok) {
      const text = await res.text()
      lines.push("", `Body: ${text.length} bytes`, text.slice(0, 100_000))
    }
    lines.push("", `url: ${url}`, `latency: ${Date.now() - started} ms`)
    return { ok: true, command: "", output: lines.join("\n"), exitCode: 0, simulated: false }
  } catch (e) {
    return {
      ok: false,
      command: "",
      output: `curl: unable to reach ${url}`,
      exitCode: 6,
      simulated: false,
      error: (e as Error).message.slice(0, 300),
    }
  }
}

const COMMANDS: Record<string, { check: (a: string[]) => string | null; run: Handler }> = {
  pwd: {
    check: (a) => (a.length ? "pwd takes no arguments" : null),
    run: () => out([process.cwd()]),
  },
  whoami: {
    check: (a) => (a.length ? "whoami takes no arguments" : null),
    run: () => {
      let name = "root"
      try {
        name = userInfo().username
      } catch {
        /* keep default */
      }
      return { ok: true, command: "", output: name, exitCode: 0, simulated: true }
    },
  },
  hostname: {
    check: (a) => (a.length ? "hostname takes no arguments" : null),
    run: () => ({ ok: true, command: "", output: hostname(), exitCode: 0, simulated: true }),
  },
  uname: {
    check: (a) => {
      for (const f of a) if (!["-a", "-s", "-r", "-m"].includes(f)) return `uname: invalid option ${f}`
      return null
    },
    run: (args) => {
      const flags = new Set(args)
      if (args.length === 0) flags.add("-s")
      if (flags.has("-a")) {
        flags.add("-s")
        flags.add("-r")
        flags.add("-m")
      }
      const parts: string[] = []
      if (flags.has("-s")) parts.push(osType())
      if (flags.has("-r")) parts.push(release())
      if (flags.has("-m")) parts.push(arch())
      return out([parts.join(" ") || osType()])
    },
  },
  uptime: {
    check: (a) => (a.length ? "uptime takes no arguments" : null),
    run: () => {
      const seconds = Math.floor(uptime())
      const h = Math.floor(seconds / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      return { ok: true, command: "", output: `up ${h} hours, ${m} minutes`, exitCode: 0, simulated: true }
    },
  },
  free: {
    check: (a) => {
      for (const f of a) if (!["-m", "-h"].includes(f)) return `free: invalid option ${f}`
      return null
    },
    run: (args) => {
      const human = args.includes("-h")
      const fb = (b: number) => (human ? fmtMemory(b) : String(Math.round(b / (1024 * 1024))))
      return out([
        "                 total        used        free      shared  buff/cache   available",
        `Mem:   ${[totalmem(), totalmem() - freemem(), freemem(), 0, 0, freemem()].map((v) => fb(v).padStart(9)).join("   ")}`,
        `Swap:  ${["0.0 GiB", "0.0 GiB", "0.0 GiB"].map((v) => v.padStart(9)).join("   ")}`,
        "(sandbox: figures reflect the local dev host)",
      ])
    },
  },
  df: {
    check: (a) => {
      for (const f of a) if (!["-h"].includes(f)) return `df: invalid option ${f}`
      return null
    },
    run: () =>
      out([
        "Filesystem      Size  Used Avail Use% Mounted on",
        `sandbox        ${fmtMemory(totalmem())}  ${fmtMemory(totalmem() - freemem())}  ${fmtMemory(freemem())}   0%  /sandbox`,
        "(sandbox: disk usage is simulated from host memory)",
      ]),
  },
  ver: {
    check: (a) => (a.length ? "ver takes no arguments" : null),
    run: () =>
      out([
        `${platform()} ${release()}`,
        `Node.js ${process.version}`,
        `vCPU: ${cpus().length}`,
      ]),
  },
  ls: {
    check: (a) => (a.length > 1 ? "ls takes at most one directory" : null),
    run: async (args) => {
      const target = args.length ? stripQuotes(args[0]) : process.cwd()
      const r = resolveRestricted(target)
      if (!r.ok) throw new Error(r.reason)
      const entries = await readdir(r.resolved, { withFileTypes: true })
      const lines = entries
        .slice(0, 500)
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .sort()
      return out(lines.length ? lines : ["(empty)"])
    },
  },
  cat: {
    check: (a) => (a.length === 1 ? null : "cat requires exactly one path argument"),
    run: async (args) => {
      const target = stripQuotes(args[0])
      const r = resolveRestricted(target)
      if (!r.ok) throw new Error(r.reason)
      const s = await stat(r.resolved)
      if (s.isDirectory()) throw new Error(`cat: ${target} is a directory`)
      const buf = await readFile(r.resolved)
      const text =
        buf.length > MAX_CAT_BYTES
          ? `${buf.slice(0, MAX_CAT_BYTES).toString("utf8")}\n… [truncated ${buf.length - MAX_CAT_BYTES} bytes]`
          : buf.toString("utf8")
      return out([text.length ? text : "(empty file)"])
    },
  },
  echo: {
    check: () => null,
    run: (args) => out([args.map(stripQuotes).join(" ")], false),
  },
  node: {
    check: (a) => (a.length === 1 && (a[0] === "--version" || a[0] === "-v") ? null : "node usage: node --version"),
    run: () => versionOf("node", "--version", "node v"),
  },
  npm: {
    check: (a) => (a.length === 1 && (a[0] === "--version" || a[0] === "-v") ? null : "npm usage: npm --version"),
    run: () => versionOf("npm", "--version", "npm "),
  },
  go: {
    check: (a) => (a.length === 1 && a[0] === "version" ? null : "go usage: go version"),
    run: () => versionOf("go", "version", ""),
  },
  curl: {
    check: (a) =>
      a.length === 2 && ["-s", "-sI", "-sIL"].includes(a[0]) && /^https?:\/\//i.test(a[1])
        ? null
        : "curl usage: curl -sI|-sIL|-s <https?://url>",
    run: (args) => curlHandler(args),
  },
}

function sanityCheckTokens(tokens: string[]): string | null {
  for (const token of tokens) {
    if (SHELL_FORBIDDEN.test(token)) {
      return `Command blocked: character not allowed in the sandboxed console ("${token}")`
    }
    if (token.length > 4096) return "Command argument too long"
  }
  return null
}

export async function runCommand(input: string): Promise<ExecResult> {
  const command = input.trim()
  if (!command) {
    return { ok: true, command, output: "", exitCode: 0, simulated: true }
  }
  let tokens: string[]
  try {
    tokens = tokenize(command)
  } catch (e) {
    return { ok: false, command, output: (e as Error).message, exitCode: 2, simulated: true }
  }
  const blocked = sanityCheckTokens(tokens)
  if (blocked) {
    return { ok: false, command, output: blocked, exitCode: 1, simulated: true, error: blocked }
  }
  const argv = tokens.slice(1)
  const cmd = tokens[0].toLowerCase()
  const entry = COMMANDS[cmd]
  if (!entry) {
    return {
      ok: false,
      command,
      output: `command not found: ${tokens[0]}\nAllowed commands: ${Object.keys(COMMANDS).join(", ")}`,
      exitCode: 127,
      simulated: true,
      error: "command not found",
    }
  }
  const validation = entry.check(argv)
  if (validation) {
    return { ok: false, command, output: validation, exitCode: 1, simulated: true, error: validation }
  }
  try {
    const result = await entry.run(argv)
    return { ...result, command }
  } catch (e) {
    return {
      ok: false,
      command,
      output: (e as Error).message,
      exitCode: 1,
      simulated: true,
      error: (e as Error).message,
    }
  }
}

// ------------------------------------------------------------------ //
//  IaC provisioning code generator                                    //
// ------------------------------------------------------------------ //

const TEMPLATES = ["docker", "nginx", "node", "portfolio"] as const
export type ProvisionTemplate = (typeof TEMPLATES)[number]

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app"
}

export function generateProvision(template: ProvisionTemplate, name: string): ProvisionArtifact {
  const app = slugify(name)
  const files: ProvisionFile[] = []

  if (template === "docker") {
    files.push(
      {
        path: "docker-compose.yml",
        content: `version: "3.9"\n\nservices:\n  ${app}:\n    build: .\n    ports:\n      - "8080:80"\n    restart: unless-stopped\n`,
      },
      {
        path: "Dockerfile",
        content: `FROM node:20-alpine\nWORKDIR /app\nCOPY package.json ./\nCOPY server.js ./\nRUN npm install --omit=dev\nCOPY . .\nEXPOSE 80\nCMD ["node", "server.js"]\n`,
      },
      {
        path: "package.json",
        content: `{\n  "name": "${app}",\n  "version": "1.0.0",\n  "main": "server.js"\n}\n`,
      },
      {
        path: "server.js",
        content: `const http = require("http");\nconst port = process.env.PORT || 80;\nhttp.createServer((req, res) => {\n  res.writeHead(200, { "Content-Type": "text/plain" });\n  res.end("Hello from ${app} (provisioned via IaC console)\\n");\n}).listen(port, () => console.log("${app} listening on :" + port));\n`,
      },
      {
        path: ".env.example",
        content: `APP_NAME=${app}\nPORT=80\nNODE_ENV=production\n`,
      }
    )
  } else if (template === "nginx") {
    files.push(
      {
        path: "nginx.conf",
        content: `server {\n    listen 80;\n    server_name ${app}.local;\n    root /var/www/${app};\n    index index.html;\n    gzip on;\n    location / {\n        try_files $uri $uri/ =404;\n    }\n}\n`,
      },
      {
        path: "www/index.html",
        content: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${app}</title><link rel="stylesheet" href="style.css"></head><body><h1>${app}</h1><p>Provisioned via the IaC console.</p></body></html>\n`,
      },
      {
        path: "www/style.css",
        content: `body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; background: #0f172a; color: #e2e8f0; }\n`,
      }
    )
  } else if (template === "node") {
    files.push(
      {
        path: "package.json",
        content: `{\n  "name": "${app}",\n  "version": "1.0.0",\n  "main": "server.js",\n  "scripts": { "start": "node server.js" }\n}\n`,
      },
      {
        path: "server.js",
        content: `const http = require("http");\nconst port = process.env.PORT || 80;\nhttp.createServer((req, res) => {\n  res.writeHead(200, { "Content-Type": "text/plain" });\n  res.end("Hello from ${app} (provisioned via IaC console)\\n");\n}).listen(port, () => console.log("${app} listening on :" + port));\n`,
      },
      {
        path: "docker-compose.yml",
        content: `version: "3.9"\n\nservices:\n  ${app}:\n    build: .\n    ports:\n      - "8080:80"\n    restart: unless-stopped\n`,
      },
      {
        path: "Dockerfile",
        content: `FROM node:20-alpine\nWORKDIR /app\nCOPY package.json ./\nCOPY server.js ./\nEXPOSE 80\nCMD ["node", "server.js"]\n`,
      }
    )
  } else {
    files.push(
      {
        path: "index.html",
        content: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${app}</title><link rel="stylesheet" href="style.css"></head><body><header class="nav"><span class="logo">${app}</span><nav><a href="#work">Work</a><a href="#about">About</a><a href="#contact">Contact</a></nav></header><section class="hero"><h1>Hello, I build for the web.</h1><p>${app} — a portfolio provisioned from the IaC console.</p></section><section id="about"><h2>About</h2><p>Placeholder content for the ${app} portfolio.</p></section><footer>© ${new Date().getFullYear()} ${app}</footer><script src="main.js"></script></body></html>\n`,
      },
      {
        path: "style.css",
        content: `* { margin: 0; box-sizing: border-box; } body { font-family: system-ui, sans-serif; color: #0f172a; background: #f8fafc; } .nav { display: flex; justify-content: space-between; padding: 1rem 2rem; background: #0f172a; color: #fff; } .logo { font-weight: 800; letter-spacing: 0.5px; } .nav a { color: #cbd5e1; margin-inline-start: 1rem; text-decoration: none; } .hero { padding: 5rem 2rem; text-align: center; } .hero h1 { font-size: 2.5rem; } .hero p { color: #475569; margin-top: 0.5rem; } #about { padding: 3rem 2rem; max-width: 48rem; margin-inline: auto; } footer { text-align: center; padding: 2rem; color: #64748b; }\n`,
      },
      {
        path: "main.js",
        content: `console.log("${app} portfolio booted");\n`,
      },
      {
        path: "nginx.conf",
        content: `server {\n    listen 80;\n    server_name ${app}.example.com;\n    root /var/www/${app};\n    index index.html;\n}\n`,
      },
      {
        path: "docker-compose.yml",
        content: `version: "3.9"\n\nservices:\n  ${app}:\n    image: nginx:alpine\n    ports:\n      - "8080:80"\n    volumes:\n      - ./index.html:/usr/share/nginx/html/index.html:ro\n      - ./style.css:/usr/share/nginx/html/style.css:ro\n      - ./main.js:/usr/share/nginx/html/main.js:ro\n`,
      }
    )
  }

  return {
    template,
    name: app,
    files,
    steps: [
      "Generate project files from template",
      "Write ${app} project files to the server",
      "Build the container image",
      "Start the service on port 8080",
    ],
    deployCommand: `docker compose up -d --build`,
  }
}