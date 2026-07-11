"use client"

import { ReactNode, useEffect, useState } from "react"
import { RotateCcw } from "lucide-react"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { Button } from "@/components/ui/button"
import { simulateRustExecution } from "./rust-simulator"

interface RustPracticeCardProps {
  title: string
  description: ReactNode
  filename: string
  initialCode: string
  runKey?: string
  expectedOutput?: string
  helperText?: ReactNode
}

export function RustPracticeCard({
  title,
  description,
  filename,
  initialCode,
  runKey,
  expectedOutput,
  helperText,
}: RustPracticeCardProps) {
  const [code, setCode] = useState(initialCode)
  const [output, setOutput] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    setCode(initialCode)
    setOutput(null)
  }, [initialCode])

  const resetCode = () => {
    setCode(initialCode)
    setOutput(null)
  }

  const runCode = () => {
    setIsRunning(true)
    setTimeout(() => {
      setOutput(simulateRustExecution(code, runKey))
      setIsRunning(false)
    }, 500)
  }

  const isModified = code !== initialCode

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-4 flex-col md:flex-row">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <div className="mt-2 text-sm text-muted-foreground leading-6">{description}</div>
        </div>

        {isModified && (
          <Button variant="ghost" size="sm" onClick={resetCode} className="gap-1.5 text-xs text-muted-foreground h-7">
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        )}
      </div>

      <RustCodeEditor
        code={code}
        onChange={setCode}
        onRun={runCode}
        output={output}
        isRunning={isRunning}
        filename={filename}
        expectedOutput={expectedOutput}
        showResultComparison={Boolean(expectedOutput)}
        originalCode={initialCode}
        onRevert={resetCode}
        analyticsKind="exercise"
        analyticsKey={runKey}
      />

      {helperText ? <div className="mt-3 text-xs text-muted-foreground leading-5">{helperText}</div> : null}
    </div>
  )
}
