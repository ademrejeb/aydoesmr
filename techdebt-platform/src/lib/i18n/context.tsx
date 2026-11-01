"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { type Locale, DEFAULT_LOCALE, LOCALE_DIRECTION } from "./config"
import { getDictionary, type Dictionary } from "./dictionaries"

interface I18nContextValue {
  locale: Locale
  dir: "rtl" | "ltr"
  t: Dictionary
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("techdebt-locale") as Locale | null
    if (saved && ["ar", "en", "fr"].includes(saved)) {
      setLocaleState(saved)
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.lang = locale
    document.documentElement.dir = LOCALE_DIRECTION[locale]
    localStorage.setItem("techdebt-locale", locale)
  }, [locale, mounted])

  const setLocale = (l: Locale) => setLocaleState(l)

  const value: I18nContextValue = {
    locale,
    dir: LOCALE_DIRECTION[locale],
    t: getDictionary(locale),
    setLocale,
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within I18nProvider")
  return ctx
}