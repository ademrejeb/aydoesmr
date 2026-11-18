"use client"

import { FileCode2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface DiffLine {
  kind: "add" | "del" | "context" | "hunk" | "meta"
  oldNo?: number
  newNo?: number
  text: string
}

interface ParsedFile {
  path: string
  oldPath: string
  status: string
  additions: number
  deletions: number
  lines: DiffLine[]
}

function parsePatch(patch: string): ParsedFile[] {
  const files: ParsedFile[] = []
  let file: ParsedFile | null = null
  let oldNo = 0
  let newNo = 0
  let inHunk = false

  for (const raw of patch.split("\n")) {
    if (raw.startsWith("diff --git ")) {
      if (file) files.push(file)
      const match = raw.match(/^diff --git a\/(.*) b\/(.*)$/)
      file = {
        path: match?.[2] ?? "",
        oldPath: match?.[1] ?? "",
        status: "M",
        additions: 0,
        deletions: 0,
        lines: [],
      }
      inHunk = false
      continue
    }
    if (!file) continue

    if (raw.startsWith("new file mode")) {
      file.status = "A"
      continue
    }
    if (raw.startsWith("deleted file mode")) {
      file.status = "D"
      continue
    }
    if (raw.startsWith("rename from ")) {
      file.oldPath = raw.slice("rename from ".length)
      file.status = "R"
      continue
    }
    if (raw.startsWith("rename to ")) {
      file.path = raw.slice("rename to ".length)
      continue
    }
    if (raw.startsWith("--- ")) {
      const path = raw.slice(4)
      if (path !== "/dev/null") file.oldPath = path.replace(/^a\//, "")
      continue
    }
    if (raw.startsWith("+++ ")) {
      const path = raw.slice(4)
      if (path !== "/dev/null") file.path = path.replace(/^b\//, "")
      continue
    }
    if (raw.startsWith("@@")) {
      const match = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      oldNo = match ? Number(match[1]) : 0
      newNo = match ? Number(match[2]) : 0
      file.lines.push({ kind: "hunk", text: raw })
      inHunk = true
      continue
    }
    if (!inHunk) continue
    if (raw.startsWith("+")) {
      file.additions += 1
      file.lines.push({ kind: "add", newNo: newNo++, text: raw.slice(1) })
      continue
    }
    if (raw.startsWith("-")) {
      file.deletions += 1
      file.lines.push({ kind: "del", oldNo: oldNo++, text: raw.slice(1) })
      continue
    }
    if (raw.startsWith(" ")) {
      file.lines.push({ kind: "context", oldNo: oldNo++, newNo: newNo++, text: raw.slice(1) })
      continue
    }
    if (raw.startsWith("\\")) {
      file.lines.push({ kind: "meta", text: raw })
      continue
    }
    if (raw === "") {
      file.lines.push({ kind: "context", oldNo: oldNo++, newNo: newNo++, text: "" })
    }
  }
  if (file) files.push(file)
  return files
}

function statusLabel(status: string): string {
  return ({ A: "added", M: "modified", D: "deleted", R: "renamed" } as Record<string, string>)[status] ?? status
}

/**
 * Unified-diff renderer: per-file cards, old/new line numbers, hunk headers and
 * colour-coded added/removed lines. Shared by commits and pull requests.
 */
export function DiffView({
  patch,
  emptyLabel = "No textual diff available.",
  maxHeight = "34rem",
}: {
  patch: string
  emptyLabel?: string
  maxHeight?: string
}) {
  const files = parsePatch(patch)
  if (files.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="space-y-4" dir="ltr">
      {files.map((file) => (
        <details key={`${file.oldPath}-${file.path}`} open className="overflow-hidden rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
            <FileCode2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold">
              {file.status === "R" ? `${file.oldPath} → ${file.path}` : file.path}
            </span>
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase text-secondary-foreground">
              {statusLabel(file.status)}
            </span>
            <span className="text-[11px] font-bold text-success">+{file.additions}</span>
            <span className="text-[11px] font-bold text-danger">−{file.deletions}</span>
          </summary>
          {file.lines.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">Binary file or no textual changes.</p>
          ) : (
            <div className="overflow-auto" style={{ maxHeight }}>
              <table className="w-full border-collapse font-mono text-[11px] leading-5">
                <tbody>
                  {file.lines.map((line, index) => {
                    if (line.kind === "hunk") {
                      return (
                        <tr key={index} className="bg-primary/10 text-primary">
                          <td colSpan={3} className="whitespace-pre px-3 py-1 font-semibold">
                            {line.text}
                          </td>
                        </tr>
                      )
                    }
                    if (line.kind === "meta") {
                      return (
                        <tr key={index} className="text-muted-foreground">
                          <td colSpan={3} className="whitespace-pre px-3 py-0.5 italic">
                            {line.text}
                          </td>
                        </tr>
                      )
                    }
                    return (
                      <tr
                        key={index}
                        className={cn(
                          line.kind === "add" && "bg-success/10",
                          line.kind === "del" && "bg-danger/10"
                        )}
                      >
                        <td className="w-10 select-none border-e border-border/50 px-2 py-0.5 text-end text-[10px] text-muted-foreground">
                          {line.oldNo ?? ""}
                        </td>
                        <td className="w-10 select-none border-e border-border/50 px-2 py-0.5 text-end text-[10px] text-muted-foreground">
                          {line.newNo ?? ""}
                        </td>
                        <td
                          className={cn(
                            "whitespace-pre px-3 py-0.5",
                            line.kind === "add" && "text-success",
                            line.kind === "del" && "text-danger"
                          )}
                        >
                          <span className="select-none text-muted-foreground">
                            {line.kind === "add" ? "+" : line.kind === "del" ? "−" : " "}
                          </span>
                          {line.text || " "}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </details>
      ))}
    </div>
  )
}
