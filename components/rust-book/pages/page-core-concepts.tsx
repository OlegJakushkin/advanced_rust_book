"use client"

import { BookOpen, RotateCcw } from "lucide-react"
import { useBook } from "../book-context"
import { PAGES, DEFAULT_CODES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

export function PageCoreConcepts() {
  const { codes, updateCode, resetCode, outputs, setOutput, isRunning, setIsRunning } = useBook()
  const pageIndex = 1
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
          <BookOpen className="h-4 w-4" />
          Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground">{page.description}</p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-foreground">Variables & Mutability</h3>
            {codes.variables !== DEFAULT_CODES.variables && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => resetCode("variables")}
                className="gap-1.5 text-xs text-muted-foreground h-7"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            In Rust, variables are <strong className="text-foreground">immutable by default</strong>. 
            Use <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm">mut</code> to make them mutable.
          </p>
          <RustCodeEditor
            code={codes.variables}
            onChange={(newCode) => updateCode("variables", newCode)}
            onRun={() => runCode("variables")}
            output={outputs.variables ?? null}
            isRunning={isRunning === "variables"}
            filename="variables.rs"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-foreground">Ownership</h3>
            {codes.ownership !== DEFAULT_CODES.ownership && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => resetCode("ownership")}
                className="gap-1.5 text-xs text-muted-foreground h-7"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Rust&apos;s <strong className="text-foreground">ownership system</strong> ensures memory safety 
            without a garbage collector. Each value has exactly one owner.
          </p>
          <RustCodeEditor
            code={codes.ownership}
            onChange={(newCode) => updateCode("ownership", newCode)}
            onRun={() => runCode("ownership")}
            output={outputs.ownership ?? null}
            isRunning={isRunning === "ownership"}
            filename="ownership.rs"
          />
        </div>

        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <h4 className="font-semibold text-foreground mb-2">Ready for a challenge?</h4>
          <p className="text-sm text-muted-foreground">
            Next up: a coding challenge, then learn about libraries and concurrency!
          </p>
        </div>
      </div>
    </div>
  )
}
