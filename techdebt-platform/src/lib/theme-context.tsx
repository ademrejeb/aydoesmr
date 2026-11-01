"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

type Theme = "light" | "dark" | "system"
type Resolved = "light" | "dark"

const THEME_KEY = "techdebt-theme"

interface ThemeContextValue {
  theme: Theme
  resolved: Resolved
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function storedTheme(): Theme {
  if (typeof window === "undefined") return "system"
  const saved = window.localStorage.getItem(THEME_KEY) as Theme | null
  return saved === "light" || saved === "dark" || saved === "system" ? saved : "system"
}

function systemResolved(): Resolved {
  if (typeof window === "undefined") return "light"
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(storedTheme)
  const [resolved, setResolved] = useState<Resolved>(() => {
    const t = storedTheme()
    if (t === "system") return systemResolved()
    return t
  })

  useEffect(() => {
    const root = document.documentElement
    const apply = (r: Resolved) => {
      root.classList.toggle("dark", r === "dark")
      // @adem.rejeb/ui resolves its tokens from data-theme; keep both systems
      // in sync so Tailwind classes and design-system components agree.
      root.setAttribute("data-theme", r)
      root.style.colorScheme = r
      setResolved(r)
    }
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = () => apply(mq.matches ? "dark" : "light")
      handler()
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    }
    apply(theme)
  }, [theme])

  const setTheme = (t: Theme) => {
    window.localStorage.setItem(THEME_KEY, t)
    setThemeState(t)
  }

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}