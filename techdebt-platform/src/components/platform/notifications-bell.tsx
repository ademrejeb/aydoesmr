"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck, Inbox } from "lucide-react"
import { api, type Notification } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useChat } from "@/lib/chat/chat-provider"
import { useI18n } from "@/lib/i18n"
import { cn, timeAgo } from "@/lib/utils"
import { Dropdown } from "@/components/ui/dropdown"
import { Tooltip } from "@/components/ui/tooltip"

export function NotificationsBell() {
  const { token, currentOrg } = useAuth()
  const { subscribe } = useChat()
  const { t, locale } = useI18n()
  const router = useRouter()
  const [items, setItems] = useState<Notification[]>([])

  useEffect(() => {
    if (!token || !currentOrg) return
    let alive = true
    api
      .listNotifications(token, currentOrg.id)
      .then((items) => {
        if (alive) setItems(items)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [token, currentOrg])

  useEffect(() => {
    return subscribe<Notification>("notification", (payload) => {
      setItems((prev) => [payload, ...prev].slice(0, 40))
    })
  }, [subscribe])

  const unread = items.filter((n) => !n.readAt).length

  const markAll = async () => {
    if (!token || !currentOrg) return
    try {
      await api.markAllNotificationsRead(token, currentOrg.id)
      setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })))
    } catch {
      /* ignore */
    }
  }

  const openItem = async (n: Notification) => {
    if (token && currentOrg && !n.readAt) {
      try {
        await api.markNotificationRead(n.id, token, currentOrg.id)
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)))
      } catch {
        /* ignore */
      }
    }
    if (n.link) router.push(n.link)
  }

  return (
    <Dropdown
      align="end"
      width="w-[22rem]"
      className="max-w-[calc(100vw-1.5rem)]"
      trigger={(open, toggle) => (
        <Tooltip tip={t.platform.notifications}>
          <button
            onClick={toggle}
            aria-label={t.platform.notifications}
            aria-expanded={open}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
                <span className="absolute -top-1.5 -end-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-danger-foreground ring-2 ring-background">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
        </Tooltip>
      )}
    >
      {() => (
        <>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">{t.platform.notifications}</p>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80 cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t.platform.mark_all_read}
              </button>
            )}
          </div>
          <div className="max-h-[24rem] overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Inbox className="h-8 w-8 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">{t.platform.no_notifications}</p>
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-start transition-colors last:border-0 hover:bg-accent/60 cursor-pointer",
                    !n.readAt && "bg-primary/5"
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      n.readAt ? "bg-border" : "bg-primary"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug">{n.title}</span>
                    {n.body && <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
                    <span className="mt-1 block text-[10px] text-muted-foreground">{timeAgo(n.createdAt, locale)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </Dropdown>
  )
}