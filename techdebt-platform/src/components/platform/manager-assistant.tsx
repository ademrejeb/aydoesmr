"use client"

import { useState } from "react"
import { Bot, Loader2, Trash2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type ChatItem =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; mode: "ai" | "summary" }

/** Manager AI assistant chat widget: asks management questions against a live org snapshot. */
export function ManagerAssistant() {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const [items, setItems] = useState<ChatItem[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)

  const canAsk = Boolean(token && currentOrg && input.trim() && !busy)

  const ask = async () => {
    if (!token || !currentOrg || !canAsk) return
    const question = input.trim()
    setInput("")
    setItems((m) => [...m, { role: "user", content: question }])
    setBusy(true)
    try {
      const res = await api.assistantQuery(token, currentOrg.id, question)
      setItems((m) => [...m, { role: "assistant", content: res.answer, mode: res.mode }])
    } catch {
      toast.error(t.errors.network_error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <h4 className="text-sm font-semibold">{t.assistant.title}</h4>
            <p className="text-xs text-muted-foreground">{t.assistant.subtitle}</p>
          </div>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => setItems([])}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t.assistant.clear}
          </button>
        )}
      </div>

      <div className="mt-3 flex max-h-72 min-h-24 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-muted/30 p-3">
        {items.length === 0 && <p className="m-auto py-6 text-center text-sm text-muted-foreground">{t.assistant.empty}</p>}
        {items.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="max-w-[92%] space-y-1">
                <div className="rounded-xl rounded-bl-sm bg-card px-3 py-2 text-sm text-card-foreground shadow-sm">
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {m.mode === "ai" ? t.assistant.ai_mode : t.assistant.summary_mode}
                </Badge>
              </div>
            </div>
          )
        )}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t.assistant.thinking}
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canAsk) ask()
          }}
          placeholder={t.assistant.placeholder}
          className="input h-10 flex-1"
        />
        <Button size="sm" onClick={ask} disabled={!canAsk} className="h-10">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t.assistant.ask}
        </Button>
      </div>
    </section>
  )
}