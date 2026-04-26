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
    title: "Tell the ownership story before touching syntax",
    objective: "Practice describing an ownership and borrowing flow in operational terms.",
    starterPrompt:
      "A request parser receives `&[u8]`, validates headers, builds a routing key, and then sends an owned job to a worker queue. Describe who owns data at each step and which phases only borrow.",
    prompts: [
      "Which stage owns the original request buffer?",
      "Which stage may borrow only temporarily?",
      "At what point should the worker queue receive owned data rather than references into the request buffer?",
    ],
    acceptanceCriteria: [
      "You name an owner for the original request bytes.",
      "You separate local borrowed inspection from cross-boundary owned data.",
      "You explain why the queue boundary is normally an ownership transfer point.",
    ],
    hints: [
      "Try to answer in terms of owners and temporary access, not in terms of syntax first.",
      "If a later stage can outlive the current scope, it usually should not borrow from that scope.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Find the unnecessary clone",
    objective: "Identify where cloning papers over an ownership design that could be simpler.",
    starterPrompt:
      "Review a helper that clones a request path into `path_copy`, prints it, then still uses the original path immediately after. Decide whether the clone is required and explain the cleaner alternative.",
    prompts: [
      "Can a shared borrow do the same work?",
      "Would returning ownership from a helper be more appropriate than cloning?",
      "If the clone stays, what makes it economically justified rather than a reflex?",
    ],
    acceptanceCriteria: [
      "You distinguish semantic duplication from compiler appeasement.",
      "You propose borrowing as the first repair when the data only needs read access.",
      "You justify any remaining clone in terms of API shape or operational cost.",
    ],
    hints: [
      "If no independent copy is needed, start by asking whether `&str` or `&T` is enough.",
      "A good answer mentions when cloning is correct, not only when it is avoidable.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Accept borrowed input and return owned output",
    objective: "Design an API that borrows from the caller but returns a result with independent lifetime.",
    starterPrompt:
      "Implement `fn build_cache_key(service: &str, route: &str) -> String` so the result format is `service:route`.",
    prompts: [
      "Keep the parameters borrowed as `&str`.",
      "Return `String`, not `&str`.",
      "Do not allocate intermediate clones unless they are part of the final owned result construction.",
    ],
    acceptanceCriteria: [
      "The function signature is exactly `fn build_cache_key(service: &str, route: &str) -> String`.",
      "The output matches `billing:/v1/invoices` and `search:/ready` for the provided sample inputs.",
      "The function returns owned data rather than borrowing from a temporary.",
    ],
    hints: [
      "A returned `String` makes the caller independent from the input buffer lifetime.",
      "Either `format!` or a small `String` builder is fine here.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Annotate lifetimes only where required",
    objective: "Separate cases that need explicit lifetime relationships from cases handled by elision.",
    starterPrompt:
      "Decide which signatures need explicit lifetimes and write the corrected form: `fn first_word(s: &str) -> &str` and `fn pick_longer(left: &str, right: &str) -> &str`.",
    prompts: [
      "Which function has only one input borrow?",
      "Which function returns one of several input borrows?",
      "Why does adding a lifetime to the first function not improve the model?",
    ],
    acceptanceCriteria: [
      "You keep `fn first_word(s: &str) -> &str` elided.",
      "You annotate `pick_longer` with one explicit lifetime parameter and tie both inputs plus the output to it.",
      "You explain that the explicit annotation documents a relationship rather than extending storage lifetime.",
    ],
    hints: [
      "One input borrowed reference usually makes elision sufficient.",
      "Multiple candidate input borrows usually force you to name the output relationship.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Fix a borrow-checker failure without cloning",
    objective: "Repair a borrow conflict by changing scope or order instead of duplicating data by default.",
    starterPrompt:
      "A function borrows `let first = first_word(&buffer);`, then tries `buffer.clear();`, and finally prints `first`. Refactor the flow so it compiles without cloning unless you can justify the clone economically.",
    prompts: [
      "Can the use of `first` happen earlier?",
      "Can the borrowed value be converted into an owned value only if the later code truly needs it after mutation?",
      "Would a shorter helper function or inner scope make the borrow duration obvious?",
    ],
    acceptanceCriteria: [
      "Your repair ends the borrow before the mutable operation, or deliberately converts to owned data for a justified reason.",
      "You do not default to cloning without explaining why independent ownership is needed.",
      "You explain the conflict as overlapping borrow duration, not as compiler mood.",
    ],
    hints: [
      "Ask when the immutable borrow is last used.",
      "If later mutation is required, the cleanest repair is often to shorten the earlier borrow's lifetime in code structure.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose ownership for a long-lived service API",
    objective: "Design a Rust-native boundary for a production service that mixes parsing, normalization, storage, and background work.",
    starterPrompt:
      "You are designing an audit service with the flow `socket bytes -> parse route -> normalize key -> store record -> publish async notification`.",
    prompts: [
      "Which functions should accept borrowed input?",
      "Which values must become owned before storage or async notification?",
      "Where would a borrowed-field struct be justified, and where would it create unnecessary lifetime coupling?",
      "What tradeoff are you accepting around allocation versus API simplicity?",
    ],
    acceptanceCriteria: [
      "You keep borrowed input local to parsing and normalization where appropriate.",
      "You convert data to owned form before storage and async boundaries.",
      "You justify at least one tradeoff involving allocation cost, simplicity, or long-term maintainability.",
      "You avoid presenting borrowed fields in long-lived structs as the default answer.",
    ],
    hints: [
      "Stored records and async notifications usually want independent ownership.",
      "The best answer names concrete owners at each subsystem edge.",
    ],
  },
]

const reviewQuestions = [
  "Why is ownership usually the first question and lifetimes the second?",
  "What is the operational difference between `&T` and `&mut T`?",
  "What does a lifetime annotation describe, and what does it never do?",
  "When is returning `String` cleaner than returning `&str`?",
  "Why do queue, cache, and async boundaries often push you toward owned data?",
]

const workingLoop = [
  "State the current owner before you write or change any code.",
  "Ask whether the callee needs read-only access, exclusive mutation, or full ownership.",
  "If a reference is returned, explain which input owner keeps it valid.",
  "Only then choose the repair: shorten the borrow, transfer ownership, or return owned data.",
]

export function PageCh04OwnershipBorrowingAndLifetimesExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch04-ownership-borrowing-and-lifetimes-exercises")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 04 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice ownership-first reasoning: borrow without overextending lifetimes, mutate with exclusive access, and
          return owned data where subsystem boundaries demand independence.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as an API and ownership review. The goal is not to recite borrow-checker slogans. The
                goal is to explain who owns data, which borrows are temporary, which values must become owned, and why a
                given repair is cheaper or clearer in production.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(6)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 04
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
                  Ownership drill
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
          title="Runnable lab · Borrowed input, owned result"
          description={
            <>
              Implement{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">build_cache_key</code> so it accepts
              borrowed inputs and returns an owned <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">String</code>.
              The checker expects the exact output format <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">service:route</code>.
            </>
          }
          filename="build_cache_key_lab.rs"
          runKey="ch04_ex_build_cache_key"
          expectedOutput={"billing:/v1/invoices\nsearch:/ready"}
          helperText={
            <>
              Tip: if the function builds a new value inside the function, that is usually a strong signal that the
              return type should be owned. Borrow input where possible, own the result where sensible.
            </>
          }
          initialCode={`fn build_cache_key(service: &str, route: &str) -> String {\n    route.to_string()\n}\n\nfn main() {\n    println!("{}", build_cache_key("billing", "/v1/invoices"));\n    println!("{}", build_cache_key("search", "/ready"));\n}`}
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
            By the end of this page, you should be able to explain borrow-checker failures as concrete ownership and
            borrow-duration conflicts, annotate lifetimes only where the relationship truly needs to be named, and design
            service APIs that borrow from callers locally while returning owned results at the right boundaries.
          </p>
        </section>
      </div>
    </div>
  )
}
