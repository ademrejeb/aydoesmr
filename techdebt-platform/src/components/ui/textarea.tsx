import * as React from "react"
import { cn } from "./cn"

type IconComponent = React.ComponentType<{ className?: string }>

const wrapperBase =
  "relative flex w-full items-start rounded-lg border border-input bg-card shadow-xs transition-shadow " +
  "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25 " +
  "data-[invalid=true]:border-danger data-[invalid=true]:focus-within:ring-danger/25 " +
  "has-[:disabled]:opacity-50"

const sizes = {
  sm: "min-h-[5.5rem]",
  md: "min-h-[7.5rem]",
  lg: "min-h-[11rem]",
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Icon rendered on the leading edge of the *first line*; the text is padded automatically. */
  icon?: IconComponent
  invalid?: boolean
  /** Control height preset. Defaults to `md`. */
  size?: keyof typeof sizes
  /** Extra classes for the wrapper. */
  wrapperClassName?: string
}

/**
 * Multi-line text control sharing the visual language of {@link Input}.
 * Monospace via `className="font-mono code-textarea"` for code payloads.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { icon: Icon, invalid, className, wrapperClassName, size = "md", rows = 4, ...props },
  ref
) {
  return (
    <div
      className={cn(wrapperBase, sizes[size], wrapperClassName)}
      data-invalid={invalid ? "true" : undefined}
      data-slot="textarea-wrapper"
    >
      {Icon ? (
        <Icon className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-muted-foreground/70" />
      ) : null}
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={invalid || undefined}
        className={cn(
          "w-full resize-y rounded-[inherit] border-0 bg-transparent py-2.5 pe-3 text-sm leading-6 " +
            "text-foreground placeholder:text-muted-foreground/80 outline-none disabled:cursor-not-allowed",
          Icon ? "ps-9" : "ps-3",
          className
        )}
        {...props}
      />
    </div>
  )
})