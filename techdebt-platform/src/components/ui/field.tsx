import * as React from "react"
import { AlertCircle } from "lucide-react"
import { cn } from "./cn"

export interface FieldProps {
  /** Visible label. Rendered as a real `<label>` bound to the control. */
  label?: React.ReactNode
  /** Helper text shown under the control. */
  hint?: React.ReactNode
  /** Validation message. When present the control is marked `aria-invalid`. */
  error?: React.ReactNode
  /** Shows the required marker and sets `aria-required` on the control. */
  required?: boolean
  /** Explicit control id. Generated automatically when omitted. */
  id?: string
  /** Keeps the label in the DOM for screen readers while hiding it visually. */
  labelHidden?: boolean
  className?: string
  /**
   * The control. Its `id`, `aria-describedby` and `aria-invalid` are filled in
   * automatically, so callers only supply `label` / `hint` / `error`.
   */
  children: React.ReactNode
}

/**
 * Label + hint + error wrapper.
 *
 * It wires the accessibility attributes onto its child control, which keeps
 * every form in the app consistent (and is what the future Storybook stories
 * will document).
 */
export function Field({
  label,
  hint,
  error,
  required,
  id,
  labelHidden,
  className,
  children,
}: FieldProps) {
  const autoId = React.useId()
  const controlId = id ?? autoId
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`

  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined

  const control = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: (children.props as Record<string, unknown>).id ?? controlId,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...("aria-invalid" in (children.props as Record<string, unknown>)
          ? {}
          : { "aria-invalid": Boolean(error) || undefined }),
        ...(required ? { "aria-required": true } : {}),
      })
    : children

  return (
    <div className={cn("space-y-1.5", className)} data-slot="field">
      {label ? (
        <label
          htmlFor={controlId}
          className={cn(
            "flex items-baseline gap-1 text-xs font-semibold text-muted-foreground",
            labelHidden && "sr-only"
          )}
        >
          {label}
          {required ? (
            <span aria-hidden className="text-danger">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      {control}

      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground/90">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="flex items-center gap-1.5 text-xs font-medium text-danger">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  )
}