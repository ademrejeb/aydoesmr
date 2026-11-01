/**
 * Tiny class-name joiner.
 *
 * Deliberately duplicated instead of imported from `@/lib/utils` so this folder
 * can be lifted out of the app and shipped as a dependency (Storybook / npm)
 * without dragging the application's `@` aliases with it.
 */
export type ClassValue = string | number | boolean | undefined | null | ClassValue[]

export function cn(...inputs: ClassValue[]): string {
  const flat: string[] = []
  for (const input of inputs) {
    if (!input) continue
    if (Array.isArray(input)) {
      const inner = cn(...input)
      if (inner) flat.push(inner)
    } else if (typeof input === "string") {
      flat.push(input)
    }
  }
  return flat.join(" ")
}