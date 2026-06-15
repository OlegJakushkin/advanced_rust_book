"use client"

import { useEffect } from "react"
import { ArrowLeft, Lightbulb, Target, Trophy, Wrench } from "lucide-react"
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
    title: "Predict the ownership timeline",
    objective: "Practice narrating which binding owns a value after each move and where `Drop` is guaranteed to run.",
    starterPrompt:
      "Read a short ownership-transfer sequence with `service`, `alias`, and `consume`, then narrate the owner after each move in plain English.",
    prompts: [
      "Which binding owns the string after each line?",
      "At what scope does the string get dropped?",
      "Which extra line could you add that would fail to compile, and why?",
    ],
    acceptanceCriteria: [
      "You explain that ownership moves from `service` to `alias`, then from `alias` into `consume`.",
      "You identify the end of `consume` as the drop point for the owned `String`.",
      "Your failing-line example correctly refers to using a moved binding after ownership transfer.",
    ],
    hints: [
      "For non-`Copy` types, assignment normally transfers ownership.",
      "Describe ownership one scope at a time instead of thinking about hidden object identity.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Map stack and heap storage precisely",
    objective: "Explain which parts of a composite value are inline and which parts own heap allocations.",
    starterPrompt:
      "Analyze a `Batch` struct that stores a fixed array plus a `Vec<String>`, then write a short note about which pieces are inline and which pieces own heap allocations.",
    prompts: [
      "Which parts of `Batch` are stored inline in the local value?",
      "What heap allocations exist?",
      "Which value owns each heap allocation?",
    ],
    acceptanceCriteria: [
      "You identify the fixed-size array as inline in the `Batch` value.",
      "You explain that `Vec<String>` contains inline metadata while its element buffer is heap allocated.",
      "You note that each `String` element owns its own heap-backed bytes.",
    ],
    hints: [
      "Separate the outer struct layout from the storage used by each field’s owned data.",
      "A `Vec<T>` is a fixed-size handle that owns a separate buffer.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Refactor imperative mutation into expression-oriented Rust",
    objective: "Rewrite a function so temporary state stays narrow and the final result is produced by expressions.",
    starterPrompt:
      "Refactor `classify(depth: usize) -> (&'static str, usize)` so the tuple comes directly from an expression instead of a wide mutable temporary.",
    prompts: [
      "Keep the return type the same.",
      "Prefer `if` and block expressions.",
      "Do not introduce heap allocation or cloning.",
    ],
    acceptanceCriteria: [
      "Your final version avoids the wide `mut scaled` binding.",
      "The result is still `(&'static str, usize)`.",
      "The control flow is expression-oriented rather than early-return driven everywhere.",
    ],
    hints: [
      "An `if` expression can return a tuple.",
      "A short inner block can compute a value without widening mutable scope.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Explain the lifetime bug instead of fighting the annotation",
    objective: "Diagnose why returning a reference to local data fails and propose correct repairs.",
    starterPrompt:
      "Diagnose a function that tries to return the first line of a local `String` by reference, then explain why that borrow cannot outlive the owner.",
    prompts: [
      "What rule Rust is enforcing",
      "Why adding a random lifetime annotation does not solve it",
      "Two valid repairs with different tradeoffs",
    ],
    acceptanceCriteria: [
      "You explain that the returned reference would outlive the local `String` owner.",
      "You state that lifetimes describe valid borrowing relationships and do not extend object lifetime.",
      "You propose at least two real repairs, such as returning an owned `String` or borrowing from caller-provided input.",
    ],
    hints: [
      "Ask who owns `text` and when that owner is dropped.",
      "A repair is valid only if the referenced data outlives the returned reference.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Choose owned versus borrowed data at a queue boundary",
    objective: "Make an ownership plan for a realistic parser-to-worker pipeline.",
    starterPrompt:
      "You are designing an ingest path with the flow `&[u8] request bytes -> parse headers -> build Event -> send to worker queue -> persist -> emit metrics`.",
    prompts: [
      "Which data stays borrowed only inside parsing?",
      "Which data becomes owned inside `Event` before the queue boundary?",
      "Where is cloning acceptable, and where is it a smell?",
      "What cleanup should rely on ordinary scope exit or `Drop`?",
    ],
    acceptanceCriteria: [
      "You keep borrowed data local to parsing or validation where possible.",
      "You convert data that crosses the queue boundary into owned values.",
      "You justify cloning as an explicit economic choice rather than a default response.",
      "You describe cleanup in terms of ownership and scope, not hidden runtime behavior.",
    ],
    hints: [
      "A worker queue is usually an ownership boundary.",
      "Try to name the owner at each subsystem edge.",
    ],
  },
]

const reviewQuestions = [
  "What is the difference between a value and a binding in Rust?",
  "Where do `Vec<T>` metadata and `Vec<T>` elements usually live?",
  "What does a lifetime annotation constrain, and what does it not do?",
  "Why can block expressions reduce mutation pressure in production code?",
  "When is `Drop` useful, and what kinds of logic should usually stay out of it?",
  "In what order do a block's local variables drop, and how does that differ from the drop order of a struct's fields?",
]

const workingLoop = [
  "Name the owner first, then describe the borrow or move.",
  "Separate storage shape from ownership shape before you optimize the design in your head.",
  "Explain where scope ends and what gets dropped there.",
  "If a reference appears, state which owner keeps it valid.",
]

export function PageCh02TheRustMentalModelExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch02-the-rust-mental-model-exercises")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 02 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          These exercises build fluency in the ownership model: predicting moves and drops, mapping storage precisely,
          refactoring toward expression-oriented Rust, and reasoning about lifetimes.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Work from ownership and scope first, then syntax. For each exercise, explain who owns the value, when it
                can be borrowed, and where destruction happens. The repository keeps exercises solution-free on purpose:
                treat the objective and acceptance criteria as your spec.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(getPageIndexById("ch02-the-rust-mental-model"))} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 02
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
              Refactor the starter so <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">classify</code>
              returns its tuple from an expression. The checker looks for the correct branch values and for the wide
              mutable temporary to disappear.
            </>
          }
          filename="classify_lab.rs"
          runKey="ch02_ex_classify"
          expectedOutput={"steady 170\nhot 600"}
          helperText={
            <>
              Tip: aim for an <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">if</code> expression
              that returns{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">{`("hot", depth / 2)`}</code> or{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">
                {`("steady", depth + 50)`}
              </code>{" "}
              directly.
            </>
          }
          initialCode={`fn classify(depth: usize) -> (&'static str, usize) {\n    let mut scaled = 0;\n\n    if depth > 1000 {\n        scaled = depth / 2;\n        return ("hot", scaled);\n    }\n\n    scaled = depth + 50;\n    ("steady", scaled)\n}\n\nfn main() {\n    let (status_a, value_a) = classify(120);\n    let (status_b, value_b) = classify(1200);\n    println!("{} {}", status_a, value_a);\n    println!("{} {}", status_b, value_b);\n}`}
        />

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Review questions</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {reviewQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">What success looks like</h3>
          <p className="text-sm text-muted-foreground leading-6">
            By the end of this page, you should be able to narrate ownership transfer without hand-waving, distinguish
            stack layout from heap-backed ownership precisely, refactor toward expression-oriented Rust when it improves
            clarity, and explain why a lifetime error is really an ownership error with references on top.
          </p>
        </section>
      </div>
    </div>
  )
}
