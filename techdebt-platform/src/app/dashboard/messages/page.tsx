"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { api, type OrgMember } from "@/lib/api"
import { useChat } from "@/lib/chat/chat-provider"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { ConversationList } from "@/components/chat/conversation-list"
import { Thread } from "@/components/chat/thread"
import { CallOverlay } from "@/components/chat/call-overlay"
import { InviteModal, NewConversationModal, NewGroupModal } from "@/components/chat/modals"
import { listenBroadcast } from "@/lib/chat/broadcast"
import { CHAT_DETACHED_NAME, isDetachedWindow, openDetachedChat, setDetachedWindowTitle } from "@/lib/chat/detach"

export default function MessagesPage() {
  const { token, currentOrg, user } = useAuth()
  const { t, locale } = useI18n()
  const {
    conversations,
    setConversations,
    activeId,
    setActiveId,
    active,
    setActive,
    messages,
    setMessages,
    loading,
    loadError,
    online,
    typingIn,
    lastBodies,
    reloadConversations,
    loadThread,
    sendTyping,
    send: sendChat,
    updateStatus,
    react,
    unreact,
    deleteMessage,
    toggleArchive,
  } = useChat()

  const [mobileThreadOpen, setMobileThreadOpen] = useState(false)
  const [callStart, setCallStart] = useState(false)
  const [showNewChat, setShowNewChat] = useState(() => {
    if (typeof window === "undefined") return false
    return new URLSearchParams(window.location.search).get("new") === "1"
  })
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [members, setMembers] = useState<OrgMember[]>([])

  const openNewChat = async (member: OrgMember) => {
    if (!token || !currentOrg) return
    try {
      const conv = await api.openDirect(token, currentOrg.id, member.user.id)
      setShowNewChat(false)
      setActiveId(conv.id)
      setMobileThreadOpen(true)
      setConversations((prev) => {
        if (prev.some((c) => c.id === conv.id)) return prev
        return [conv, ...prev]
      })
      await loadThread(conv.id)
    } catch { /* ignore */ }
  }

  const createGroup = async (name: string, memberIds: string[]) => {
    if (!token || !currentOrg) return
    try {
      const conv = await api.createGroup({ name, memberIds }, token, currentOrg.id)
      setShowNewGroup(false)
      setActiveId(conv.id)
      setMobileThreadOpen(true)
      setConversations((prev) => [conv, ...prev])
      await loadThread(conv.id)
    } catch { /* ignore */ }
  }

  const leaveGroup = async () => {
    if (!activeId || !token || !currentOrg) return
    await fetch(`${api.baseUrl}/organizations/${currentOrg.id}/conversations/${activeId}/members/me`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "X-Organization-Id": currentOrg.id },
    }).catch(() => {})
    setActiveId(null)
    setActive(null)
    setMessages([])
    setMobileThreadOpen(false)
    await reloadConversations()
  }

  const loadMembersOnce = useCallback(() => {
    if (!token || !currentOrg) return
    api.listMembers(token, currentOrg.id).then(setMembers).catch(() => {})
  }, [token, currentOrg])

  useEffect(() => {
    if (!token) return
    const search = new URLSearchParams(window.location.search)
    const target = search.get("c")
    if (target) {
      const timer = window.setTimeout(() => {
        setActiveId(target)
        setMobileThreadOpen(true)
        void loadThread(target)
      }, 0)
      search.delete("c")
      const qs = search.toString()
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""))
      return () => window.clearTimeout(timer)
    }
  }, [token, loadThread, setActiveId])

  useEffect(() => {
    if (isDetachedWindow()) {
      window.name = CHAT_DETACHED_NAME
      setDetachedWindowTitle(t.messages.chat_window_title)
    }
  }, [t.messages.chat_window_title])

  useEffect(() => {
    if (!token) return () => {}
    return listenBroadcast((message) => {
      if (message.type === "open-conversation" && message.conversationId) {
        setActiveId(message.conversationId)
        setMobileThreadOpen(true)
        void loadThread(message.conversationId)
      } else if (message.type === "focus") {
        window.focus()
      }
    })
  }, [token, loadThread, setActiveId])

  const group = active?.type === "GROUP"
  const partner = active?.partner
  const isOnline = partner ? online.has(partner.id) : false
  const isTyping = activeId ? typingIn.has(activeId) : false

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[480px] overflow-hidden rounded-2xl border border-border bg-card">
      <ConversationList
        conversations={conversations}
        online={online}
        lastBodies={lastBodies}
        activeId={activeId}
        loading={loading}
        loadError={loadError}
        locale={locale}
        t={t}
        me={user}
        setStatus={(dto) => void updateStatus(dto)}
        onArchive={(convId) => void toggleArchive(convId)}
        className={mobileThreadOpen ? "hidden md:flex" : undefined}
        onSelect={(id) => { setActiveId(id); setMobileThreadOpen(true) }}
        onNewChat={() => setShowNewChat(true)}
        onNewGroup={() => setShowNewGroup(true)}
        onInvite={() => setShowInvite(true)}
      />

      <section className={cn("flex min-w-0 flex-1 flex-col", (!active || !mobileThreadOpen) && "hidden md:flex")}>
        <Thread
          active={active}
          messages={messages}
          loading={loading}
          locale={locale}
          t={t}
          group={group}
          isOnline={isOnline}
          isTyping={isTyping}
          currentUserId={user?.id}
          onBack={() => setMobileThreadOpen(false)}
          onNewChat={() => setShowNewChat(true)}
          onInvite={() => setShowInvite(true)}
          onLeaveGroup={() => void leaveGroup()}
          onSend={(body, opts) => sendChat(body, opts)}
          sendTyping={(typing) => { if (activeId) sendTyping(activeId, typing) }}
          upload={
            token && currentOrg
              ? (file) => api.uploadFile(token, currentOrg.id, file).catch(() => null)
              : undefined
          }
          members={members}
          onReact={react}
          onUnreact={unreact}
          onDeleteMessage={deleteMessage}
          onArchive={activeId ? () => void toggleArchive(activeId) : undefined}
          onDetach={() => void openDetachedChat()}
          onCall={group || !partner ? undefined : () => setCallStart(true)}
        />
      </section>

      {showNewChat && (
        <NewConversationModal
          members={members}
          onClose={() => setShowNewChat(false)}
          onPick={openNewChat}
          onLoadMembers={loadMembersOnce}
          t={t}
        />
      )}

      {showNewGroup && (
        <NewGroupModal
          members={members}
          onClose={() => setShowNewGroup(false)}
          onCreate={createGroup}
          onLoadMembers={loadMembersOnce}
          t={t}
        />
      )}

      {showInvite && token && currentOrg && (
        <InviteModal token={token} orgId={currentOrg.id} onClose={() => setShowInvite(false)} t={t} />
      )}

      <CallOverlay
        peer={partner}
        conversationId={group ? null : activeId}
        start={callStart}
        onSettled={() => setCallStart(false)}
      />
    </div>
  )
}