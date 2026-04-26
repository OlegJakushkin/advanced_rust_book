"use client"

import { BookOpen, Zap, Shield, Code2, RotateCcw } from "lucide-react"
import { useBook } from "../book-context"
import { PAGES, DEFAULT_CODES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

export function PageWelcome() {
  const { codes, updateCode, resetCode, outputs, setOutput, isRunning, setIsRunning } = useBook()
  const pageIndex = 0
  const page = PAGES[pageIndex]

  const runCode = () => {
    setIsRunning("hello")
    setTimeout(() => {
      const output = simulateRustExecution(codes.hello, "hello")
      setOutput("hello", output)
      setIsRunning(null)
    }, 800)
  }

  const isModified = codes.hello !== DEFAULT_CODES.hello

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <BookOpen className="h-4 w-4" />
          Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground">A language empowering everyone to build reliable and efficient software</p>
      </div>

      <div className="grid gap-4 mb-6">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-card border border-border">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Blazingly Fast</h3>
            <p className="text-sm text-muted-foreground">Rust is as fast as C/C++ with zero-cost abstractions</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 rounded-lg bg-card border border-border">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Memory Safe</h3>
            <p className="text-sm text-muted-foreground">No null pointers, no data races, guaranteed at compile time</p>
          </div>
        </div>
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Your First Rust Program
          </h3>
          {isModified && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => resetCode("hello")}
              className="gap-1.5 text-xs text-muted-foreground h-7"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          )}
        </div>
        <RustCodeEditor
          code={codes.hello}
          onChange={(newCode) => updateCode("hello", newCode)}
          onRun={runCode}
          output={outputs.hello ?? null}
          isRunning={isRunning === "hello"}
          filename="hello.rs"
        />
      </div>
    </div>
  )
}
