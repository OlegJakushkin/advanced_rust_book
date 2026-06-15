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
    title: "Refactor one module in three passes",
    objective: "Practice reviewing a non-idiomatic Rust module with an explicit refactoring order instead of random local edits.",
    starterPrompt:
      "You inherit a module that mixes panic-based config parsing, public mutable fields, borrowed return values, and a late-added `Arc<Mutex<...>>` cache. Plan the first three refactoring passes.",
    prompts: [
      "Which problems belong in the ownership-and-error pass?",
      "Which problems belong in the data-model and API pass?",
      "Which problems should wait until the async or concurrency boundary is clearer?",
    ],
    acceptanceCriteria: [
      "You put panic removal and ownership correction before style-only cleanup.",
      "You distinguish model-shape refactors from async or concurrency-boundary refactors.",
      "You explain at least one thing you would deliberately postpone until the earlier passes succeed.",
    ],
    hints: [
      "A good refactor order reduces complexity at the boundary before it optimizes the interior.",
      "If you do not know who owns the data yet, it is too early to polish the API surface.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Name the smell by source language instinct",
    objective: "Read a mixed-style module and classify which parts are C++-style, Go-style, C#-style, or Python-style carryovers.",
    starterPrompt:
      "A single file contains `panic!` on bad input, `BaseHandler`-shaped traits with data spread across several structs, clone-heavy read paths, and long explicit lifetimes on every helper.",
    prompts: [
      "Which parts look like Go-style error handling that Rust should express as `Result`?",
      "Which parts look like C#-style hierarchy pressure that Rust should split into traits, enums, and composition?",
      "Which parts look like C++-style identity or pointer pressure that Rust could replace with value returns or clearer ownership?",
      "Which parts look like Python-style easy mutation that Rust should model with an explicit ownership decision?",
    ],
    acceptanceCriteria: [
      "You classify at least one smell under each relevant background where appropriate.",
      "You explain the Rust-native repair in operational terms rather than only naming the smell.",
      "You avoid pretending every issue has the same refactor shape.",
    ],
    hints: [
      "The goal is not blame. The goal is to recognize which old instinct produced which shape.",
      "A precise answer usually talks about ownership, fallibility, or closed-versus-open state.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Replace panic-based parsing with `Result` and an owned boundary",
    objective: "Refactor a small parsing helper so normal failure becomes explicit and the success path returns a usable owned value.",
    starterPrompt:
      "Replace a helper that unwraps a port string and panics on bad input with a `Result`-based function that callers can compose with `?`.",
    prompts: [
      "Keep the missing-input path explicit.",
      "Map parse failures to a real error value instead of logging and continuing.",
      "Return the parsed port as a plain owned number.",
    ],
    acceptanceCriteria: [
      "The parser returns a `Result` rather than panicking for ordinary invalid input.",
      "Missing input and malformed input are distinguishable in the result.",
      "The runnable lab prints the expected missing, invalid, and success cases.",
    ],
    hints: [
      "This exercise is intentionally small. The design lesson is bigger than the function.",
      "Use `ok_or` or `match` for the missing branch, then `map_err` or `match` for parse failure.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Reduce lifetime annotations by changing ownership",
    objective: "Remove unnecessary lifetime complexity by returning owned data or owning fields where the boundary demands independence.",
    starterPrompt:
      "You inherit `fn build_label<'a>(service: &'a str, route: &'a str) -> &'a str` even though the function constructs new text, plus a long-lived struct that borrows request fields into a cache.",
    prompts: [
      "Which function should return `String` instead of a borrowed `&str`?",
      "Which long-lived struct should stop borrowing and start owning?",
      "What lifetime annotations disappear once the ownership model is corrected?",
    ],
    acceptanceCriteria: [
      "You change at least one borrowed return into an owned return for a justified reason.",
      "You identify at least one long-lived struct that should stop borrowing request-local data.",
      "You explain the refactor as an ownership repair, not as lifetime syntax cleanup.",
    ],
    hints: [
      "If the function constructs new bytes, it should usually return an owned value.",
      "If the struct crosses cache, queue, or async boundaries, borrowing from request-local data is usually the wrong model.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Remove unnecessary clones and narrow unsafe code",
    objective: "Practice two common production cleanups in one review: borrow on read paths and wrap unsafe code behind a checked safe API.",
    starterPrompt:
      "A helper clones routes only to log them, and another helper exposes a safe raw-pointer write API without documenting the real preconditions. Repair both. These two cleanups are grouped because they share one defect: each hides an implicit contract that the refactor must make explicit, the clone hiding that the caller only needs read access and the unsafe block hiding the precondition that makes the raw write sound.",
    prompts: [
      "Which signature should borrow instead of taking ownership?",
      "Where should the unsafe precondition checks move relative to the raw operation?",
      "How would you document the remaining `unsafe` block so another reviewer can re-derive the invariant quickly?",
    ],
    acceptanceCriteria: [
      "You remove at least one unnecessary clone by changing a signature to borrow.",
      "You shrink the unsafe region and move explicit checks before it.",
      "You name the invariant of the remaining unsafe block concretely.",
    ],
    hints: [
      "A clone-heavy read path and a vague unsafe boundary are both signs that the real contract is hidden.",
      "Make the contract smaller and more explicit before you optimize anything else.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Refactor a synchronous service into an async shell with test seams",
    objective: "Decide what actually becomes async, what remains synchronous, and how to keep the resulting code easy to test.",
    starterPrompt:
      "You are refactoring `parse -> validate -> load from store -> enrich -> persist -> notify` into an async service that may later be spawned onto a multithreaded runtime.",
    prompts: [
      "Which steps should remain synchronous because they are pure or CPU-local?",
      "Which boundaries should become async because they perform IO or scheduling?",
      "Which values should become owned before an `await` or a spawned task boundary?",
      "Which seams should be traits or generics so tests can provide clocks, repositories, or notifiers?",
      "Which parts of this pipeline are closed sets that should be enums (a fixed delivery mode) versus open behavior that should be traits (the notifier or repository)?",
    ],
    acceptanceCriteria: [
      "You keep pure parsing or validation synchronous where possible.",
      "You return or pass owned values across async or task boundaries.",
      "You justify any `Send` requirement in terms of a real cross-thread future or spawned task boundary.",
      "You name at least one test strategy and one observability hook for the refactored service.",
    ],
    hints: [
      "Not every function in an async service should become `async fn`.",
      "A thin async shell around a sync domain core is often easier to test and benchmark.",
    ],
  },
]

const reviewQuestions = [
  "Why is a three-pass refactor often safer than many small style-only edits?",
  "What is the Rust-native repair for routine invalid input: `panic!`, sentinel values, or `Result`?",
  "When does returning owned data simplify lifetime-heavy APIs?",
  "How do enums and traits divide closed and open polymorphism during a refactor?",
  "Why should async refactors usually return owned values across `await` boundaries?",
  "What makes a refactor more testable instead of only more abstract?",
  "What should you measure after a refactor to confirm the ownership and error changes actually improved operational behavior?",
]

const workingLoop = [
  "Pass 1: fix ownership and failure modeling first.",
  "Pass 2: simplify the data model into structs, enums, and focused traits.",
  "Pass 3: adjust async, ergonomics, and test seams once the core contract is honest.",
  "After each pass, restate the operational model in one paragraph before moving on.",
]

export function PageCh17RefactoringTowardIdiomaticRustExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch17-refactoring-toward-idiomatic-rust-exercises")
  const mainPageIndex = getPageIndexById("ch17-refactoring-toward-idiomatic-rust")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 17 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice idiomatic refactoring the way it happens in real systems: correct ownership and errors first, simplify
          the model second, then choose async and test seams deliberately.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a review rehearsal. The strongest answer does not say only “make it more
                idiomatic.” It says which ownership boundary is wrong, which failure mode is hidden, which abstraction is
                open or closed, and why the new shape is easier to test and operate.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 17
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
                <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  Refactoring drill
                </span>
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
          title="Runnable lab · Replace panic-based parsing with `Result`"
          description={
            <>
              Repair the starter so routine invalid input becomes an explicit{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Result</code> rather than a panic. The
              checker expects a missing-input error, an invalid-input error, and a successful parse for{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">8080</code>.
            </>
          }
          filename="parse_port_refactor_lab.rs"
          runKey="ch17_ex_result_refactor"
          expectedOutput={'missing = Err("missing port")\nbad = Err("invalid port")\nok = Ok(8080)'}
          helperText={
            <>
              Tip: handle <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">None</code> first, then map
              parse failure into <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Err("invalid port")</code>.
              Remove the panic path entirely.
            </>
          }
          initialCode={`fn parse_port(raw: Option<&str>) -> Result<u16, &'static str> {\n    let text = raw.unwrap();\n    Ok(text.parse::<u16>().unwrap())\n}\n\nfn main() {\n    println!(\"missing = {:?}\", parse_port(None));\n    println!(\"bad = {:?}\", parse_port(Some(\"oops\")));\n    println!(\"ok = {:?}\", parse_port(Some(\"8080\")));\n}`}
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
            By the end of this page, you should be able to review a non-idiomatic Rust module in a deliberate order,
            replace panic-based control flow with explicit results, simplify lifetime-heavy boundaries by changing
            ownership, and explain how a refactor improves both operational clarity and testability.
          </p>
        </section>
      </div>
    </div>
  )
}
