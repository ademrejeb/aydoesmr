import { File, FileImage, FileText, Reply, SmilePlus, Trash2 } from "lucide-react"
import { wsOrigin, type Conversation, type Message as TMessage } from "@/lib/api"
import { type Dictionary, type Locale } from "@/lib/i18n"
import { cn, timeAgo } from "@/lib/utils"
import { Avatar } from "@/components/ui/avatar"
import { CheckCheck } from "lucide-react"
import { Dropdown } from "@/components/ui/dropdown"
import { singleEmoji, stickerById, EMOJIS } from "@/lib/chat/rich"

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function AttachmentBlock({ msg }: { msg: TMessage }) {
  const att = msg.attachment
  if (!att) return <>{msg.body}</>
  const href = `${wsOrigin()}${att.downloadPath}`
  const caption = msg.body && msg.body !== att.name ? <span className="block px-0.5 pt-1.5 text-xs">{msg.body}</span> : null
  if (att.mimeType.startsWith("image/")) {
    return (
      <div className="min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={href} alt={att.name} loading="lazy" className="max-h-72 max-w-[260px] rounded-xl object-cover" />
        {caption}
      </div>
    )
  }
  const isImage = att.mimeType.startsWith("image/")
  const isDoc = att.mimeType.startsWith("text/") || att.mimeType === "application/pdf"
  return (
    <div className="min-w-0">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="flex w-56 items-center gap-3 rounded-xl border border-border bg-card p-2.5 transition-colors hover:bg-accent"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {isImage ? <FileImage className="h-5 w-5" /> : isDoc ? <FileText className="h-5 w-5" /> : <File className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold">{att.name}</span>
          <span className="block text-[10px] text-muted-foreground">{formatSize(att.size)}</span>
        </span>
      </a>
      {caption}
    </div>
  )
}

function MessageContent({ msg }: { msg: TMessage }) {
  if (msg.kind === "STICKER") {
    const sticker = stickerById(msg.body) ?? stickerById("wave")!
    return (
      <div className={cn("flex flex-col items-center gap-1.5 rounded-2xl px-2 py-2", sticker.bg)}>
        <span className="text-6xl leading-none select-none">{sticker.emoji}</span>
        <span className="text-[10px] font-semibold text-foreground/70">{sticker.label}</span>
      </div>
    )
  }
  if (msg.kind === "GIPHY") {
    const w = Math.min(msg.mediaWidth ?? 220, 240)
    const h = msg.mediaWidth && msg.mediaHeight ? Math.round((msg.mediaHeight / msg.mediaWidth) * w) : undefined
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={msg.mediaUrl ?? ""}
        alt={msg.body || "GIF"}
        loading="lazy"
        width={w}
        height={h}
        className="max-h-64 rounded-xl object-cover"
      />
    )
  }
  if (msg.kind === "ATTACHMENT") return <AttachmentBlock msg={msg} />
  const emoji = singleEmoji(msg.body)
  if (emoji) {
    return <span className="flex items-center justify-center text-6xl leading-none select-none">{emoji}</span>
  }
  return <MentionText body={msg.body} knownMentions={msg.mentionIds} />
}

/** Bold-highlights @mentions anywhere in the body. */
function MentionText({ body, knownMentions }: { body: string; knownMentions?: string[] }) {
  const parts = body.split(/(@[\p{L}\p{N}_][\p{L}\p{N}_\s]{0,23})/u)
  return (
    <>
      {parts.map((part, i) => {
        const isMention = /^@[\p{L}\p{N}_]/u.test(part)
        if (!isMention) return <span key={i}>{part}</span>
        const mentionKnown = knownMentions && knownMentions.length > 0
        return (
          <span key={i} className={cn("font-semibold", mentionKnown ? "text-primary" : "text-primary/80")}>
            {part.trimEnd()}
          </span>
        )
      })}
    </>
  )
}

export function dayLabel(ts: string, locale: Locale): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startDay.getTime() - startToday.getTime()) / 86_400_000)
  if (diffDays >= -1 && diffDays <= 0) {
    try {
      const label = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(diffDays, "day")
      return label.charAt(0).toUpperCase() + label.slice(1)
    } catch {
      /* fall through */
    }
  }
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
  if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric"
  return new Intl.DateTimeFormat(locale, opts).format(d)
}

export function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-2 py-2" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      <span className="rounded-full bg-muted px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-hidden>
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: "0ms" }} />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: "150ms" }} />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: "300ms" }} />
    </span>
  )
}

export function MemberStack({ members }: { members: Conversation["members"] }) {
  const shown = members.slice(0, 4)
  const rest = members.length - shown.length
  return (
    <div className="flex items-center">
      {shown.map((m, i) => (
        <Avatar
          key={m.userId}
          name={m.user.fullName ?? m.user.email}
          src={m.user.avatarUrl}
          size="xs"
          title={m.user.fullName ?? m.user.email}
          className={cn(i > 0 && "-ms-1.5")}
        />
      ))}
      {rest > 0 && (
        <span className="-ms-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-1 ring-border/60">
          +{rest}
        </span>
      )}
    </div>
  )
}

function EmojiGrid({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div className="grid max-h-64 w-full grid-cols-8 gap-0.5 overflow-y-auto p-1.5">
      {EMOJIS.map((e) => (
        <button
          key={e}
          onClick={() => onPick(e)}
          className="rounded-lg px-1 py-1 text-xl transition-colors hover:bg-accent cursor-pointer"
        >
          {e}
        </button>
      ))}
    </div>
  )
}

