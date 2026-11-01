"use client"

import { useEffect, useRef, useState } from "react"
import { MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { useChat } from "@/lib/chat/chat-provider"
import { useI18n } from "@/lib/i18n"
import { Tooltip } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { isDetachedWindow, openDetachedChat } from "@/lib/chat/detach"
import { broadcastMessage } from "@/lib/chat/broadcast"

/**
 * Persistent floating chat launcher. Opens the detached chat window and stays
 * hidden while it is open; the unread badge mirrors the ChatProvider count.
 * Rendered inside the dashboard shell so it is available on every page.
 */
export function FloatingDock() {
  const { unread } = useChat()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const handleRef = useRef<Window | null>(null)

  useEffect(() => {
    if (isDetachedWindow()) return () => {}
    if (!open) return () => {}
    const timer = window.setInterval(() => {
      if (handleRef.current && handleRef.current.closed) {
        handleRef.current = null
        setOpen(false)
      }
    }, 2000)
    return () => window.clearInterval(timer)
  }, [open])

  if (isDetachedWindow()) return null
  if (open) return null

  return (
    <Tooltip tip={t.messages.open_chat_window} className="fixed bottom-6 end-6 z-drawer">
      <Button
        variant="default"
        size="icon"
        aria-label={t.messages.open_chat_window}
        className="h-12 w-12 rounded-full shadow-lg"
        onClick={() => {
          const handle = openDetachedChat()
          handleRef.current = handle
          setOpen(Boolean(handle))
          broadcastMessage({ type: "request-detach" })
        }}
      >
        <MessageSquare className="h-5 w-5" />
        {unread > 0 && (
          <span
            className={cn(
              "absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white",
              "bg-destructive"
            )}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>
    </Tooltip>
  )
}