"use client"

import { useCallback, useEffect, useState } from "react"
import { CircleAlert, CircleCheck, Loader2, ScanSearch } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, type GatewayStatus } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AnalysisResultsView,
  type AnalysisMetrics,
  type RuleMatch,
} from "@/components/platform/analysis-results"

const DEFAULT_GATEWAY = process.env.NEXT_PUBLIC_AI_GATEWAY_URL ?? "http://localhost:8080"

interface AnalyzeResponse {
  success: boolean
  metrics?: AnalysisMetrics
  rules?: RuleMatch[]
  duration_ms?: number
}

export function AnalysisTab() {
  const { t } = useI18n()
  const { token, currentOrg } = useAuth()
  const toast = useToast()

  const [gateway, setGateway] = useState<GatewayStatus | null>(null)
  const [statusError, setStatusError] = useState(false)
  const [code, setCode] = useState("")
  const [language, setLanguage] = useState("typescript")
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)

  const loadGateway = useCallback(async () => {
    if (!token || !currentOrg) return
    try {
      setGateway(await api.getGatewayStatus(token, currentOrg.id))
      setStatusError(false)
    } catch {
      setGateway(null)
      setStatusError(true)
    }
  }, [token, currentOrg])

  useEffect(() => {
    loadGateway()
  }, [loadGateway])

  const run = async () => {
    if (!code.trim()) {
      toast.error(t.ai.empty_error)
      return
    }
    setAnalyzing(true)
    setResult(null)
    try {
      const res = await fetch(`${gateway?.baseUrl ?? DEFAULT_GATEWAY}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: code, language }),
      })
      if (!res.ok) {
        let message = t.ai.gateway_down
        try {
          const data = await res.json()
          if (typeof data?.error === "string" && data.error) message = data.error
        } catch {
          /* ignore */
        }
        throw new Error(message)
      }
      setResult((await res.json()) as AnalyzeResponse)
    } catch (e) {
      toast.error(t.ai.gateway_down, e instanceof Error ? e.message : undefined)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t.ai.analysis_subtitle}</p>
        {statusError ? (
          <Badge variant="danger" dot>
            {t.ai.gateway_down}
          </Badge>
        ) : gateway ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant={gateway.healthy ? "success" : "danger"} dot>
              {gateway.healthy ? t.ai.gateway_ok : t.ai.gateway_down}
            </Badge>
            {gateway.version && <Badge variant="secondary">v{gateway.version}</Badge>}
            <span className="font-mono text-muted-foreground" dir="ltr">
              {gateway.baseUrl}
            </span>
          </div>
        ) : (
          <Skeleton className="h-6 w-48 rounded-full" />
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="ai-analysis-language">
            {t.ai.language_label}
          </label>
          <div className="w-full sm:w-48">
            <select
              id="ai-analysis-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="input h-10 cursor-pointer"
            >
              {Object.entries(t.paste.languages).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t.ai.source_placeholder}
          className="code-textarea w-full rounded-lg border border-border bg-background p-3 focus:outline-none focus:ring-2 focus:ring-ring"
          rows={14}
          dir="ltr"
        />
        <div className="mt-4 flex justify-end">
          <Button onClick={run} disabled={analyzing || !code.trim()} size="lg">
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.ai.analyzing}
              </>
            ) : (
              <>
                <ScanSearch className="h-4 w-4" />
                {t.ai.analyze}
              </>
            )}
          </Button>
        </div>
      </div>

      {analyzing ? (
        <section className="space-y-4" aria-busy="true" aria-label={t.ai.analyzing}>
          <Skeleton className="h-7 w-44" />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-32 w-full rounded-2xl" />
        </section>
      ) : result ? (
        <AnalysisResultsView
          metrics={result.metrics}
          rules={result.rules}
          durationMs={result.duration_ms}
          success={result.success}
          issuesCount={result.rules?.length ?? 0}
        />
      ) : statusError ? (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {t.ai.gateway_down}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <CircleCheck className="h-4 w-4 shrink-0" />
          {t.ai.analysis_subtitle}
        </div>
      )}
    </div>
  )
}