"use client"

import { Archive, ArrowLeft, ExternalLink, LogOut, MoreVertical, Phone, RotateCcw, UserPlus } from "lucide-react"
import type { Conversation } from "@/lib/api"
import { type Dictionary } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dropdown, DropdownHeader, DropdownItem } from "@/components/ui/dropdown"
import { Tooltip } from "@/components/ui/tooltip"
import { MemberStack, TypingDots } from "@/components/chat/message-bubble"

function statusLabel(status: string | null, t: Dictionary): string {
  switch (status) {
    case "AWAY":
      return t.messages.status_away
    case "BUSY":
      return t.messages.status_busy
    case "OFFLINE":
      return t.messages.status_offline
    default:
      return t.messages.status_available
  }
}

export function StatusLine({ active, isOnline, t }: { active: Conversation; isOnline: boolean; t: Dictionary }) {
  const status = active.partner?.status ?? "ACTIVE"
  const note = active.partner?.statusNote
  const color =
    status === "BUSY" ? "bg-destructive" : status === "AWAY" ? "bg-warning" : isOnline ? "bg-success" : "bg-muted"
  const dot = active.partner?.id && isOnline ? color : status === "OFFLINE" ? "bg-muted" : color
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} aria-hidden />
      {isOnline ? (
        <span className="font-medium text-success">{t.messages.online}</span>
      ) : (
        <span>{statusLabel(status, t)}</span>
      )}
      {note ? (
        <span className="hidden max-w-[220px] truncate sm:inline" title={note}>
          — {note}
        </span>
      ) : null}
    </span>
  )
}

export function ThreadHeader({
  active,
  group,
  isOnline,
  isTyping,
  t,
  onBack,
  onInvite,
  onLeaveGroup,
  onArchive,
  onDetach,
  onCall,
}: {
  active: Conversation
  group: boolean
  isOnline: boolean
  isTyping: boolean
  t: Dictionary
  onBack: () => void
  onInvite: () => void
  onLeaveGroup: () => void
  onArchive?: () => void
  onDetach?: () => void
  onCall?: () => void
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5 md:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 md:hidden"
        onClick={onBack}
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
      </Button>
      <Avatar name={active.name} size="sm" src={active.type === "DIRECT" ? active.partner?.avatarUrl : undefined} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold">{active.name}</p>
          {isTyping && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
              <TypingDots />
              <span className="hidden sm:inline">{t.messages.typing}</span>
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          {group ? (
            <>
              <MemberStack members={active.members} />
              <span>
                {active.members.length} {t.messages.members}
              </span>
            </>
          ) : (
            <StatusLine active={active} isOnline={isOnline} t={t} />
          )}
        </div>
      </div>
      {onCall && !group && (
        <Tooltip tip={t.messages.call}>
          <Button variant="ghost" size="icon" onClick={onCall} aria-label={t.messages.call}>
            <Phone className="h-4 w-4" />
          </Button>
        </Tooltip>
      )}
      {onDetach && (
        <Tooltip tip={t.messages.open_chat_window}>
          <Button variant="ghost" size="icon" onClick={onDetach} aria-label={t.messages.open_chat_window}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </Tooltip>
      )}
      {onArchive && (
        <Tooltip tip={active.archived ? t.messages.unarchive_conversation : t.messages.archive_conversation}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onArchive}
            aria-label={active.archived ? t.messages.unarchive_conversation : t.messages.archive_conversation}
            className={active.archived ? "text-primary" : undefined}
          >
            {active.archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </Button>
        </Tooltip>
      )}
      {group && (
        <Dropdown
          align="end"
          width="w-56"
          trigger={(open, toggle) => (
            <Tooltip tip={t.platform.menu}>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                aria-label={t.platform.menu}
                aria-expanded={open}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </Tooltip>
          )}
        >
          {(close) => (
            <>
              <DropdownHeader>
                <p className="text-xs font-medium text-muted-foreground">
                  {active.members.length} {t.messages.members}
                </p>
              </DropdownHeader>
              <DropdownItem
                icon={<UserPlus className="h-4 w-4" />}
                onClick={() => { close(); onInvite() }}
              >
                {t.messages.add_member}
              </DropdownItem>
              <DropdownItem
                danger
                icon={<LogOut className="h-4 w-4" />}
                onClick={() => { close(); onLeaveGroup() }}
              >
                {t.messages.leave_group}
              </DropdownItem>
            </>
          )}
        </Dropdown>
      )}
    </div>
  )
}