"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "@/lib/theme-context"
import { Dropdown, DropdownItem } from "@/components/ui/dropdown"
import { Tooltip } from "@/components/ui/tooltip"

export function ThemeToggle() {
  const { theme, resolved, setTheme } = useTheme()
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor

  return (
    <Dropdown
      align="end"
      width="w-52"
      trigger={(open, toggle) => (
        <Tooltip tip={theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"}>
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
          >
            <Icon className="h-4 w-4" />
          </button>
        </Tooltip>
      )}
    >
      {() => (
        <>
          <p className="px-3.5 pt-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Theme
          </p>
          <DropdownItem active={theme === "light"} icon={<Sun className="h-4 w-4" />} onClick={() => setTheme("light")}>
            Light
          </DropdownItem>
          <DropdownItem active={theme === "dark"} icon={<Moon className="h-4 w-4" />} onClick={() => setTheme("dark")}>
            Dark
          </DropdownItem>
          <DropdownItem active={theme === "system"} icon={<Monitor className="h-4 w-4" />} onClick={() => setTheme("system")}>
            System
            <span className="text-xs text-muted-foreground">({resolved})</span>
          </DropdownItem>
        </>
      )}
    </Dropdown>
  )
}