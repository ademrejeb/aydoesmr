"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Package, Plus, Power, Search, Trash2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, type FormField, type ServiceItem } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Skeleton } from "@/components/ui/skeleton"
import { CATEGORIES, CategoryIcon } from "@/components/service-desk/service-desk-ui"

const FIELD_TYPES: FormField["type"][] = ["text", "textarea", "number", "date", "select", "checkbox"]

export default function ServiceCatalogPage() {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const [items, setItems] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<ServiceItem | null | undefined>(undefined)

  const canManage = currentOrg?.role === "OWNER" || currentOrg?.role === "ADMIN" || currentOrg?.role === "MANAGER"

  const load = useCallback(async () => {
    if (!token || !currentOrg) return
    setLoading(true)
    try {
      setItems(await api.listCatalog(token, currentOrg.id, true))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg, toast])

  useEffect(() => {
    void load()
  }, [load])

  const toggleActive = async (item: ServiceItem) => {
    if (!token || !currentOrg) return
    try {
      const updated = await api.updateCatalogItem({ active: !item.active }, token, currentOrg.id, item.id)
      setItems((list) => list.map((i) => (i.id === item.id ? updated : i)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    }
  }

  const filtered = items.filter((item) =>
    search.trim() ? `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(search.trim().toLowerCase()) : true
  )

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t.service.catalog}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.service.form_fields}</p>
        </div>
        {canManage && (
          <Button onClick={() => setEditing(null)}>
            <Plus className="me-1.5 h-4 w-4" />
            {t.service.new_item}
          </Button>
        )}
      </header>

      <div className="min-w-[12rem]"><Input icon={Search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.service.search_placeholder} /></div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title={t.service.no_items} description={t.service.no_items_hint} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-2">
                <span className="hero-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <CategoryIcon category={item.category} name={item.name} className="h-4 w-4 text-white" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.category}
                    {item.estimatedDays ? ` · ${item.estimatedDays} ${t.service.estimated_days}` : ""}
                  </p>
                </div>
                <Badge variant={item.active ? "success" : "outline"}>{item.active ? t.service.active : t.service.inactive}</Badge>
              </div>
              <p className="line-clamp-3 text-sm text-muted-foreground">{item.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {item.requiresApproval && <Badge variant="warning">{t.service.requires_approval}</Badge>}
                <Badge variant="secondary">
                  {t.service.form_fields}: {item.formSchema.length}
                </Badge>
              </div>
              {canManage && (
                <div className="mt-auto flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(item)}>
                    {t.common.edit}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void toggleActive(item)}>
                    <Power className="h-3.5 w-3.5" />
                    {item.active ? t.service.inactive : t.service.active}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing !== undefined && (
        <ItemModal
          item={editing}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined)
            await load()
          }}
        />
      )}
    </div>
  )
}

function ItemModal({
  item,
  onClose,
  onSaved,
}: {
  item: ServiceItem | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const [name, setName] = useState(item?.name ?? "")
  const [description, setDescription] = useState(item?.description ?? "")
  const [category, setCategory] = useState(item?.category ?? "IT")
  const [estimatedDays, setEstimatedDays] = useState(String(item?.estimatedDays ?? ""))
  const [requiresApproval, setRequiresApproval] = useState(item?.requiresApproval ?? false)
  const [schema, setSchema] = useState<FormField[]>(item?.formSchema ?? [])
  const [saving, setSaving] = useState(false)

  const patch = (index: number, next: Partial<FormField>) =>
    setSchema((list) => list.map((field, i) => (i === index ? { ...field, ...next } : field)))

  const submit = async () => {
    if (!token || !currentOrg) return
    setSaving(true)
    const payload = {
      name: name.trim(),
      description: description.trim(),
      category,
      requiresApproval,
      estimatedDays: estimatedDays ? Number(estimatedDays) : undefined,
      formSchema: schema.filter((field) => field.key.trim() && field.label.trim()),
    }
    try {
      if (item) {
        await api.updateCatalogItem(payload, token, currentOrg.id, item.id)
      } else {
        await api.createCatalogItem(payload, token, currentOrg.id)
      }
      toast.success(t.common.save)
      await onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? item.name : t.service.new_item}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button disabled={saving || name.trim().length < 2} onClick={() => void submit()}>
            {saving && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
            {t.service.save_item}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-muted-foreground">
            {t.service.title_field}
            <input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" maxLength={120} />
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
        <label className="block text-xs font-semibold text-muted-foreground">
          {t.service.description_field}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="input mt-1"
            maxLength={2000}
          />
        </label>
        <div className="grid items-end gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-muted-foreground">
            {t.service.estimated_days}
            <input
              type="number"
              min={0}
              value={estimatedDays}
              onChange={(e) => setEstimatedDays(e.target.value)}
              className="input mt-1"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            {t.service.requires_approval}
          </label>
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{t.service.form_fields}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSchema((list) => [...list, { key: `field_${list.length + 1}`, label: "", type: "text" }])}
            >
              <Plus className="h-3.5 w-3.5" />
              {t.service.add_field}
            </Button>
          </div>
          {schema.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t.service.no_items}</p>
          ) : (
            <ul className="space-y-2">
              {schema.map((field, index) => (
                <li key={index} className="grid gap-2 rounded-lg bg-muted/30 p-2 sm:grid-cols-12">
                  <input
                    value={field.key}
                    onChange={(e) => patch(index, { key: e.target.value.replace(/\s+/g, "_").toLowerCase() })}
                    placeholder={t.service.field_key}
                    className="input sm:col-span-2"
                  />
                  <input
                    value={field.label}
                    onChange={(e) => patch(index, { label: e.target.value })}
                    placeholder={t.service.field_label}
                    className="input sm:col-span-4"
                  />
                  <select
                    value={field.type}
                    onChange={(e) => patch(index, { type: e.target.value as FormField["type"] })}
                    className="input sm:col-span-2"
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={Boolean(field.required)}
                      onChange={(e) => patch(index, { required: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                    {t.service.field_required}
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="sm:col-span-2"
                    onClick={() => setSchema((list) => list.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  {field.type === "select" && (
                    <input
                      value={(field.options ?? []).join(",")}
                      onChange={(e) =>
                        patch(index, {
                          options: e.target.value
                            .split(",")
                            .map((option) => option.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="option A, option B"
                      className="input sm:col-span-12"
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}