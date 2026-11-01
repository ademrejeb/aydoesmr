export type ClassValue = string | number | boolean | undefined | null | ClassValue[]

export function cn(...inputs: ClassValue[]): string {
  const flat: string[] = []
  for (const input of inputs) {
    if (!input) continue
    if (Array.isArray(input)) {
      const inner = cn(...input)
      if (inner) flat.push(inner)
    } else if (typeof input === "string") {
      flat.push(input)
    }
  }
  return flat.join(" ")
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
  ["second", 1],
]

export function timeAgo(input: string | number | Date, locale = "en"): string {
  const ts = typeof input === "number" ? input : new Date(input).getTime()
  if (!Number.isFinite(ts)) return ""
  const diff = (ts - Date.now()) / 1000
  const abs = Math.abs(diff)
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
    if (abs < 45) return rtf.format(0, "second")
    for (const [unit, seconds] of UNITS) {
      if (abs >= seconds || unit === "second") {
        return rtf.format(Math.round(diff / seconds), unit)
      }
    }
  } catch {
    /* fall through */
  }
  return new Date(ts).toLocaleString()
}

export function shortSha(sha: string | null | undefined, length = 7): string {
  return sha ? sha.slice(0, length) : ""
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}