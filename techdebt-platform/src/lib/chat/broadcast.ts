/**
 * BroadcastChannel helper used to keep the in-app floating chat dock and the
 * detached browser window in sync (Phase 6). All chat state still lives in the
 * single ChatProvider instance on each side; this channel only forwards coarse
 * navigation/intent signals across tabs/windows.
 */

export const CHAT_CHANNEL = "techdebt:chat:v1"

export type BroadcastMessage =
  | { type: "open-conversation"; conversationId: string }
  | { type: "request-detach" }
  | { type: "focus" }
  | { type: "presence"; event: string; payload: unknown }

export function broadcastMessage(message: BroadcastMessage): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return
  const channel = new BroadcastChannel(CHAT_CHANNEL)
  channel.postMessage(message)
  channel.close()
}

/** Returns an unsubscribe function. Safe to call on the server / older browsers. */
export function listenBroadcast(handler: (message: BroadcastMessage) => void): () => void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return () => {}
  }
  const channel = new BroadcastChannel(CHAT_CHANNEL)
  channel.onmessage = (event) => {
    try {
      handler(event.data as BroadcastMessage)
    } catch {
      /* never let a bad message break the app */
    }
  }
  return () => channel.close()
}