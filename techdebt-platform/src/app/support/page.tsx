"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Headset, Loader2, Package, Search, Send, Siren } from "lucide-react"
import { api, type FormField, type PublicCatalogItem, type PublicTrackedTicket } from "@/lib/api"
import { useI18n, type Dictionary } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CategoryIcon,
  CATEGORIES,
  DynamicFormFields,
  formatDateTime,
  priorityLabel,
  PRIORITIES,
} from "@/components/service-desk/service-desk-ui"

type Mode = "services" | "request" | "incident" | "track"

export default function PublicSupportPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [mode, setMode] = useState<Mode>("services")
  const [org, setOrg] = useState<{ name: string; slug: string } | null>(null)
  const [items, setItems] = useState<PublicCatalogItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.publicCatalog()
      setOrg(result.organization)
      setItems(result.items)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  const tabs: { key: Mode; label: string; icon: typeof Package }[] = [
    { key: "services", label: t.service.public_services, icon: Package },
    { key: "request", label: t.service.public_new_request, icon: Send },
    { key: "incident", label: t.service.public_report_issue, icon: Siren },
    { key: "track", label: t.service.public_track, icon: Search },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <span className="hero-gradient flex h-9 w-9 items-center justify-center rounded-xl">
              <Headset className="h-5 w-5 text-white" />
            </span>
            {t.service.public_title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.service.public_subtitle}
            {org ? ` · ${org.name}` : ""}
          </p>
        </div>
        <Link href="/login" className="text-xs font-semibold text-primary hover:underline">
          {t.auth.sign_in}
        </Link>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button key={tab.key} size="sm" variant={mode === tab.key ? "default" : "outline"} onClick={() => setMode(tab.key)}>
            <tab.icon className="me-1.5 h-4 w-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {mode === "services" && (
        <section>
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.service.no_items}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start gap-2">
                    <span className="hero-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                      <CategoryIcon category={item.category} name={item.name} className="h-4 w-4 text-white" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.category}
                        {item.estimatedDays ? ` · ${item.estimatedDays} ${t.service.estimated_days}` : ""}
                      </p>
                    </div>
                  </div>
                  <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">{item.description}</p>
                  <Button size="sm" onClick={() => setMode("request")} className="self-start">
                    {t.service.public_new_request}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {mode === "request" && (
        <PublicRequestForm
          items={items}
          onDone={(number) => {
            toast.success(`${t.service.public_submitted}: ${number}`)
            setMode("track")
          }}
        />
      )}

      {mode === "incident" && <PublicIncidentForm onDone={(number) => toast.success(`${t.service.public_submitted}: ${number}`)} />}

      {mode === "track" && <TrackPanel />}
    </div>
  )
}

function ContactFields({
  value,
  onChange,
  t,
}: {
  value: { name: string; email: string }
  onChange: (next: { name: string; email: string }) => void
  t: Dictionary
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs font-semibold text-muted-foreground">
        {t.service.name_field}
        <input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          className="input mt-1"
          maxLength={80}
          autoComplete="name"
        />
      </label>
      <label className="block text-xs font-semibold text-muted-foreground">
        {t.service.public_your_email}
        <input
          type="email"
          dir="ltr"
          value={value.email}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
          className="input mt-1"
          autoComplete="email"
        />
      </label>
    </div>
  )
}

