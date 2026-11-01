import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { execFile } from "child_process"
import { promisify } from "util"
import { analyzeSource, analyzeProject, analyzeGitRepo, getGitInfo } from "@/lib/analyzer"

const exec = promisify(execFile)

interface AnalyzeRequest {
  source?: string
  language?: string
  project_path?: string
  include_hidden?: boolean
  git_path?: string
  git_url?: string
}

async function cloneRemote(url: string): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "techdebt-git-"))
  try {
    await exec("git", ["clone", "--depth", "1", url, tmp], { timeout: 120000 })
    return tmp
  } catch (e: any) {
    await fs.rm(tmp, { recursive: true, force: true })
    throw new Error(`Failed to clone repository: ${e.stderr?.trim() || e.message}`)
  }
}

async function resolvePath(p: string): Promise<string> {
  const resolved = path.resolve(p)
  const stat = await fs.stat(resolved).catch(() => null)
  if (!stat || !stat.isDirectory()) throw new Error("Path does not exist or is not a directory")
  return resolved
}

export async function POST(request: NextRequest) {
  let body: AnalyzeRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    // 1) Git remote URL
    if (body.git_url) {
      const tmp = await cloneRemote(body.git_url)
      const result = await analyzeGitRepo(tmp, body.include_hidden ?? true)
      await fs.rm(tmp, { recursive: true, force: true })
      return NextResponse.json({ success: true, scan_type: "git", ...result })
    }

    // 2) Git local path
    if (body.git_path) {
      const resolved = await resolvePath(body.git_path)
      const result = await analyzeGitRepo(resolved, body.include_hidden ?? true)
      return NextResponse.json({ success: true, scan_type: "git", ...result })
    }

    // 3) Project directory scan
    if (body.project_path) {
      const resolved = await resolvePath(body.project_path)
      const result = await analyzeProject(resolved, body.include_hidden ?? false)
      return NextResponse.json({
        success: true,
        scan_type: "project",
        files_analyzed: result.files.length,
        ...result,
      })
    }

    // 4) Inline code analysis
    if (body.source && body.source.trim()) {
      const result = analyzeSource(body.source, body.language ?? "rust")
      return NextResponse.json({
        success: true,
        scan_type: "inline",
        files_analyzed: 1,
        metrics: result.metrics,
        issues_found: result.rules.length,
        rules: result.rules,
      })
    }

    return NextResponse.json({ error: "Nothing to analyze" }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Analysis failed" },
      { status: 400 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "techdebt-ai-analyzer",
    version: "0.1.0",
  })
}