/**
 * Detached chat window helpers (Phase 6). The floating dock opens the full
 * messages page in a small named browser window; both the dock and the pop-out
 * talk over the BroadcastChannel in ./broadcast.ts so navigation intent (open
 * a conversation, focus, detach/attach) stays in sync without shared state.
 */

export const CHAT_DETACHED_NAME = "techdebt-detached-chat"
export const CHAT_DETACHED_FEATURES = "width=460,height=720,resizable=yes,scrollbars=yes"

export function isDetachedWindow(): boolean {
  if (typeof window === "undefined") return false
  return window.name === CHAT_DETACHED_NAME || new URLSearchParams(window.location.search).get("pop") === "1"
}

/**
 * Opens (or focuses) the detached chat window. Returns the window handle or
 * null when the browser blocked the popup.
 */
export function openDetachedChat(): Window | null {
  if (typeof window === "undefined") return null
  let handle: Window | null = null
  try {
    handle = window.open(
      `/dashboard/messages?pop=${Date.now()}`,
      CHAT_DETACHED_NAME,
      CHAT_DETACHED_FEATURES
    )
  } catch {
    return null
  }
  return handle
}

/** Names the detached window and gives it an identifiable title. */
export function setDetachedWindowTitle(title: string): void {
  if (typeof document === "undefined") return
  document.title = title
  document.documentElement.dataset.detached = "true"
}