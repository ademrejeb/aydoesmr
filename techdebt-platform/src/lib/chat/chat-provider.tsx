"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
import { io, type Socket } from "socket.io-client"
import { api, wsOrigin, type AuthUser, type Conversation, type Message } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n"

export interface SendMessageOptions {
  kind?: string
  mediaUrl?: string
  mediaWidth?: number
  mediaHeight?: number
  mimeType?: string
  attachmentId?: string
  mentions?: string[]
}

export function previewFor(
  msg: Message,
  t: { messages: { sticker: string; gif: string; attachment: string } }
): string {
  if (msg.kind === "STICKER") return t.messages.sticker
  if (msg.kind === "GIPHY") return t.messages.gif
  if (msg.kind === "ATTACHMENT") return msg.attachment?.name ?? t.messages.attachment
  return msg.body
}

export interface ChatContextValue {
  conversations: Conversation[]
  setConversations: Dispatch<SetStateAction<Conversation[]>>
  activeId: string | null
  setActiveId: (id: string | null) => void
  active: Conversation | null
  setActive: Dispatch<SetStateAction<Conversation | null>>
  messages: Message[]
  setMessages: Dispatch<SetStateAction<Message[]>>
  loading: boolean
  loadError: string | null
  online: Set<string>
  typingIn: Set<string>
  lastBodies: Record<string, string>
  unread: number
  reloadConversations: () => Promise<void>
  loadThread: (convId: string) => Promise<void>
  markRead: (convId: string) => Promise<void>
  updateStatus: (dto: { status?: string; statusNote?: string | null; statusUntil?: string | null }) => Promise<void>
  react: (convId: string, messageId: string, emoji: string) => Promise<void>
  unreact: (convId: string, messageId: string) => Promise<void>
  deleteMessage: (convId: string, messageId: string) => Promise<void>
  toggleArchive: (convId: string) => Promise<void>
  send: (body: string, opts?: SendMessageOptions) => Promise<void>
  sendTyping: (convId: string, typing: boolean) => void
  /** Subscribe to any event pushed on the shared socket. Returns an unsubscribe fn. */
  subscribe: <T>(event: string, handler: (payload: T) => void) => () => void
  /** Fire an event on the shared socket (used for WebRTC call signaling). */
  emit: (event: string, payload?: unknown) => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

/**
 * Owns the single Socket.IO connection for the whole dashboard plus the chat
 * data (conversations, active thread, presence, typing, unread counts).
 *
 * Everything that renders chat — the messages page, the floating dock, the
 * pop-out window and the nav unread badge — reads from here so there is exactly
 * one connection and one source of truth.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const { token, currentOrg, user } = useAuth()
  const { t } = useI18n()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveIdState] = useState<string | null>(null)
  const [active, setActive] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [online, setOnline] = useState<Set<string>>(new Set())
  const [typingIn, setTypingIn] = useState<Set<string>>(new Set())
  const [lastBodies, setLastBodies] = useState<Record<string, string>>({})

  const socketRef = useRef<Socket | null>(null)
  const activeRef = useRef<string | null>(null)
  const listenersRef = useRef<Map<string, Set<(payload: unknown) => void>>>(new Map())

  useEffect(() => {
    activeRef.current = activeId
  }, [activeId])

  const setActiveId = useCallback((id: string | null) => setActiveIdState(id), [])

  const subscribe = useCallback(<T,>(event: string, handler: (payload: T) => void) => {
    let set = listenersRef.current.get(event)
    if (!set) {
      set = new Set()
      listenersRef.current.set(event, set)
    }
    const wrapped = handler as (payload: unknown) => void
    set.add(wrapped)
    return () => {
      set?.delete(wrapped)
    }
  }, [])

  const dispatch = useCallback((event: string, payload: unknown) => {
    listenersRef.current.get(event)?.forEach((handler) => {
      try {
        handler(payload)
      } catch {
        /* a bad listener must not break the socket */
      }
    })
  }, [])

  const emit = useCallback((event: string, payload?: unknown) => {
    socketRef.current?.emit(event, payload)
  }, [])

  const markRead = useCallback(
    async (convId: string) => {
      if (!token || !currentOrg) return
      api
        .markConversationRead(token, currentOrg.id, convId)
        .then(() => {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convId ? { ...c, unreadCount: 0, lastReadAt: new Date().toISOString() } : c
            )
          )
        })
        .catch(() => {})
    },
    [token, currentOrg]
  )

  const reloadConversations = useCallback(async () => {
    if (!token || !currentOrg) return
    try {
      const convs = await api.listConversations(token, currentOrg.id)
      setConversations(convs)
      setLoadError(null)
      if (!activeRef.current && convs.length > 0) setActiveIdState(convs[0].id)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t.errors.network_error)
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg, t.errors.network_error])

  const loadThread = useCallback(
    async (convId: string) => {
      if (!token || !currentOrg) return
      try {
        const [detail, msgs] = await Promise.all([
          api.getConversation(token, currentOrg.id, convId),
          api.listMessages(token, currentOrg.id, convId),
        ])
        setActive(detail)
        setMessages(msgs)
        if (msgs.length > 0) {
          setLastBodies((prev) => ({ ...prev, [convId]: previewFor(msgs[msgs.length - 1], t) }))
        }
        if (detail.unreadCount > 0) markRead(convId)
      } catch {
        /* ignore */
      }
    },
    [token, currentOrg, markRead, t]
  )

  useEffect(() => {
    if (!token || !currentOrg) return
    const timer = window.setTimeout(() => {
      void reloadConversations()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [token, currentOrg, reloadConversations])

  useEffect(() => {
    if (!activeId) return
    const timer = window.setTimeout(() => {
      void loadThread(activeId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [activeId, loadThread])

  // Shared socket ----------------------------------------------------------------
  useEffect(() => {
    if (!token || !currentOrg) return
    const socket = io(wsOrigin(), {
      auth: { token, organizationId: currentOrg.id },
      transports: ["websocket"],
    })
    socketRef.current = socket

    socket.on("message:new", (payload: { conversationId: string; message: Message; senderId: string }) => {
      const { conversationId, message } = payload
      const mine = message.sender.id === user?.id
      if (!mine) setLastBodies((prev) => ({ ...prev, [conversationId]: previewFor(message, t) }))
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conversationId)
        if (idx === -1) return prev
        const next = [...prev]
        const [item] = next.splice(idx, 1)
        next.unshift({
          ...item,
          lastMessageAt: message.createdAt,
          unreadCount:
            activeRef.current === conversationId || mine ? 0 : item.unreadCount + 1,
        })
        return next
      })
      if (activeRef.current === conversationId && !mine) {
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
      }
      dispatch("message:new", payload)
    })

    socket.on("message:updated", (payload: { conversationId: string; message: Message }) => {
      const { conversationId, message } = payload
      setMessages((prev) =>
        prev.some((m) => m.id === message.id)
          ? prev.map((m) => (m.id === message.id ? message : m))
          : prev
      )
      setLastBodies((prev) =>
        prev[conversationId] ? { ...prev, [conversationId]: previewFor(message, t) } : prev
      )
      dispatch("message:updated", payload)
    })

    socket.on(
      "conversation:archived",
      (payload: { conversationId: string; archived: boolean }) => {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === payload.conversationId
              ? { ...c, archived: payload.archived, archivedAt: payload.archived ? new Date().toISOString() : null }
              : c
          )
        )
        dispatch("conversation:archived", payload)
      }
    )

    socket.on("typing", (payload: { conversationId: string; userId: string; typing: boolean }) => {
      if (payload.userId !== user?.id) {
        setTypingIn((prev) => {
          const next = new Set(prev)
          if (payload.typing) next.add(payload.conversationId)
          else next.delete(payload.conversationId)
          return next
        })
      }
      dispatch("typing", payload)
    })

    socket.on("presence", (payload: { userId: string; online: boolean }) => {
      setOnline((prev) => {
        const next = new Set(prev)
        if (payload.online) next.add(payload.userId)
        else next.delete(payload.userId)
        return next
      })
      dispatch("presence", payload)
    })

    socket.on("conversation:new", (payload: unknown) => {
      void reloadConversations()
      dispatch("conversation:new", payload)
    })

    socket.on("message:read", (payload: unknown) => dispatch("message:read", payload))

    socket.on(
      "user:status",
      (payload: { organizationId?: string; userId: string; status: string; statusNote: string | null; statusUntil: string | null; lastSeenAt: string | null }) => {
        setConversations((prev) =>
          prev.map((c) => {
            const patch = (u: AuthUser | null | undefined): AuthUser | null | undefined =>
              u && u.id === payload.userId
                ? { ...u, status: payload.status, statusNote: payload.statusNote, statusUntil: payload.statusUntil, lastSeenAt: payload.lastSeenAt }
                : u
            const partner = patch(c.partner)
            const members = c.members.map((m) => (m.user.id === payload.userId ? { ...m, user: patch(m.user)! } : m))
            if (!partner && !c.members.some((m) => m.user.id === payload.userId)) return c
            return { ...c, partner: partner ?? c.partner, members }
          })
        )
        dispatch("user:status", payload)
      }
    )

    socket.on("notification", (payload: unknown) => dispatch("notification", payload))
    socket.on("task:updated", (payload: unknown) => dispatch("task:updated", payload))

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token, currentOrg, user?.id, reloadConversations, dispatch, t])

  const sendTyping = useCallback(
    (convId: string, typing: boolean) => {
      if (!token || !currentOrg) return
      void api.sendTyping(token, currentOrg.id, convId, typing).catch(() => {})
    },
    [token, currentOrg]
  )

  const send = useCallback(
    async (body: string, opts?: SendMessageOptions) => {
      const trimmed = body.trim()
      const hasAttachment = Boolean(opts?.attachmentId)
      if ((!trimmed && !hasAttachment) || !activeRef.current || !token || !currentOrg) return
      const convId = activeRef.current
      try {
        const msg = await api.sendMessage(token, currentOrg.id, convId, hasAttachment ? body : trimmed, opts)
        setMessages((prev) => [...prev, msg])
        setLastBodies((prev) => ({ ...prev, [convId]: previewFor(msg, t) }))
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === convId)
          if (idx === -1) return prev
          const next = [...prev]
          const [item] = next.splice(idx, 1)
          next.unshift({ ...item, lastMessageAt: msg.createdAt })
          return next
        })
      } catch {
        /* ignore */
      }
    },
    [token, currentOrg, t]
  )

  const updateStatus = useCallback(
    async (dto: { status?: string; statusNote?: string | null; statusUntil?: string | null }) => {
      if (!token || !currentOrg) return
      try {
        await api.updateStatus(token, currentOrg.id, dto)
      } catch {
        /* the socket echo will not have fired; ignore */
      }
    },
    [token, currentOrg]
  )

  const unread = useMemo(
    () => conversations.reduce((n, c) => n + (c.unreadCount ?? 0), 0),
    [conversations]
  )

  const react = useCallback(
    async (convId: string, messageId: string, emoji: string) => {
      if (!token || !currentOrg) return
      try {
        await api.addReaction(token, currentOrg.id, convId, messageId, emoji)
      } catch {
        /* server broadcast will correct out of sync views */
      }
    },
    [token, currentOrg]
  )

  const unreact = useCallback(
    async (convId: string, messageId: string) => {
      if (!token || !currentOrg) return
      try {
        await api.removeReaction(token, currentOrg.id, convId, messageId)
      } catch {
        /* ignore */
      }
    },
    [token, currentOrg]
  )

  const deleteMessage = useCallback(
    async (convId: string, messageId: string) => {
      if (!token || !currentOrg) return
      try {
        await api.deleteMessage(token, currentOrg.id, convId, messageId)
      } catch {
        /* ignore */
      }
    },
    [token, currentOrg]
  )

  const toggleArchive = useCallback(
    async (convId: string) => {
      if (!token || !currentOrg) return
      const target = conversations.find((c) => c.id === convId)
      if (!target) return
      try {
        await api.setConversationArchived(token, currentOrg.id, convId, !target.archived)
      } catch {
        /* ignore */
      }
    },
    [token, currentOrg, conversations]
  )

  const value = useMemo<ChatContextValue>(
    () => ({
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
      unread,
      reloadConversations,
      loadThread,
      markRead,
      updateStatus,
      react,
      unreact,
      deleteMessage,
      toggleArchive,
      send,
      sendTyping,
      subscribe,
      emit,
    }),
    [
      conversations,
      activeId,
      setActiveId,
      active,
      messages,
      loading,
      loadError,
      online,
      typingIn,
      lastBodies,
      unread,
      reloadConversations,
      loadThread,
      markRead,
      updateStatus,
      react,
      unreact,
      deleteMessage,
      toggleArchive,
      send,
      sendTyping,
      subscribe,
      emit,
    ]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error("useChat must be used within a ChatProvider")
  return ctx
}

/** Non-throwing variant for components that may render outside a provider. */
export function useOptionalChat(): ChatContextValue | null {
  return useContext(ChatContext)
}
