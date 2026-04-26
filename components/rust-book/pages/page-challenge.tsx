"use client"

import { useState } from "react"
import { Trophy, Code2, RotateCcw } from "lucide-react"
import { useBook } from "../book-context"
import { PAGES, DEFAULT_CODES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

export function PageChallenge() {
  const { codes, updateCode, resetCode, outputs, setOutput, markPageComplete } = useBook()
  const [isRunning, setIsRunning] = useState(false)
  const [taskResult, setTaskResult] = useState<"success" | "error" | null>(null)
  const pageIndex = 2
  const page = PAGES[pageIndex]

  const runTask = () => {
    setIsRunning(true)
    setTaskResult(null)

    setTimeout(() => {
      const output = simulateRustExecution(codes.challenge)
      setOutput("challenge", output)

      if (output === "Sum: 35") {
        setTaskResult("success")
        markPageComplete(pageIndex)
      } else {
        setTaskResult("error")
      }
      setIsRunning(false)
    }, 1000)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground">Put your Rust knowledge to the test</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto">
        {/* Task Description */}
        <div className="p-4 rounded-lg bg-card border border-border">
          <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Task: Calculate the Sum
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Write a Rust program that calculates the sum of two numbers{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm">a = 10</code> and{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm">b = 25</code>, and prints the result.
            The output should be exactly:{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm">Sum: 35</code>
          </p>
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">Hints:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>
                Use <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">let</code> to declare variables
              </li>
              <li>
                Use <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">+</code> to add numbers
              </li>
              <li>
                Use{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">
                  {"println!(\"Sum: {}\", result)"}
                </code>{" "}
                to print
              </li>
            </ul>
          </div>
        </div>

        {/* Editable Code Block */}
        <div className="flex items-center justify-end mb-1">
          {codes.challenge !== DEFAULT_CODES.challenge && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => resetCode("challenge")}
              className="gap-1.5 text-xs text-muted-foreground h-7"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          )}
        </div>
        <RustCodeEditor
          code={codes.challenge}
          onChange={(newCode) => updateCode("challenge", newCode)}
          onRun={runTask}
          output={outputs.challenge ?? null}
          isRunning={isRunning}
          filename="challenge.rs"
          expectedOutput="Sum: 35"
          showResultComparison={true}
        />

        {/* Success Message */}
        {taskResult === "success" && (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
            <h4 className="font-semibold text-green-700 mb-2 flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Congratulations!
            </h4>
            <p className="text-sm text-green-700/80">
              You&apos;ve completed the challenge! You now know the basics of Rust variables and printing. Check out
              the official{" "}
              <a
                href="https://doc.rust-lang.org/book/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-800 hover:underline font-medium"
              >
                Rust Book
              </a>{" "}
              to continue your journey.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
