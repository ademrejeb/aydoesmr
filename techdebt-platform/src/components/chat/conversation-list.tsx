"use client"

import { useState } from "react"
import { Archive, CircleAlert, MessageSquare, Plus, RotateCcw, Search, UserPlus, Users } from "lucide-react"
import type { AuthUser, Conversation } from "@/lib/api"
import { type Dictionary, type Locale } from "@/lib/i18n"
import { cn, timeAgo } from "@/lib/utils"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dropdown, DropdownHeader, DropdownItem } from "@/components/ui/dropdown"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip } from "@/components/ui/tooltip"

/**
 * The conversation list sidebar. Pure/controlled: data and actions come from
 * props, seat-of-state (search query) stays local. Reused by the messages
 * page, the floating dock and the detached chat window.
 */
export function ConversationList({
  conversations,
  online,
  lastBodies,
  activeId,
  loading,
  loadError,
  locale,
  t,
  className,
  me,
  setStatus,
  onArchive,
  onSelect,
  onNewChat,
  onNewGroup,
  onInvite,
}: {
  conversations: Conversation[]
  online: Set<string>
  lastBodies: Record<string, string>
  activeId: string | null
  loading: boolean
  loadError: string | null
  locale: Locale
  t: Dictionary
  className?: string
  me?: AuthUser | null
  setStatus?: (dto: { status?: string; statusNote?: string | null; statusUntil?: string | null }) => void
  onArchive?: (conversationId: string) => void
  onSelect: (conversationId: string) => void
  onNewChat: () => void
  onNewGroup: () => void
  onInvite: () => void
}) {
  const [search, setSearch] = useState("")
  const [showArchived, setShowArchived] = useState(false)

  const q = search.trim().toLowerCase()
  const visible = q
    ? (showArchived ? conversations.filter((c) => c.archived) : conversations.filter((c) => !c.archived)).filter((c) =>
        c.name.toLowerCase().includes(q)
      )
    : showArchived
      ? conversations.filter((c) => c.archived)
      : conversations.filter((c) => !c.archived)

  const myStatus = me?.status ?? "ACTIVE"
  const myDot =
    myStatus === "BUSY" ? "bg-destructive" : myStatus === "AWAY" ? "bg-warning" : myStatus === "OFFLINE" ? "bg-muted" : "bg-success"
  const myLabel = (() => {
    switch (myStatus) {
      case "AWAY": return t.messages.status_away
      case "BUSY": return t.messages.status_busy
      case "OFFLINE": return t.messages.status_offline
      default: return t.messages.status_available
    }
  })()

  const partnerPresence = (conv: Conversation, partner: AuthUser): string => {
    if (online.has(partner.id)) {
      return conv.unreadCount > 0 ? "" : t.messages.online
    }
    const st = partner.status
    if (st === "BUSY" || st === "AWAY") {
      return st === "BUSY" ? t.messages.status_busy : t.messages.status_away
    }
    if (partner.lastSeenAt) return t.messages.last_seen.replace("{time}", timeAgo(partner.lastSeenAt, locale))
    return ""
  }

  return (
    <aside
      className={cn("flex w-full shrink-0 flex-col border-e border-border bg-background/50 md:w-80", className)}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-sm font-bold">{t.messages.title}</h2>
          {me && setStatus && (
            <Dropdown
              align="start"
              width="w-52"
              trigger={(open, toggle) => (
                <Tooltip tip={t.messages.set_status}>
                  <button
                    onClick={toggle}
                    aria-label={t.messages.set_status}
                    aria-expanded={open}
                    className="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent cursor-pointer"
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", myDot)} aria-hidden />
                    <span className="max-w-20 truncate">{myLabel}</span>
                  </button>
                </Tooltip>
              )}
            >
              {(close) => (
                <>
                  <DropdownHeader>
                    <p className="text-xs font-medium text-muted-foreground">{t.messages.set_status}</p>
                  </DropdownHeader>
                  {(["ACTIVE", "AWAY", "BUSY", "OFFLINE"] as const).map((s) => (
                    <DropdownItem key={s} onClick={() => { setStatus({ status: s }); close() }}>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            s === "BUSY" ? "bg-destructive" : s === "AWAY" ? "bg-warning" : s === "OFFLINE" ? "bg-muted" : "bg-success"
                          )}
                          aria-hidden
                        />
                        {s === "ACTIVE" ? t.messages.status_available : s === "AWAY" ? t.messages.status_away : s === "BUSY" ? t.messages.status_busy : t.messages.status_offline}
                      </span>
                    </DropdownItem>
                  ))}
                  {(me.statusNote ?? null) !== null && (
                    <DropdownItem onClick={() => { setStatus({ status: me.status, statusNote: null }); close() }}>
                      {t.messages.clear_status}
                    </DropdownItem>
                  )}
                </>
              )}
            </Dropdown>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip tip={t.messages.new_message}>
            <Button size="icon" className="h-8 w-8" onClick={onNewChat} aria-label={t.messages.new_message}>
              <Plus className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip tip={t.messages.new_group}>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={onNewGroup} aria-label={t.messages.new_group}>
              <Users className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip tip={t.invite.invite}>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onInvite} aria-label={t.invite.invite}>
              <UserPlus className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip tip={t.messages.archived}>
            <Button
              variant={showArchived ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowArchived((v) => !v)}
              aria-label={t.messages.archived}
              aria-pressed={showArchived}
            >
              {showArchived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search.placeholder}
            aria-label={t.search.placeholder}
            className="input ps-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loadError && !loading && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}
        {loading ? (
          <div className="space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-2 pt-4">
            <EmptyState icon={MessageSquare} title={t.messages.no_conversations} />
          </div>
        ) : visible.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">{t.messages.no_conversations}</p>
        ) : (
          <div className="space-y-1">
            {visible.map((conv) => {
              const convPartner = conv.partner
              const unread = conv.unreadCount > 0 && !conv.archived
              const onlineNow = convPartner ? online.has(convPartner.id) : false
              const bodyP = lastBodies[conv.id]
              const preview = bodyP?.trim()
                ? bodyP
                : conv.type === "GROUP"
                  ? `${conv.members.length} ${t.messages.members}`
                  : convPartner
                    ? partnerPresence(conv, convPartner) || t.messages.start_conversation
                    : t.messages.start_conversation
              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    if (conv.archived && onArchive) onArchive(conv.id)
                    onSelect(conv.id)
                  }}
                  aria-current={activeId === conv.id ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors cursor-pointer",
                    conv.archived
                      ? "opacity-70"
                      : activeId === conv.id
                        ? "bg-primary/10"
                        : unread
                          ? "bg-primary/5 hover:bg-accent"
                          : "hover:bg-accent"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar
                      name={conv.name}
                      size="md"
                      src={conv.type === "DIRECT" ? conv.partner?.avatarUrl : undefined}
                    />
                    {onlineNow && !conv.archived && (
                      <span
                        className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-background"
                        aria-hidden
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-xs", unread ? "font-bold" : "font-semibold")}>{conv.name}</span>
                      {conv.archived && (
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                          {t.messages.archived}
                        </span>
                      )}
                      {conv.lastMessageAt && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(conv.lastMessageAt, locale)}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-[11px]",
                          unread ? "font-semibold text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {preview}
                      </span>
                      {unread && (
                        <Badge variant="default" className="h-4 min-w-4 shrink-0 px-1 text-[9px] leading-4">
                          {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}