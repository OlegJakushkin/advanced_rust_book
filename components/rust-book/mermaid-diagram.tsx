"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

interface MermaidDiagramProps {
  /** Mermaid source, e.g. a `flowchart LR` or `sequenceDiagram` block. */
  chart: string
  /** Optional caption rendered under the diagram. */
  caption?: string
  className?: string
}

/**
 * Renders a Mermaid diagram on the client. Mermaid is loaded lazily inside an
 * effect so it never runs during SSR, and the diagram re-renders when the theme
 * flips between light and dark. Use this to draw the shape of a system (message
 * flow, ownership handoff, state machine) right before the code listing that
 * implements it.
 */
export function MermaidDiagram({ chart, caption, className }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rawId = useId()
  const renderId = `mermaid-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`
  const { resolvedTheme } = useTheme()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function renderChart() {
      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: resolvedTheme === "dark" ? "dark" : "default",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          flowchart: { htmlLabels: true, curve: "basis" },
        })
        const { svg } = await mermaid.render(renderId, chart.trim())
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    }

    renderChart()
    return () => {
      cancelled = true
    }
  }, [chart, renderId, resolvedTheme])

  return (
    <figure className={cn("my-4 rounded-xl border border-border bg-muted/20 p-4", className)}>
      <div
        ref={containerRef}
        className="flex w-full justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full"
      />
      {error && (
        <pre className="mt-2 whitespace-pre-wrap text-xs text-red-500">{error}</pre>
      )}
      {caption && (
        <figcaption className="mt-3 text-center text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
