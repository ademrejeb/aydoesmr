"use client"

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import { Film, Loader2, Paperclip, Send, Smile, Sticker as StickerIcon } from "lucide-react"
import type { Dictionary } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { EMOJIS, GIPHY_API_KEY, giphySearch, STICKERS, type GifResult } from "@/lib/chat/rich"
import type { SendMessageOptions } from "@/lib/chat/chat-provider"
import type { MessageAttachment, OrgMember } from "@/lib/api"

type Tab = "emoji" | "stickers" | "gif"

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

function RichMenu({
  tab,
  setTab,
  t,
  onEmoji,
  onSticker,
  onGif,
}: {
  tab: Tab
  setTab: (tab: Tab) => void
  t: Dictionary
  onEmoji: (emoji: string) => void
  onSticker: (id: string) => void
  onGif: (gif: GifResult) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GifResult[]>([])
  const [busy, setBusy] = useState(false)
  const queryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (queryTimer.current) clearTimeout(queryTimer.current)
  }, [])

  const searchGiphy = (q: string) => {
    if (queryTimer.current) clearTimeout(queryTimer.current)
    setQuery(q)
    if (!q.trim()) {
      setResults([])
      return
    }
    setBusy(true)
    queryTimer.current = setTimeout(async () => {
      const gifs = await giphySearch(q)
      setResults(gifs)
      setBusy(false)
    }, 350)
  }

  return (
    <div className="border-b border-border bg-background/50">
      <div className="flex items-center gap-1 border-b border-border px-2 pt-1.5">
        {(["emoji", "stickers", "gif"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-t-lg px-3 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer",
              tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {key === "emoji" && <Smile className="h-3.5 w-3.5" />}
            {key === "stickers" && <StickerIcon className="h-3.5 w-3.5" />}
            {key === "gif" && <Film className="h-3.5 w-3.5" />}
            {key === "emoji" ? t.messages.emoji : key === "stickers" ? t.messages.stickers : t.messages.gifs}
          </button>
        ))}
      </div>

      {tab === "emoji" && (
        <div className="max-h-48 overflow-y-auto p-2">
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onEmoji(e)}
                aria-label={e}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors hover:bg-accent cursor-pointer"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "stickers" && (
        <div className="grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto p-2 sm:grid-cols-6">
          {STICKERS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSticker(s.id)}
              title={s.label}
              className={cn("flex flex-col items-center rounded-xl p-1.5 transition-colors hover:ring-2 hover:ring-ring cursor-pointer", s.bg)}
            >
              <span className="text-3xl leading-none select-none">{s.emoji}</span>
              <span className="mt-0.5 max-w-full truncate text-[9px] font-medium text-foreground/70">{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {tab === "gif" &&
        (GIPHY_API_KEY ? (
          <div className="p-2">
            <input
              value={query}
              onChange={(e) => searchGiphy(e.target.value)}
              placeholder={t.messages.gif_search}
              aria-label={t.messages.gif_search}
              className="input mb-2"
            />
            <div className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto">
              {busy && <p className="col-span-3 py-6 text-center text-xs text-muted-foreground">…</p>}
              {!busy && results.length === 0 && query.trim() && (
                <p className="col-span-3 py-6 text-center text-xs text-muted-foreground">{t.search.no_results}</p>
              )}
              {results.map((g) => (
                <button
                  key={g.url}
                  type="button"
                  onClick={() => onGif(g)}
                  title={g.title}
                  className="overflow-hidden rounded-lg bg-muted cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.url} alt={g.title || "GIF"} loading="lazy" className="h-24 w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">{t.messages.gif_key_hint}</p>
        ))}
    </div>
  )
}

/**
 * Self-contained message composer: owns its own draft text, auto-growth, the
 * typing debounce and the rich-message picker (emoji / stickers / GIFs).
 * Shared by the full messages page, the floating dock and the detached chat.
 */
export function Composer({
  onSend,
  sendTyping,
  placeholder,
  sendLabel,
  t,
  disabled,
  upload,
  uploadHint,
  members,
}: {
  onSend: (body: string, opts?: SendMessageOptions) => void | Promise<void>
  sendTyping: (typing: boolean) => void
  placeholder: string
  sendLabel: string
  t: Dictionary
  disabled?: boolean
  upload?: (file: File) => Promise<MessageAttachment | null>
  uploadHint?: string
  members?: OrgMember[]
}) {
  const [draft, setDraft] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("emoji")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [mentions, setMentions] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const growTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`
  }, [])

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current)
  }, [])

  const pingTyping = () => {
    sendTyping(true)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => sendTyping(false), 1600)
  }

  const stopTyping = () => {
    sendTyping(false)
    if (typingTimer.current) clearTimeout(typingTimer.current)
  }

  const onInput = () => {
    pingTyping()
  }

  const doSend = async (opts?: SendMessageOptions, bodyOverride?: string) => {
    const body = (bodyOverride ?? draft).trim()
    if (!body) return
    setDraft("")
    setMenuOpen(false)
    growTextarea()
    stopTyping()
    const mentionOpts: SendMessageOptions = mentions.length > 0 ? { mentions: [...mentions] } : {}
    setMentions([])
    await onSend(body, { ...opts, ...mentionOpts })
  }

  const trailingMentionQuery = (() => {
    const m = draft.match(/(?:^|\s)@([\p{L}\p{N}_]*)$/u)
    return m ? m[1].toLowerCase() : null
  })()

  const suggestions =
    trailingMentionQuery !== null && members?.length
      ? members
          .filter((m) => m.user.id !== undefined)
          .filter((m) => {
            const name = (m.user.fullName ?? m.user.email).toLowerCase()
            return name.includes(trailingMentionQuery as string)
          })
          .slice(0, 5)
      : []

  const clearTrailingMention = (body: string) =>
    body.replace(/(?:^|\s)@[\p{L}\p{N}_]*$/u, "")

  const pickMention = (member: OrgMember) => {
    const name = (member.user.fullName ?? member.user.email).replace(/\s+/g, " ").trim()
    setDraft((prev) => clearTrailingMention(prev) + (prev.startsWith("@") ? "" : " ") + `@${name} `)
    setMentions((prev) => (prev.includes(member.user.id) ? prev : [...prev, member.user.id]))
    textareaRef.current?.focus()
  }

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !upload) return
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError((uploadHint ?? "10 MB").toUpperCase() + ": " + file.name)
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const att = await upload(file)
      if (!att) return
      const caption = draft.trim()
      setMentions([])
      await doSend({ attachmentId: att.id }, caption || file.name)
    } finally {
      setUploading(false)
    }
  }

  const insertEmoji = (emoji: string) => {
    setDraft((prev) => prev + emoji)
    pingTyping()
    textareaRef.current?.focus()
  }

  const onDraftChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value)
    growTextarea()
    onInput()
  }

  return (
    <>
      {menuOpen && (
        <RichMenu
          tab={tab}
          setTab={setTab}
          t={t}
          onEmoji={insertEmoji}
          onSticker={(id) => { setMentions([]); onSend(id, { kind: "STICKER" }) }}
          onGif={(g) => {
            setMentions([])
            onSend(g.title || "GIF", { kind: "GIPHY", mediaUrl: g.url, mediaWidth: g.width, mediaHeight: g.height, mimeType: "image/gif" })
          }}
        />
      )}
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-0.5 border-t border-border bg-card/95 px-2 py-1.5">
          {suggestions.map((m) => (
            <button
              key={m.user.id}
              type="button"
              onClick={() => pickMention(m)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-start text-xs transition-colors hover:bg-accent cursor-pointer"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                {(m.user.fullName ?? m.user.email).slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{m.user.fullName ?? m.user.email}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{m.user.email}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 p-3">
        {upload && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf,application/pdf,.txt,.csv,.xls,.xlsx,.doc,.docx,.zip,.json,.md,.ts,.tsx,.js,.css,.html"
              className="hidden"
              onChange={onPickFile}
              aria-label={sendLabel}
            />
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={disabled || uploading}
              aria-label={placeholder}
              className="h-[44px] w-10 shrink-0"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={t.messages.emoji}
          aria-expanded={menuOpen}
          className={cn("h-[44px] w-10 shrink-0", menuOpen && "bg-accent text-primary")}
        >
          <Smile className="h-5 w-5" />
        </Button>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={onDraftChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void doSend()
            }
          }}
          rows={1}
          placeholder={placeholder}
          dir="auto"
          aria-label={placeholder}
          className="input max-h-28 min-h-[44px] flex-1 resize-none"
        />
        <Button
          variant="default"
          size="icon"
          onClick={() => void doSend()}
          disabled={disabled || uploading || !draft.trim()}
          aria-label={sendLabel}
        >
          <Send className="h-4 w-4 rtl:-scale-x-100" />
        </Button>
      </div>
      {uploadError && <p className="px-4 pb-2 text-[11px] font-medium text-destructive">{uploadError}</p>}
    </>
  )
}