/**
 * Self-contained UI primitives.
 *
 * Everything in this folder is dependency-light and free of app-level `@/`
 * imports, so it can be extracted into a package (Storybook + npm) later
 * without rewrites. Import from `@/components/ui` in the app:
 *
 *   import { Input, Field, Select, Textarea, Button } from "@/components/ui"
 */
export { cn } from "./cn"
export type { ClassValue } from "./cn"

export { Field } from "./field"
export type { FieldProps } from "./field"

export { Input } from "./input"
export type { InputProps } from "./input"

export { Textarea } from "./textarea"
export type { TextareaProps } from "./textarea"

export { Select } from "./select"
export type { SelectProps } from "./select"

export { Button } from "./button"
export { Badge } from "./badge"
export { Card, CardContent } from "./card"
export { Modal } from "./modal"
export { Skeleton } from "./skeleton"
export { EmptyState } from "./empty-state"
export { Avatar } from "./avatar"
export { Dropdown, DropdownItem, DropdownHeader, DropdownFooter } from "./dropdown"
export { Tooltip } from "./tooltip"
export { StatCard } from "./stat-card"
export { ThemeToggle } from "./theme-toggle"