function QuickReactions({ onPick, t }: { onPick: (emoji: string) => void; t?: Dictionary }) {
  return (
    <Dropdown
      align="start"
      width="w-64"
      trigger={(open, toggle) => (
        <button
          onClick={toggle}
          aria-label={t?.messages.add_reaction ?? "React"}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100 cursor-pointer"
        >
          <SmilePlus className="h-3.5 w-3.5" />
        </button>
      )}
    >
      {(close) => (
        <EmojiGrid
          onPick={(emoji) => {
            close()
            onPick(emoji)
          }}
        />
      )}
    </Dropdown>
  )
}

export function Bubble({
  msg,
  mine,
  grouped,
  showName,
  locale,
  readAt,
  t,
  currentUserId,
  onReact,
  onUnreact,
  onDelete,
}: {
  msg: TMessage
  mine: boolean
  grouped: boolean
  showName: boolean
  locale: Locale
  readAt?: string | null
  t?: Dictionary
  currentUserId?: string
  onReact?: (emoji: string) => void
  onUnreact?: () => void
  onDelete?: () => void
}) {
  const read = Boolean(mine && readAt && new Date(readAt) >= new Date(msg.createdAt))
  const myReaction = msg.reactions.find((r) => r.userId === currentUserId)
  const groupedReactions = msg.reactions.reduce<{ emoji: string; count: number; mine: boolean }[]>((acc, r) => {
    const found = acc.find((x) => x.emoji === r.emoji)
    if (found) {
      found.count += 1
      if (r.userId === currentUserId) found.mine = true
    } else {
      acc.push({ emoji: r.emoji, count: 1, mine: r.userId === currentUserId })
    }
    return acc
  }, [])

  return (
    <div className="group flex flex-col items-end">
      <div className={cn("flex w-full", mine ? "justify-end" : "justify-start", !grouped && "mt-1.5")}>
        {!mine &&
          (showName ? (
            <Avatar name={msg.sender.fullName ?? ""} size="xs" src={msg.sender.avatarUrl} className="me-2 mt-1" />
          ) : (
            <span className="me-2 h-6 w-6 shrink-0" aria-hidden />
          ))}
        <div className={cn("flex min-w-0 max-w-[80%] flex-col", mine ? "items-end" : "items-start")}>
          {showName && !mine && (
            <span className="mb-1 ms-1 text-[11px] font-semibold text-muted-foreground">
              {msg.sender.fullName ?? msg.sender.email}
            </span>
          )}
          <div
            className={cn(
              msg.kind === "STICKER" ||
              msg.kind === "GIPHY" ||
              msg.kind === "ATTACHMENT" ||
              (msg.kind === "TEXT" && singleEmoji(msg.body) !== null)
                ? "max-w-[300px]"
                : "rounded-2xl px-3.5 py-2.5 text-sm break-words whitespace-pre-wrap shadow-sm",
              mine
                ? "rounded-br-sm bg-primary text-primary-foreground"
                : "rounded-bl-sm border border-border bg-card text-card-foreground"
            )}
          >
            {msg.replyTo && !msg.deleted && (
              <div
                className={cn(
                  "mb-1.5 flex items-start gap-1.5 rounded-lg border-s-2 px-2 py-1.5 text-[11px] leading-snug",
                  mine
                    ? "border-primary-foreground/40 bg-background/20 text-primary-foreground/90"
                    : "border-primary bg-muted/70 text-muted-foreground"
                )}
              >
                <Reply className="mt-0.5 h-3 w-3 shrink-0 rtl:-scale-x-100" />
                <span className="line-clamp-2 min-w-0">{msg.replyTo.body}</span>
              </div>
            )}
            {msg.deleted ? (
              <span className="italic text-muted-foreground/80">{t?.messages.deleted_message ?? "Deleted"}</span>
            ) : (
              <MessageContent msg={msg} />
            )}
          </div>
          <div className="mt-1 flex max-w-full flex-wrap items-center gap-1 px-1">
            {groupedReactions.map(({ emoji, count, mine: reacted }) => (
              <button
                key={emoji}
                onClick={() => (reacted ? onUnreact?.() : onReact?.(emoji))}
                aria-pressed={reacted}
                title={reacted ? (t?.messages.add_reaction ?? "") : undefined}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors cursor-pointer",
                  reacted
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background/60 hover:bg-accent"
                )}
              >
                <span>{emoji}</span>
                <span className="text-[10px] font-semibold">{count}</span>
              </button>
            ))}
            {onReact && !msg.deleted && <QuickReactions onPick={(e) => onReact(e)} t={t} />}
          </div>
          <div
            className={cn(
              "mt-1 flex items-center gap-1 px-1 text-[10px] text-muted-foreground",
              mine ? "justify-end" : "justify-start"
            )}
          >
            {mine && (read ? <CheckCheck className="h-3 w-3 text-primary" /> : <CheckCheck className="h-3 w-3" />)}
            {read && t && <span>{t.messages.read}</span>}
            <time dateTime={msg.createdAt} title={new Date(msg.createdAt).toLocaleString(locale)}>
              {timeAgo(msg.createdAt, locale)}
            </time>
            {mine && !msg.deleted && myReaction === undefined && (
              <button
                onClick={() => onReact?.("👍")}
                aria-label={t?.messages.add_reaction ?? "React"}
                className="inline-flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent cursor-pointer"
              >
                <SmilePlus className="h-3.5 w-3.5" />
              </button>
            )}
            {mine && !msg.deleted && (
              <button
                onClick={onDelete}
                aria-label={t?.messages.delete_message ?? "Delete"}
                title={t?.messages.delete_message ?? "Delete"}
                className="inline-flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
