"use client"

import * as React from "react"
import { Button as DesignSystemButton, type ButtonProps as DesignSystemButtonProps } from "@adem.rejeb/ui"
import { cn } from "@/lib/utils"

type Variant = "default" | "destructive" | "outline" | "secondary" | "ghost"
type Size = "default" | "sm" | "lg" | "icon"

export interface ButtonProps extends Omit<DesignSystemButtonProps, "variant" | "size"> {
  variant?: Variant
  size?: Size
}

const VARIANT_MAP: Record<Variant, "primary" | "danger" | "outline" | "secondary" | "ghost"> = {
  default: "primary",
  destructive: "danger",
  outline: "outline",
  secondary: "secondary",
  ghost: "ghost",
}

const SIZE_MAP: Record<Size, "sm" | "md" | "lg"> = {
  default: "md",
  sm: "sm",
  lg: "lg",
  icon: "md",
}

/**
 * App button, backed by `@adem.rejeb/ui`.
 *
 * The public API is unchanged (`default` / `destructive` / …), so call sites do
 * not need to know which design system is underneath.
 */
export function Button({ variant = "default", size = "default", className, ...props }: ButtonProps) {
  return (
    <DesignSystemButton
      variant={VARIANT_MAP[variant]}
      size={SIZE_MAP[size]}
      className={cn(size === "icon" && "w-10 px-0", className)}
      {...props}
    />
  )
}