function Honeypot({ onChange }: { onChange: (value: string) => void }) {
  return (
    <div className="absolute -start-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
      <label htmlFor="website">website</label>
      <input id="website" name="website" tabIndex={-1} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function PublicRequestForm({ items, onDone }: { items: PublicCatalogItem[]; onDone: (number: string) => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [itemId, setItemId] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("P3")
  const [contact, setContact] = useState({ name: "", email: "" })
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [honeypot, setHoneypot] = useState("")
  const [saving, setSaving] = useState(false)

  const item = items.find((i) => i.id === itemId)
  const fields: FormField[] = item?.formSchema ?? []
  const missingRequired = fields.some((field) => field.required && !formData[field.key])
  const valid = title.trim().length >= 4 && description.trim().length >= 10 && contact.name.trim() && /\S+@\S+\.\S+/.test(contact.email)

  const submit = async () => {
    setSaving(true)
    try {
      const result = await api.submitPublicRequest({
        name: contact.name.trim(),
        email: contact.email.trim(),
        title: title.trim(),
        description: description.trim(),
        itemId: itemId || undefined,
        priority,
        formData: Object.keys(formData).length ? formData : undefined,
        website: honeypot || undefined,
      })
      onDone(result.number)
      setTitle("")
      setDescription("")
      setFormData({})
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <h2 className="font-semibold">{t.service.public_new_request}</h2>
      <div className="relative">
        <Honeypot onChange={setHoneypot} />
        <ContactFields value={contact} onChange={setContact} t={t} />
      </div>
      <label className="block text-xs font-semibold text-muted-foreground">
        {t.service.public_choose_service}
        <select
          value={itemId}
          onChange={(e) => {
            setItemId(e.target.value)
            setFormData({})
          }}
          className="input mt-1"
        >
          <option value="">{t.service.filter_all}</option>
          {items.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-semibold text-muted-foreground">
        {t.service.title_field}
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="input mt-1" maxLength={160} />
      </label>
      <label className="block text-xs font-semibold text-muted-foreground">
        {t.service.description_field}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="input mt-1"
          maxLength={4000}
        />
      </label>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{t.service.public_priority_hint}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={cn(
                "cursor-pointer rounded-lg border p-2.5 text-start transition-colors",
                priority === p ? "border-primary/50 bg-primary/5" : "border-border hover:bg-accent/40"
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                {p} · {priorityLabel(p, t)}
              </span>
              <span className="text-xs text-muted-foreground">
                {p === "P1" ? t.service.p1_hint : p === "P2" ? t.service.p2_hint : p === "P3" ? t.service.p3_hint : t.service.p4_hint}
              </span>
            </button>
          ))}
        </div>
      </div>
      <DynamicFormFields fields={fields} values={formData} onChange={(key, value) => setFormData((f) => ({ ...f, [key]: value }))} t={t} />
      <Button disabled={saving || !valid || missingRequired} onClick={() => void submit()}>
        {saving && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
        {t.service.public_submit}
      </Button>
      <p className="text-xs text-muted-foreground">{t.service.public_keep_number}</p>
    </section>
  )
}

function PublicIncidentForm({ onDone }: { onDone: (number: string) => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("P2")
  const [category, setCategory] = useState("IT")
  const [contact, setContact] = useState({ name: "", email: "" })
  const [honeypot, setHoneypot] = useState("")
  const [saving, setSaving] = useState(false)

  const valid = title.trim().length >= 4 && description.trim().length >= 10 && contact.name.trim() && /\S+@\S+\.\S+/.test(contact.email)

  const submit = async () => {
    setSaving(true)
    try {
      const result = await api.submitPublicIncident({
        name: contact.name.trim(),
        email: contact.email.trim(),
        title: title.trim(),
        description: description.trim(),
        priority,
        category,
        website: honeypot || undefined,
      })
      onDone(result.number)
      setTitle("")
      setDescription("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <h2 className="font-semibold">{t.service.public_report_issue}</h2>
      <div className="relative">
        <Honeypot onChange={setHoneypot} />
        <ContactFields value={contact} onChange={setContact} t={t} />
      </div>
      <label className="block text-xs font-semibold text-muted-foreground">
        {t.service.title_field}
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="input mt-1" maxLength={160} />
      </label>
      <label className="block text-xs font-semibold text-muted-foreground">
        {t.service.description_field}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="input mt-1"
          maxLength={4000}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-muted-foreground">
          {t.service.public_impact}
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input mt-1">
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p} · {priorityLabel(p, t)}
              </option>
            ))}
          </select>
          <span className="mt-1 block font-normal">{t.service.public_impact_hint}</span>
        </label>
        <label className="block text-xs font-semibold text-muted-foreground">
          {t.service.category}
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input mt-1">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Button disabled={saving || !valid} onClick={() => void submit()}>
        {saving && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
        {t.service.public_submit}
      </Button>
    </section>
  )
}

function TrackPanel() {
  const { t } = useI18n()
  const toast = useToast()
  const [number, setNumber] = useState("")
  const [email, setEmail] = useState("")
  const [ticket, setTicket] = useState<PublicTrackedTicket | null>(null)
  const [loading, setLoading] = useState(false)

  const lookup = async () => {
    setLoading(true)
    setTicket(null)
    try {
      const result = await api.publicTrack(number.trim().toUpperCase(), email.trim())
      setTicket(result.ticket)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.service.public_not_found)
      setTicket(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <h2 className="font-semibold">{t.service.public_track}</h2>
      <p className="text-xs text-muted-foreground">{t.service.public_track_hint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-muted-foreground">
          {t.service.public_number}
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="REQ-000001"
            dir="ltr"
            className="input mt-1 font-mono uppercase"
          />
        </label>
        <label className="block text-xs font-semibold text-muted-foreground">
          {t.service.public_your_email}
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input mt-1"
          />
        </label>
      </div>
      <Button disabled={loading || !number.trim() || !email.trim()} onClick={() => void lookup()}>
        {loading ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" /> : <Search className="me-1.5 h-4 w-4" />}
        {t.service.public_track}
      </Button>

      {ticket && (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-primary">{ticket.number}</span>
            <Badge variant="secondary">{ticket.kind === "incident" ? t.service.incidents : t.service.requests}</Badge>
            <Badge variant="outline">
              {ticket.priority} · {priorityLabel(ticket.priority, t)}
            </Badge>
            <span className="ms-auto text-xs text-muted-foreground">{formatDateTime(ticket.updatedAt)}</span>
          </div>
          <p className="font-semibold">{ticket.title}</p>
          <p className="text-xs text-muted-foreground">
            {t.service.public_ticket_raised}: {formatDateTime(ticket.createdAt)}
            {ticket.item ? ` · ${ticket.item.name}` : ""}
          </p>
          <p className="text-sm">
            {t.service.public_ticket_status}: <span className="font-semibold">{ticket.status}</span>
          </p>
          {(ticket.targetAt ?? ticket.resolveDueAt ?? ticket.dueAt) && (
            <p className="text-sm">
              {t.service.public_target}: {formatDateTime(ticket.targetAt ?? ticket.resolveDueAt ?? ticket.dueAt)}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
