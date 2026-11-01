import Holidays from "date-holidays"

export interface HolidayRegion {
  code: string
  name: string
}

export interface HolidaySource {
  code: string
  name: string
  regions: HolidayRegion[]
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000
let cache: { at: number; value: HolidaySource[] } | null = null

function listRegions(code: string): HolidayRegion[] {
  try {
    const hd = new Holidays(code)
    const raw = (hd as unknown as { getRegions?: (l?: string) => Record<string, string> | false }).getRegions?.("en")
    if (raw && typeof raw === "object") {
      return Object.entries(raw).map(([regionCode, name]) => ({ code: regionCode, name }))
    }
    const states = (hd as unknown as { getStates?: (l?: string) => Record<string, string> | false }).getStates?.("en")
    if (states && typeof states === "object") {
      return Object.entries(states).map(([regionCode, name]) => ({ code: regionCode, name }))
    }
  } catch {
    /* unsupported — no regions */
  }
  return []
}

export function holidaySources(lang = "en"): HolidaySource[] {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.value
  }
  const outputs: HolidaySource[] = []
  try {
    const hd = new Holidays()
    const countries = (hd as unknown as { getCountries?: (l?: string) => Record<string, string> }).getCountries?.(lang)
    if (countries && typeof countries === "object") {
      for (const [code, name] of Object.entries(countries)) {
        outputs.push({ code, name, regions: listRegions(code) })
      }
    }
  } catch {
    /* fall back to an empty catalog */
  }
  outputs.sort((a, b) => a.name.localeCompare(b.name))
  cache = { at: Date.now(), value: outputs }
  return outputs
}

export function holidaySourceByCode(code: string, lang = "en"): HolidaySource | null {
  const upper = code.trim().toUpperCase()
  return holidaySources(lang).find((s) => s.code === upper) ?? null
}