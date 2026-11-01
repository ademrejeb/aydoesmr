export type Locale = "ar" | "en" | "fr"

export const LOCALES: Locale[] = ["ar", "en", "fr"]

export const DEFAULT_LOCALE: Locale = "ar"

export const LOCALE_DIRECTION: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
  fr: "ltr",
}

export const LOCALE_LABELS: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
  fr: "Français",
}