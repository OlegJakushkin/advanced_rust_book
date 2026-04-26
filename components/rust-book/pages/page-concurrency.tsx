"use client"

import { Network, RotateCcw, ArrowRight, MessageSquare } from "lucide-react"
import { useBook } from "../book-context"
import { PAGES, DEFAULT_CODES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

export function PageConcurrency() {
  const { codes, updateCode, resetCode, outputs, setOutput, isRunning, setIsRunning } = useBook()
  const pageIndex = 4
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
          <Network className="h-4 w-4" />
          Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground">{page.description}</p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto">
        {/* Intro to Channels */}
        <div className="p-4 rounded-lg bg-card border border-border">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Message Passing with Channels
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Rust uses <strong className="text-foreground">channels</strong> for safe communication between threads.
            The <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm">std::sync::mpsc</code> module
            provides multi-producer, single-consumer channels.
          </p>

          {/* Visual Diagram */}
          <div className="flex items-center justify-center gap-4 py-4 px-2 rounded-lg bg-muted/50">
            <div className="flex flex-col items-center gap-1">
              <div className="w-20 h-12 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                <span className="text-xs font-medium text-blue-600">Thread 1</span>
              </div>
              <span className="text-xs text-muted-foreground">Sender</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ArrowRight className="h-6 w-6 text-primary" />
              <span className="text-xs text-muted-foreground font-mono">tx.send()</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-16 h-12 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
                <span className="text-xs font-medium text-primary">Channel</span>
              </div>
              <span className="text-xs text-muted-foreground">mpsc</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ArrowRight className="h-6 w-6 text-primary" />
              <span className="text-xs text-muted-foreground font-mono">rx.recv()</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-20 h-12 rounded-lg bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                <span className="text-xs font-medium text-green-600">Main</span>
              </div>
              <span className="text-xs text-muted-foreground">Receiver</span>
            </div>
          </div>
        </div>

        {/* Basic Channel Example */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-foreground">Basic Channel Communication</h3>
            {codes.channels !== DEFAULT_CODES.channels && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => resetCode("channels")}
                className="gap-1.5 text-xs text-muted-foreground h-7"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Create a channel, spawn a thread to send a message, and receive it in the main thread.
          </p>
          <RustCodeEditor
            code={codes.channels}
            onChange={(newCode) => updateCode("channels", newCode)}
            onRun={() => runCode("channels")}
            output={outputs.channels ?? null}
            isRunning={isRunning === "channels"}
            filename="channels.rs"
          />
        </div>

        {/* MPSC Example */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-foreground">Multiple Producers (Network Simulation)</h3>
            {codes.mpsc !== DEFAULT_CODES.mpsc && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => resetCode("mpsc")}
                className="gap-1.5 text-xs text-muted-foreground h-7"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Simulate two servers sending messages to a main process. Use{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm">tx.clone()</code> to create multiple
            senders.
          </p>
          <RustCodeEditor
            code={codes.mpsc}
            onChange={(newCode) => updateCode("mpsc", newCode)}
            onRun={() => runCode("mpsc")}
            output={outputs.mpsc ?? null}
            isRunning={isRunning === "mpsc"}
            filename="mpsc_demo.rs"
          />
        </div>

        {/* Completion */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <h4 className="font-semibold text-foreground mb-2">You&apos;ve completed the book!</h4>
          <p className="text-sm text-muted-foreground">
            You now understand Rust basics, ownership, libraries, and concurrency. Continue learning with the{" "}
            <a
              href="https://doc.rust-lang.org/book/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              official Rust Book
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
