"use client"

import { Package, ExternalLink, RotateCcw } from "lucide-react"
import { useBook } from "../book-context"
import { PAGES, DEFAULT_CODES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

export function PageLibraries() {
  const { codes, updateCode, resetCode, outputs, setOutput, isRunning, setIsRunning } = useBook()
  const pageIndex = 3
  const page = PAGES[pageIndex]

  const runCode = (key: string) => {
    setIsRunning(key)
    setTimeout(() => {
      const output = simulateRustExecution(codes[key], key)
      setOutput(key, output)
      setIsRunning(null)
    }, 800)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Package className="h-4 w-4" />
          Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground">{page.description}</p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto">
        {/* Intro to Crates */}
        <div className="p-4 rounded-lg bg-card border border-border">
          <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            What are Crates?
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Crates are Rust packages published to{" "}
            <a
              href="https://crates.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              crates.io <ExternalLink className="h-3 w-3" />
            </a>
            . Add them to your <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm">Cargo.toml</code>{" "}
            file:
          </p>
          <pre className="p-3 rounded bg-zinc-900 text-zinc-100 text-sm font-mono overflow-x-auto">
            {`[dependencies]
serde = "1.0"
serde_json = "1.0"
regex = "1.10"`}
          </pre>
        </div>

        {/* Serde Example */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 text-xs font-medium">serde</span>
              JSON Serialization
            </h3>
            {codes.serde !== DEFAULT_CODES.serde && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => resetCode("serde")}
                className="gap-1.5 text-xs text-muted-foreground h-7"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            <strong className="text-foreground">Serde</strong> is the most popular Rust library for serializing and
            deserializing data structures.
          </p>
          <RustCodeEditor
            code={codes.serde}
            onChange={(newCode) => updateCode("serde", newCode)}
            onRun={() => runCode("serde")}
            output={outputs.serde ?? null}
            isRunning={isRunning === "serde"}
            filename="serde_demo.rs"
          />
        </div>

        {/* Regex Example */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-600 text-xs font-medium">regex</span>
              Pattern Matching
            </h3>
            {codes.regex !== DEFAULT_CODES.regex && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => resetCode("regex")}
                className="gap-1.5 text-xs text-muted-foreground h-7"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            <strong className="text-foreground">Regex</strong> provides fast regular expression matching in Rust.
          </p>
          <RustCodeEditor
            code={codes.regex}
            onChange={(newCode) => updateCode("regex", newCode)}
            onRun={() => runCode("regex")}
            output={outputs.regex ?? null}
            isRunning={isRunning === "regex"}
            filename="regex_demo.rs"
          />
        </div>

        {/* Popular Crates */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <h4 className="font-semibold text-foreground mb-3">Popular Crates to Explore</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">
                <strong className="text-foreground">tokio</strong> - Async runtime
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">
                <strong className="text-foreground">reqwest</strong> - HTTP client
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">
                <strong className="text-foreground">clap</strong> - CLI arguments
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">
                <strong className="text-foreground">rayon</strong> - Parallelism
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
