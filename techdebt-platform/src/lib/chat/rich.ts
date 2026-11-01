/**
 * Bundled rich-message assets for chat: an emoji set, a small bundled sticker
 * pack (emoji-based, no external assets) and a real Giphy search helper.
 */

export const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? ""

export const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😅", "😉", "🙂",
  "😍", "😘", "😜", "🤪", "😎", "🤓", "🥳", "😏",
  "😢", "😭", "😤", "😡", "🤯", "😱", "😴", "🤔",
  "🤗", "🤫", "😇", "🙄", "😬", "🥰", "😌", "🥲",
  "👍", "👎", "👏", "🙌", "🙏", "💪", "🤝", "✌️",
  "👌", "🤌", "🫶", "❤️", "💔", "🔥", "⭐", "✨",
  "🎉", "🎊", "🎁", "🚀", "☕", "🍕", "🌙", "☀️",
] as const

export interface Sticker {
  id: string
  emoji: string
  label: string
  bg: string
}

export const STICKERS: Sticker[] = [
  { id: "wave", emoji: "👋", label: "Wave", bg: "bg-sky-500/15" },
  { id: "love", emoji: "❤️", label: "Love", bg: "bg-rose-500/15" },
  { id: "lol", emoji: "😂", label: "LOL", bg: "bg-amber-500/15" },
  { id: "thumbs-up", emoji: "👍", label: "Thumbs up", bg: "bg-emerald-500/15" },
  { id: "fire", emoji: "🔥", label: "Fire", bg: "bg-orange-500/15" },
  { id: "party", emoji: "🥳", label: "Party", bg: "bg-fuchsia-500/15" },
  { id: "ok", emoji: "👌", label: "OK", bg: "bg-teal-500/15" },
  { id: "clap", emoji: "👏", label: "Clap", bg: "bg-amber-500/15" },
  { id: "rocket", emoji: "🚀", label: "Rocket", bg: "bg-indigo-500/15" },
  { id: "coffee", emoji: "☕", label: "Coffee", bg: "bg-stone-500/15" },
  { id: "thinking", emoji: "🤔", label: "Thinking", bg: "bg-slate-400/15" },
  { id: "cool", emoji: "😎", label: "Cool", bg: "bg-cyan-500/15" },
  { id: "cry", emoji: "😭", label: "Crying", bg: "bg-blue-500/15" },
  { id: "pray", emoji: "🙏", label: "Thanks", bg: "bg-violet-500/15" },
]

export function stickerById(id: string): Sticker | undefined {
  return STICKERS.find((s) => s.id === id)
}

export interface GifResult {
  url: string
  width: number
  height: number
  title: string
}

/** True if the trimmed body is a single emoji (render it large). */
export function singleEmoji(body: string): string | null {
  const m = body.trim().match(/^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})+?|\p{Extended_Pictographic}+?[\uFE0F\u200D]?|\p{Extended_Pictographic})$/u)
  return m ? m[1] : null
}

export async function giphySearch(query: string): Promise<GifResult[]> {
  if (!GIPHY_API_KEY) return []
  const url = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(GIPHY_API_KEY)}&q=${encodeURIComponent(query)}&limit=24&rating=g`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = (await res.json()) as {
    data?: { images?: { downsized_medium?: { url?: string; width?: string; height?: string } }; title?: string }[]
  }
  return (data.data ?? [])
    .map((g) => {
      const img = g.images?.downsized_medium
      if (!img?.url) return null
      return {
        url: img.url,
        width: parseInt(img.width ?? "0", 10) || 0,
        height: parseInt(img.height ?? "0", 10) || 0,
        title: g.title ?? "",
      }
    })
    .filter((g): g is GifResult => g !== null)
}