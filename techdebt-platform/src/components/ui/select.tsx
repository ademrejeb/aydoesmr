import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "./cn"

type IconComponent = React.ComponentType<{ className?: string }>

const wrapperBase =
  "relative flex w-full items-center rounded-lg border border-input bg-card shadow-xs transition-shadow " +
  "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25 " +
  "data-[invalid=true]:border-danger data-[invalid=true]:focus-within:ring-danger/25 " +
  "has-[:disabled]:opacity-50"

const sizes = {
  sm: "h-8 [&_select]:text-[13px]",
  md: "h-10",
  lg: "h-11",
}

const leadingPadding = { sm: "ps-8", md: "ps-9", lg: "ps-10" }
const iconSize = { sm: "h-3.5 w-3.5 start-2.5", md: "h-4 w-4 start-3", lg: "h-4 w-4 start-3.5" }
const chevronSize = { sm: "end-2.5 h-3.5 w-3.5", md: "end-3 h-4 w-4", lg: "end-3 h-4 w-4" }

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  /** Icon rendered on the leading edge. The selected text is padded automatically. */
  icon?: IconComponent
  invalid?: boolean
  /** Control height. Defaults to `md`. */
  size?: "sm" | "md" | "lg"
  /** Extra classes for the *control*. */
  className?: string
  /** Extra classes for the wrapper. */
  wrapperClassName?: string
}

/**
 * Native `<select>` — keeps every platform behaviour (keyboard, mobile picker,
 * RTL) while matching {@link Input} visually. A chevron is rendered by us, so
 * the native arrow is hidden with `appearance-none`.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { icon: Icon, invalid, size = "md", className, wrapperClassName, children, ...props },
  ref
) {
  return (
    <div
      className={cn(wrapperBase, sizes[size], wrapperClassName)}
      data-invalid={invalid ? "true" : undefined}
      data-slot="select-wrapper"
    >
      {Icon ? (
        <Icon
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground/70",
            iconSize[size]
          )}
        />
      ) : null}
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-full w-full cursor-pointer appearance-none rounded-[inherit] border-0 bg-transparent pe-8 text-sm leading-5 " +
            "text-foreground outline-none disabled:cursor-not-allowed",
          Icon ? leadingPadding[size] : "ps-3",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground/70",
          chevronSize[size]
        )}
      />
    </div>
  )
})