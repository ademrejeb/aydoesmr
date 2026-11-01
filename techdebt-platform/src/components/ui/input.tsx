import * as React from "react"
import { cn } from "./cn"

type IconComponent = React.ComponentType<{ className?: string }>

const control =
  "h-full w-full rounded-[inherit] border-0 bg-transparent text-sm leading-5 text-foreground " +
  "placeholder:text-muted-foreground/80 outline-none disabled:cursor-not-allowed disabled:text-muted-foreground"

const wrapperBase =
  "relative flex w-full items-center rounded-lg border border-input bg-card shadow-xs transition-shadow " +
  "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25 " +
  "data-[invalid=true]:border-danger data-[invalid=true]:focus-within:ring-danger/25 " +
  "has-[:disabled]:opacity-50"

const sizes = {
  sm: "h-8 [&_input]:text-[13px]",
  md: "h-10",
  lg: "h-11",
}

const leadingPadding = { sm: "ps-8", md: "ps-9", lg: "ps-10" }
const trailingPadding = { sm: "pe-8", md: "pe-9", lg: "pe-10" }
const iconSize = { sm: "h-3.5 w-3.5 start-2.5", md: "h-4 w-4 start-3", lg: "h-4 w-4 start-3.5" }

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Icon rendered *inside* the control, on the leading edge. The text is padded automatically. */
  icon?: IconComponent
  /** Node rendered on the trailing edge (clear button, password toggle, unit, status pill…). */
  trailing?: React.ReactNode
  /** Control height. Defaults to `md` (2.5rem), which matches every other form control. */
  size?: "sm" | "md" | "lg"
  /** Marks the control as invalid and applies the danger border/focus ring. */
  invalid?: boolean
  /** Extra classes for the *control* (text alignment, font, tabular figures…). */
  className?: string
  /** Extra classes for the *wrapper* (width overrides, grid placement…). */
  wrapperClassName?: string
}

/**
 * Text input with a proper leading-icon slot.
 *
 * The icon and the text can never overlap: the icon lives in the wrapper while
 * the control receives a logical `ps-*` offset. Logical properties keep the
 * spacing correct in RTL (Arabic) as well as LTR.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon: Icon, trailing, size = "md", invalid, className, wrapperClassName, ...props },
  ref
) {
  return (
    <div
      className={cn(wrapperBase, sizes[size], wrapperClassName)}
      data-invalid={invalid ? "true" : undefined}
      data-slot="input-wrapper"
    >
      {Icon ? (
        <Icon
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground/70",
            iconSize[size]
          )}
        />
      ) : null}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          control,
          Icon ? leadingPadding[size] : "ps-3",
          trailing ? trailingPadding[size] : "pe-3",
          className
        )}
        {...props}
      />
      {trailing ? (
        <div className="absolute end-2 top-1/2 flex -translate-y-1/2 items-center">{trailing}</div>
      ) : null}
    </div>
  )
})