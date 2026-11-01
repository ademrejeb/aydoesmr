import type { Metadata, Viewport } from "next"
import { connection } from "next/server"
import { Tajawal, Inter } from "next/font/google"
import { I18nProvider } from "@/lib/i18n"
import { AuthProvider } from "@/lib/auth-context"
import { ThemeProvider } from "@/lib/theme-context"
import { ToastProvider } from "@/lib/toast-context"
import { DEFAULT_LOCALE, LOCALE_DIRECTION } from "@/lib/i18n"
import "./globals.css"

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic"],
  weight: ["300", "400", "500", "700", "800"],
  display: "swap",
})

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "TechVerse — Technical Debt Intelligence",
    template: "%s · TechVerse",
  },
  description:
    "AI-powered technical debt analysis, agile delivery and hosted Git for modern development teams. Arabic-first with English and French support.",
  applicationName: "TechVerse",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
  ],
  width: "device-width",
  initialScale: 1,
}

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('techdebt-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.setAttribute('data-theme',d?'dark':'light');if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light';}catch(e){}})();`

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Force request-time rendering so the security proxy's per-request CSP nonce
  // can be applied to inline scripts (static prerendering has no request, so
  // no nonce would be injected and the strict CSP would block hydration).
  await connection()

  const dir = LOCALE_DIRECTION[DEFAULT_LOCALE]

  return (
    <html
      lang={DEFAULT_LOCALE}
      dir={dir}
      className={`${tajawal.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <I18nProvider>{children}</I18nProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}