"use client"

import { useEffect } from "react"
import { ArrowLeft, ArrowRight, Lightbulb, Target, Trophy, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { PAGES } from "../types"
import { Button } from "@/components/ui/button"
import { RustPracticeCard } from "../rust-practice-card"

interface Exercise {
  number: number
  kind: string
  title: string
  objective: string
  starterPrompt: string
  prompts?: string[]
  acceptanceCriteria: string[]
  hints: string[]
}

const exercises: Exercise[] = [
  {
    number: 1,
    kind: "warm-up comprehension",
    title: "Translate a familiar lifecycle pattern into Rust",
    objective:
      "Map one resource-management idea from C++, C#, or Go to idiomatic Rust ownership and cleanup semantics.",
    starterPrompt:
      "Choose one familiar lifecycle pattern and restate it as a Rust ownership design for a resource owner named `Session` or `LogWriter`.",
    prompts: [
      "Start from a single owner that is responsible for cleanup.",
      "Decide which methods should take `&self`, which should take `&mut self`, and which should consume `self`.",
      "Explain where deterministic cleanup happens and why it does not depend on a garbage collector or inheritance.",
    ],
    acceptanceCriteria: [
      "Your design identifies a single owner responsible for cleanup.",
      "You explain why borrowed methods do or do not allow mutation.",
      "Cleanup is deterministic and does not rely on a garbage collector or inheritance.",
    ],
    hints: [
      "Think in terms of a struct plus methods, not a class hierarchy.",
      "If cleanup must always happen, describe the role of Drop even if you do not fully implement it yet.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Find the zero-cost part and the real runtime cost",
    objective:
      "Identify which parts of a Rust abstraction are compile-time structure and which parts still do real work at runtime.",
    starterPrompt:
      "Study an iterator-based function that filters high-priority jobs from a slice, then annotate which parts are compile-time abstraction structure and which parts still cost CPU cycles.",
    prompts: [
      "Call out which parts are likely monomorphized or optimized as abstraction structure.",
      "List the runtime work that still exists: iteration, branching, cache behavior, and any downstream materialization cost.",
      "Explain where dynamic dispatch would appear if the return type changed to a trait object.",
    ],
    acceptanceCriteria: [
      "You identify iterator adapters and impl Iterator as abstraction mechanisms that do not imply dynamic dispatch by default.",
      "You name the runtime work that still exists: iteration, branching, cache behavior, and any downstream allocation if materialized.",
      "You explain that a trait object would opt into dynamic dispatch.",
    ], 
    hints: [
      "Separate 'how the code is expressed' from 'what the machine still has to do.'",
      "Look for where values are actually stored, allocated, or compared.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Make fallibility explicit instead of implicit",
    objective: "Replace a sentinel-value style API with Rust’s explicit Option and Result modeling.",
    starterPrompt:
      "Implement `parse_limit(input: Option<&str>) -> Result<usize, &'static str>` so missing input uses the default value `100`, `\"0\"` is invalid, non-numeric input is invalid, and valid positive integers return `Ok(limit)`.",
    prompts: [
      "Do not use `panic!`, `unwrap`, or sentinel values such as `-1`.",
      "Keep the failure mode explicit in the type system so callers cannot ignore it accidentally.",
    ],
    acceptanceCriteria: [
      "The function returns Result<usize, &'static str> exactly.",
      "Missing input becomes the default value without error.",
      "Invalid input is represented as an Err, not as a magic number or log-only failure.",
    ],
    hints: [
      "Handle Option first, then parse the string branch.",
      "The type system should make invalid states harder to ignore at call sites.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Interpret three compiler diagnostics and propose repairs",
    objective: "Practice reading Rust diagnostics as ownership and concurrency design feedback.",
    starterPrompt:
      "For each diagnostic, explain the rule Rust is enforcing, sketch the likely shape of the buggy code, and propose one or two valid repair strategies.",
    prompts: [
      "E0382: borrow of moved value: request",
      "E0499: cannot borrow buffer as mutable more than once at a time",
      "E0277: Rc<String> cannot be sent between threads safely",
    ],
    acceptanceCriteria: [
      "Your explanation of E0382 mentions ownership transfer and alternatives such as borrowing, returning ownership, or intentional cloning.",
      "Your explanation of E0499 mentions exclusive mutable access and proposes scope shortening or data-structure redesign.",
      "Your explanation of E0277 mentions thread-safety trait bounds and distinguishes Rc from thread-safe sharing approaches such as Arc.",
    ],
    hints: [
      "Focus on the violated rule first, then the syntax.",
      "A good repair changes ownership shape before reaching for shared mutable state.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Design a worker pipeline with explicit ownership boundaries",
    objective:
      "Choose Rust-native boundaries for parsing, validation, dispatch, and cross-thread communication in a production-style service.",
    starterPrompt:
      "You are designing an ingestion service with the flow `socket bytes -> parse -> validate -> route to workers -> emit metrics`.",
    prompts: [
      "At what boundary do bytes become owned domain values?",
      "What data is borrowed only locally?",
      "What types are allowed to cross thread boundaries?",
      "Where do you use `Result` or enums to represent failure and state?",
    ],
    acceptanceCriteria: [
      "You place ownership boundaries before cross-thread or queued work.",
      "You avoid defaulting to a single global `Arc<Mutex<HashMap<...>>>` as the first design move.",
      "You make error handling explicit with Result, enums, or both.",
      "You justify at least one tradeoff involving performance, safety, or maintainability.",
    ],
    hints: [
      "Prefer message passing of owned work items over broad shared mutability.",
      "If you need sharing, explain why the sharing is semantically real rather than just convenient.",
    ],
  },
]

const reviewQuestions = [
  "Why does Rust often feel harder at API boundaries than inside small local functions?",
  "What is the practical difference between a generic function using traits and a trait object?",
  "Name one category of bug Rust usually catches at compile time and one category it cannot remove from runtime reality.",
  "Why is 'just clone it' sometimes correct and sometimes a design smell?",
  "How would you explain `Send` and `Sync` to a teammate coming from Go or C#?",
]

const workingLoop = [
  "Restate the exercise in ownership language before you write code.",
  "Decide whether the boundary wants borrowing, ownership transfer, or explicit cloning.",
  "Run the lab, then explain the result by naming the ownership or borrowing rule involved.",
  "Write down one tradeoff you accepted: allocation, duplication, indirection, or API complexity.",
]

const diagnosticRubric = [
  {
    code: "E0382",
    question: "What moved, and should this call site borrow, return ownership, or clone intentionally?",
  },
  {
    code: "E0499",
    question: "Which mutable borrow stayed alive too long, and how can the scopes or data shape be narrowed?",
  },
  {
    code: "E0277",
    question: "Which thread boundary requires `Send` or `Sync`, and is sharing actually necessary here?",
  },
]

export function PageCh01WhyRustFeelsDifferentExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch01-why-rust-feels-different-exercises")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 01 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Exercises to turn “Rust feels strict” into a repeatable review habit around
          ownership, diagnostics, and production design.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                These exercises are intentionally solution-free in the repository. Treat the objective, starter prompt,
                acceptance criteria, and hints as a working spec. Aim for explicit ownership choices, concrete tradeoff
                language, and short architectural explanations another senior engineer could review quickly.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(0)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 01
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Suggested working loop</h3>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            {workingLoop.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="grid gap-4">
          {exercises.map((exercise) => (
            <article key={exercise.number} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3 flex-col md:flex-row md:items-center mb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">
                    Exercise {exercise.number} · {exercise.kind}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{exercise.title}</h3>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-foreground">Objective</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">{exercise.objective}</p>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-foreground">Starter prompt</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">{exercise.starterPrompt}</p>
                  {exercise.prompts?.length ? (
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc list-inside">
                      {exercise.prompts.map((prompt) => (
                        <li key={prompt}>{prompt}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-border bg-card p-4">
                <h4 className="font-medium text-foreground mb-2">Acceptance criteria</h4>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {exercise.acceptanceCriteria.map((criterion) => (
                    <li key={criterion}>{criterion}</li>
                  ))}
                </ul>
              </div>

              <details className="mt-4 rounded-lg border border-border bg-card p-4">
                <summary className="cursor-pointer list-none flex items-center gap-2 font-medium text-foreground">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Optional hints
                </summary>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {exercise.hints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </section>

        <RustPracticeCard
          title="Runnable lab · Exercise 3"
          description={
            <>
              Implement the explicit-fallibility version of <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">parse_limit</code>.
              The checker expects a default value for missing input, an explicit rejection for zero, and a successful
              positive parse.
            </>
          }
          filename="parse_limit_lab.rs"
          runKey="ch01_ex_parse_limit"
          expectedOutput={'default = Ok(100)\nzero = Err("limit must be greater than 0")\nvalue = Ok(25)'}
          helperText="Tip: keep the type as Result<usize, &'static str>, handle None first, then validate and parse the Some branch."
          initialCode={`fn parse_limit(input: Option<&str>) -> Result<usize, &'static str> {\n    match input {\n        None => Ok(0),\n        Some(raw) => match raw.parse::<usize>() {\n            Ok(limit) => Ok(limit),\n            Err(_) => Err("invalid number"),\n        },\n    }\n}\n\nfn main() {\n    println!("default = {:?}", parse_limit(None));\n    println!("zero = {:?}", parse_limit(Some("0")));\n    println!("value = {:?}", parse_limit(Some("25")));\n}`}
        />

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Questions to ask for each error</h3>
          <div className="grid gap-3 lg:grid-cols-3">
            {diagnosticRubric.map((item) => (
              <div key={item.code} className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="text-xs font-mono text-primary mb-2">{item.code}</div>
                <p className="text-sm text-muted-foreground leading-6">{item.question}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Review questions</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {reviewQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Continue the model-building</h3>
              <p className="text-sm text-muted-foreground leading-6">Chapter 02 explains the mechanics underneath these exercises: values, bindings, moves, drops, stack and heap-backed ownership, and why lifetime bugs are usually ownership bugs with references layered on top.</p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(2)} className="gap-2 shrink-0">
              Go to Chapter 02
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">What success looks like</h3>
          <p className="text-sm text-muted-foreground leading-6">
            By the end of these exercises, you should be able to explain Rust strictness in ownership-contract terms,
            diagnose common move, borrow, and thread-boundary failures, and defend at least one production design in
            Rust-native language instead of translating it mechanically from C++, C#, or Go.
          </p>
        </section>
      </div>
    </div>
  )
}
