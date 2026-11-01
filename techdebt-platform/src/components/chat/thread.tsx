"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { MessageSquare, Plus } from "lucide-react"
import type { Conversation, Message as TMessage } from "@/lib/api"
import { type Dictionary, type Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Bubble, dayLabel, DaySeparator } from "@/components/chat/message-bubble"
import { Composer } from "@/components/chat/composer"
import { ThreadHeader } from "@/components/chat/thread-header"
import type { SendMessageOptions } from "@/lib/chat/chat-provider"

/**
 * Renders the open conversation: header, message log and composer.
 * Reactive state (messages, presence, typing) comes from props so the same
 * component powers the full page, the floating dock and the detached window.
 */
export function Thread({
  active,
  messages,
  loading,
  locale,
  t,
  group,
  isOnline,
  isTyping,
  currentUserId,
  members,
  onBack,
  onNewChat,
  onInvite,
  onLeaveGroup,
  onSend,
  sendTyping,
  upload,
  onReact,
  onUnreact,
  onDeleteMessage,
  onArchive,
  onDetach,
  onCall,
}: {
  active: Conversation | null
  messages: TMessage[]
  loading: boolean
  locale: Locale
  t: Dictionary
  group: boolean
  isOnline: boolean
  isTyping: boolean
  currentUserId?: string
  members?: import("@/lib/api").OrgMember[]
  onBack: () => void
  onNewChat: () => void
  onInvite: () => void
  onLeaveGroup: () => void
  onSend: (body: string, opts?: SendMessageOptions) => Promise<void> | void
  sendTyping: (typing: boolean) => void
  upload?: (file: File) => Promise<import("@/lib/api").MessageAttachment | null>
  onReact?: (conversationId: string, messageId: string, emoji: string) => void
  onUnreact?: (conversationId: string, messageId: string) => void
  onDeleteMessage?: (conversationId: string, messageId: string) => void
  onArchive?: () => void
  onDetach?: () => void
  onCall?: () => void
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior })
  }, [messages.length, active?.id])

  const bubbleItems: ReactNode[] = []
  messages.forEach((msg, i) => {
    const prev = messages[i - 1]
    const mine = msg.sender.id === currentUserId
    const day = dayLabel(msg.createdAt, locale)
    const prevDay = prev ? dayLabel(prev.createdAt, locale) : null
    if (!prev || prevDay !== day) bubbleItems.push(<DaySeparator key={`day-${msg.id}`} label={day} />)
    const newGroup = !prev || prev.sender.id !== msg.sender.id || prevDay !== day
    bubbleItems.push(
      <Bubble
        key={msg.id}
        msg={msg}
        mine={mine}
        grouped={!newGroup}
        showName={newGroup}
        locale={locale}
        readAt={active?.lastReadAt}
        t={t}
        currentUserId={currentUserId}
        onReact={
          onReact && active
            ? (emoji) => {
                const my = msg.reactions.find((r) => r.userId === currentUserId)
                if (my) onUnreact?.(active.id, msg.id)
                else onReact(active.id, msg.id, emoji)
              }
            : undefined
        }
        onUnreact={onUnreact && active ? () => onUnreact!(active.id, msg.id) : undefined}
        onDelete={onDeleteMessage && active ? () => onDeleteMessage(active.id, msg.id) : undefined}
      />
    )
  })

  if (loading) {
    return (
      <>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="flex-1 space-y-3 px-4 py-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className={cn("h-12 w-2/3 rounded-2xl", i % 2 === 0 ? "ms-auto" : "")} />
          ))}
        </div>
        <div className="border-t border-border p-3">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </>
    )
  }

  if (!active) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={MessageSquare}
          title={t.messages.start_conversation}
          description={t.messages.no_conversations}
          className="w-full max-w-sm border-0 bg-transparent"
          action={
            <Button onClick={onNewChat}>
              <Plus className="h-4 w-4" />
              {t.messages.new_message}
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <>
      <ThreadHeader
        active={active}
        group={group}
        isOnline={isOnline}
        isTyping={isTyping}
        t={t}
        onBack={onBack}
        onInvite={onInvite}
        onLeaveGroup={onLeaveGroup}
        onArchive={onArchive}
        onDetach={onDetach}
        onCall={onCall}
      />

      <div role="log" aria-live="polite" className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1 px-3 py-4 md:px-4">
          {messages.length === 0 && (
            <div className="py-6">
              <EmptyState icon={MessageSquare} title={t.messages.start_conversation} className="border-0 bg-transparent" />
            </div>
          )}
          {bubbleItems}
          <div ref={bottomRef} className="h-px" aria-hidden />
        </div>
      </div>

      <div className="border-t border-border bg-background/50">
        <Composer
          onSend={onSend}
          sendTyping={sendTyping}
          placeholder={t.messages.type_message}
          sendLabel={t.messages.send}
          t={t}
          upload={upload}
          members={members}
        />
      </div>
    </>
  )
}