"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, PhoneIncoming } from "lucide-react"
import type { AuthUser } from "@/lib/api"
import { useChat } from "@/lib/chat/chat-provider"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

type CallState = "idle" | "outgoing" | "ringing" | "incoming" | "active" | "ended"

const iceServers = (() => {
  const servers: RTCIceServer[] = []
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_STUN_URL) servers.push({ urls: process.env.NEXT_PUBLIC_STUN_URL })
  return servers
})()

function cleanup(pc: RTCPeerConnection | null, stream: MediaStream | null): void {
  try {
    pc?.close()
  } catch {
    /* ignore */
  }
  stream?.getTracks().forEach((track) => track.stop())
}

/**
 * 1:1 WebRTC call for a DIRECT conversation (Phase 7). Media flows peer-to-peer;
 * the socket only relays SDP/ICE between the two members.
 */
export function CallOverlay({
  peer,
  conversationId,
  start = false,
  onSettled,
}: {
  peer?: AuthUser | null
  conversationId?: string | null
  start?: boolean
  onSettled?: () => void
}) {
  const { t } = useI18n()
  const { subscribe, emit } = useChat()

  const [state, setState] = useState<CallState>("idle")
  const [muted, setMuted] = useState(false)
  const [videoOff, setVideoOff] = useState(false)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  const peerId = peer?.id
  const convId = conversationId

  const stopCall = useCallback(
    (from: "self" | "peer") => {
      cleanup(pcRef.current, localStreamRef.current)
      pcRef.current = null
      localStreamRef.current = null
      if (from === "self" && peerId && convId) emit("call:end", { conversationId: convId, to: peerId })
      setMuted(false)
      setVideoOff(false)
      setState("ended")
      onSettled?.()
      window.setTimeout(() => setState((s) => (s === "ended" ? "idle" : s)), 1800)
    },
    [emit, peerId, convId, onSettled]
  )

  const attachLocal = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
        void localVideoRef.current.play().catch(() => {})
      }
      return stream
    } catch {
      setState("idle")
      return null
    }
  }, [])

  const startPeerConnection = useCallback(
    (stream: MediaStream, onSignal: (event: string, payload: unknown) => void) => {
      const pc = new RTCPeerConnection({ iceServers: iceServers.length ? iceServers : undefined })
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))
      pc.onicecandidate = (e) => {
        if (e.candidate && peerId && convId) onSignal("call:ice", { conversationId: convId, to: peerId, candidate: e.candidate })
      }
      pc.ontrack = (e) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0]
          void remoteVideoRef.current.play().catch(() => {})
          setState((s) => (s === "ringing" || s === "incoming" ? "active" : s))
        }
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") stopCall("self")
        if (pc.connectionState === "closed") cleanup(pc, null)
      }
      return pc
    },
    [peerId, convId, stopCall]
  )

  const offerRef = useRef<unknown | null>(null)
  const callerRef = useRef<string | null>(null)

  // Outgoing call
  const startCall = useCallback(async () => {
    if (!peerId || !convId) return
    setState("outgoing")
    const stream = await attachLocal()
    if (!stream || !peerId || !convId) return
    const pc = startPeerConnection(stream, (event, payload) => emit(event, payload))
    pcRef.current = pc
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      emit("call:offer", { conversationId: convId, to: peerId, offer })
      setState("ringing")
    } catch {
      stopCall("self")
    }
  }, [peerId, convId, attachLocal, startPeerConnection, emit, stopCall])

  // Incoming call
  const acceptCall = useCallback(async () => {
    const offerPayload = offerRef.current
    const fromId = callerRef.current
    if (!offerPayload || !fromId || !convId) return
    setState("incoming")
    const stream = await attachLocal()
    if (!stream || !convId) return
    const pc = startPeerConnection(stream, (event, payload) => emit(event, payload))
    pcRef.current = pc
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offerPayload as RTCSessionDescriptionInit))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      emit("call:answer", { conversationId: convId, to: fromId, answer })
    } catch {
      stopCall("self")
    }
  }, [convId, attachLocal, startPeerConnection, emit, stopCall])

  const declineCall = useCallback(() => {
    setState("idle")
    onSettled?.()
  }, [onSettled])

  // Socket signal listeners
  useEffect(() => {
    if (!convId) return () => {}
    const offIncoming = subscribe("call:incoming", (payload: { conversationId: string; from: string; offer: unknown }) => {
      if (payload.conversationId !== convId) return
      offerRef.current = payload.offer
      callerRef.current = payload.from
      setState("incoming")
    })
    const offAnswered = subscribe("call:answered", (payload: { from: string; answer: unknown }) => {
      if (!pcRef.current) return
      try {
        void pcRef.current.setRemoteDescription(
          new RTCSessionDescription(payload.answer as RTCSessionDescriptionInit)
        )
        setState("active")
      } catch {
        /* ignore */
      }
    })
    const offIce = subscribe("call:ice", (payload: { from: string; candidate: unknown }) => {
      if (!pcRef.current) return
      try {
        void pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate as RTCIceCandidateInit))
      } catch {
        /* ignore */
      }
    })
    const offEnded = subscribe("call:ended", () => stopCall("peer"))
    return () => {
      offIncoming()
      offAnswered()
      offIce()
      offEnded()
    }
  }, [convId, peer, subscribe, stopCall])

  // Start an outgoing call when the caller presses the call button
  useEffect(() => {
    if (!(start && convId && peerId && state === "idle")) return () => {}
    const timer = window.setTimeout(() => void startCall(), 0)
    return () => window.clearTimeout(timer)
  }, [start, convId, peerId, state, startCall])

  // Tear down when leaving the conversation or unmounting
  useEffect(() => {
    if (!convId) return cleanup(pcRef.current, localStreamRef.current)
    return () => {}
  }, [convId])

  useEffect(() => () => cleanup(pcRef.current, localStreamRef.current), [])

  // Mark settled whenever the call drops back to idle so the parent re-arms
  useEffect(() => {
    if (state === "idle") onSettled?.()
  }, [state, onSettled])

  const toggleMute = () => {
    setMuted((v) => {
      localStreamRef.current?.getAudioTracks().forEach((track) => (track.enabled = v))
      return !v
    })
  }

  const toggleVideo = () => {
    setVideoOff((v) => {
      localStreamRef.current?.getVideoTracks().forEach((track) => (track.enabled = v))
      return !v
    })
  }

  if (state === "idle" || !convId) return null

  const title = peer?.fullName ?? peer?.email ?? t.messages.chat_window_title

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.messages.incoming_call}
      className="fixed inset-0 z-call flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="relative aspect-video bg-black">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={state === "outgoing" || state === "ringing"}
            className="h-full w-full object-cover"
          />
          {(state === "outgoing" || state === "ringing") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 text-white">
              <Avatar name={title} size="lg" />
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-white/70">{t.messages.calling}</p>
              <span className="flex gap-1" aria-hidden>
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:120ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:240ms]" />
              </span>
            </div>
          )}
          {state === "ended" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
              <p className="text-sm font-semibold">{t.messages.call_ended}</p>
            </div>
          )}
          {(state === "active" || state === "incoming") && (
            <div className="absolute bottom-3 start-3 flex items-center gap-2 text-white">
              {state === "incoming" ? <PhoneIncoming className="h-4 w-4" /> : null}
              <span className="text-xs font-semibold">{title}</span>
            </div>
          )}
          {(state === "active" || state === "outgoing" || state === "ringing") && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-3 end-3 h-24 w-32 rounded-lg border border-white/30 object-cover"
            />
          )}
        </div>

        <div className="flex items-center justify-center gap-3 p-4">
          {state === "incoming" ? (
            <>
              <Button
                variant="default"
                className="gap-2"
                onClick={() => void acceptCall()}
              >
                <Phone className="h-4 w-4" />
                {t.messages.accept}
              </Button>
              <Button variant="destructive" className="gap-2" onClick={declineCall}>
                <PhoneOff className="h-4 w-4" />
                {t.messages.decline}
              </Button>
            </>
          ) : state === "active" ? (
            <>
              <CallControl
                label={t.messages.mute_mic}
                icon={muted ? MicOff : Mic}
                active={muted}
                onClick={toggleMute}
              />
              <CallControl
                label={t.messages.mute_video}
                icon={videoOff ? VideoOff : Video}
                active={videoOff}
                onClick={toggleVideo}
              />
              <Button
                variant="destructive"
                className="gap-2"
                onClick={() => stopCall("self")}
                aria-label={t.messages.end_call}
              >
                <PhoneOff className="h-4 w-4" />
                {t.messages.end_call}
              </Button>
            </>
          ) : (
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => stopCall("self")}
              aria-label={t.messages.end_call}
            >
              <PhoneOff className="h-4 w-4" />
              {t.messages.end_call}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function CallControl({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  icon: typeof Mic
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn("h-11 w-11", active && "bg-destructive text-white hover:bg-destructive/90 hover:text-white")}
    >
      <Icon className="h-5 w-5" />
    </Button>
  )
}