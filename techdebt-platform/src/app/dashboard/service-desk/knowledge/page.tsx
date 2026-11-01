"use client"

import { useCallback, useEffect, useState } from "react"
import { BookOpenText, Eye, Loader2, Plus, Search, ThumbsDown, ThumbsUp } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, type KnowledgeArticle } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, formatDateTime } from "@/components/service-desk/service-desk-ui"

export default function ServiceKnowledgePage() {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("")
  const [reading, setReading] = useState<KnowledgeArticle | null>(null)
  const [editing, setEditing] = useState<KnowledgeArticle | null | undefined>(undefined)

  const canManage = currentOrg?.role === "OWNER" || currentOrg?.role === "ADMIN" || currentOrg?.role === "MANAGER"

  const load = useCallback(async () => {
    if (!token || !currentOrg) return
    setLoading(true)
    try {
      setArticles(
        await api.listArticles(token, currentOrg.id, {
          category: category || undefined,
          search: search.trim() || undefined,
          publishedOnly: false,
        })
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg, category, search, toast])

  useEffect(() => {
    void load()
  }, [load])

  const openArticle = async (article: KnowledgeArticle) => {
    setReading(article)
    try {
      const fresh = await api.getArticle(token!, currentOrg!.id, article.id)
      setReading(fresh)
      setArticles((list) => list.map((a) => (a.id === fresh.id ? fresh : a)))
    } catch {
      /* keep the list copy */
    }
  }

  const feedback = async (helpful: boolean) => {
    if (!token || !currentOrg || !reading) return
    try {
      const result = await api.articleFeedback(token, currentOrg.id, reading.id, helpful)
      setReading({ ...reading, helpful: result.helpful, notHelpful: result.notHelpful, views: result.views })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t.service.knowledge}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.service.read_article}</p>
        </div>
        {canManage && (
          <Button onClick={() => setEditing(null)}>
            <Plus className="me-1.5 h-4 w-4" />
            {t.service.new_article}
          </Button>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[12rem]"><Input icon={Search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.service.search_placeholder} /></div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input w-auto">
          <option value="">{t.service.category}: {t.service.filter_all}</option>
          {Array.from(new Set(articles.map((a) => a.category))).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <EmptyState
          icon={BookOpenText}
          title={t.service.no_articles}
          description={t.service.no_articles_hint}
          action={
            canManage ? (
              <Button size="sm" onClick={() => setEditing(null)}>
                {t.service.new_article}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {articles.map((article) => (
            <li key={article.id}>
              <button
                onClick={() => void openArticle(article)}
                className="flex w-full cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4 text-start shadow-sm transition-colors hover:bg-accent/40"
              >
                <BookOpenText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{article.title}</p>
                  {article.summary && <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{article.summary}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="secondary">{article.category}</Badge>
                    <Badge variant={article.published ? "success" : "outline"}>
                      {article.published ? t.service.article_published : t.service.article_draft}
                    </Badge>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {article.views} {t.service.views}
                    </span>
                    {article.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                    <span className="ms-auto">{formatDate(article.updatedAt)}</span>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(reading)}
        onClose={() => setReading(null)}
        title={reading?.title ?? ""}
        size="lg"
        footer={
          reading ? (
            <>
              <div className="me-auto flex items-center gap-2 text-xs text-muted-foreground">
                <Button size="sm" variant="outline" onClick={() => void feedback(true)}>
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {reading.helpful}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void feedback(false)}>
                  <ThumbsDown className="h-3.5 w-3.5" />
                  {reading.notHelpful}
                </Button>
              </div>
              {canManage && (
                <Button
                  onClick={() => {
                    setEditing(reading)
                    setReading(null)
                  }}
                >
                  {t.common.edit}
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {reading && (
          <div className="space-y-3">
            {reading.summary && <p className="text-sm font-semibold text-muted-foreground">{reading.summary}</p>}
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{reading.body}</div>
            <p className="border-t border-border pt-2 text-xs text-muted-foreground">
              {reading.author?.fullName ?? "—"} · {formatDateTime(reading.updatedAt)}
            </p>
          </div>
        )}
      </Modal>

      {editing !== undefined && (
        <ArticleModal
          article={editing}
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

function ArticleModal({
  article,
  onClose,
  onSaved,
}: {
  article: KnowledgeArticle | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const [title, setTitle] = useState(article?.title ?? "")
  const [summary, setSummary] = useState(article?.summary ?? "")
  const [body, setBody] = useState(article?.body ?? "")
  const [category, setCategory] = useState(article?.category ?? "GENERAL")
  const [tags, setTags] = useState((article?.tags ?? []).join(", "))
  const [published, setPublished] = useState(article?.published ?? true)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!token || !currentOrg) return
    setSaving(true)
    const payload = {
      title: title.trim(),
      summary: summary.trim() || undefined,
      body: body.trim(),
      category,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      published,
    }
    try {
      if (article) {
        await api.updateArticle(payload, token, currentOrg.id, article.id)
      } else {
        await api.createArticle(payload, token, currentOrg.id)
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
      title={article ? article.title : t.service.new_article}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button disabled={saving || title.trim().length < 3 || body.trim().length < 10} onClick={() => void submit()}>
            {saving && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-muted-foreground">
            {t.service.title_field}
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input mt-1" maxLength={160} />
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            {t.service.category}
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="input mt-1" maxLength={40} />
          </label>
        </div>
        <label className="block text-xs font-semibold text-muted-foreground">
          {t.service.summary_field}
          <input value={summary} onChange={(e) => setSummary(e.target.value)} className="input mt-1" maxLength={300} />
        </label>
        <label className="block text-xs font-semibold text-muted-foreground">
          {t.service.body_field}
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="input mt-1" />
        </label>
        <div className="grid items-end gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-muted-foreground">
            {t.service.tags}
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vpn, access" className="input mt-1" />
          </label>
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            {t.service.publish}
          </label>
        </div>
      </div>
    </Modal>
  )
}