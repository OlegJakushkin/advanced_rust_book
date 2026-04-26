"use client"

import { useEffect, useState } from "react"
import { MoonStar, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={mounted ? `Switch to ${isDark ? "day" : "night"} theme` : "Toggle theme"}
      aria-pressed={mounted ? isDark : undefined}
      className="gap-2 shrink-0"
    >
      {isDark ? <MoonStar className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      <span className="hidden sm:inline">{mounted ? (isDark ? "Night" : "Day") : "Theme"}</span>
    </Button>
  )
}
