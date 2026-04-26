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
    title: "Choose function, generic, trait, macro, or build script honestly",
    objective: "Practice selecting the smallest abstraction that solves the real problem instead of reaching for macros by default.",
    starterPrompt:
      "Classify five cases: joining two labels into one string, removing repeated route-table item syntax, generating impls from a type annotation, mapping several concrete types through one algorithm, and generating a client from an external API schema.",
    prompts: [
      "Which case is just a normal function?",
      "Which case wants `macro_rules!` because syntax repetition is the real problem?",
      "Which case wants a derive or attribute procedural macro?",
      "Which case wants generics or a trait instead of any macro?",
      "Which case belongs in a build script or offline generator because the source of truth is external?",
    ],
    acceptanceCriteria: [
      "You assign at least one case to a normal function and justify why a macro would be overkill.",
      "You distinguish syntax abstraction from type or behavior abstraction clearly.",
      "You identify one case where external-schema generation is a better fit than a public macro call site.",
    ],
    hints: [
      "Ask first whether the caller is passing values, types, Rust items, or an external schema file.",
      "A macro is strongest when syntax is the thing being abstracted.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Explain repetition and hygiene in a `macro_rules!` helper",
    objective: "Read a declarative macro and describe what repetition removes and why local identifiers do not collide with caller names.",
    starterPrompt:
      "Review a `macro_rules!` helper that expands a repeated list of service checks and introduces a local accumulator named `passed` inside the macro.",
    prompts: [
      "Where is the repeated syntax pattern in the macro arm?",
      "Why does the macro's local accumulator not casually overwrite a caller variable with the same spelling?",
      "What part of the expansion still goes through normal type checking afterward?",
    ],
    acceptanceCriteria: [
      "You identify the repetition form such as `$( ... ),*` or `$( ... )*` clearly.",
      "You explain macro hygiene in operational terms instead of saying only 'the compiler handles it.'",
      "You state that the expanded Rust still goes through borrow checking and type checking after expansion.",
    ],
    hints: [
      "The repetition operator is part of the pattern, not an implementation detail after the fact.",
      "A good answer explains what the caller sees and what the compiler still checks next.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Write a `macro_rules!` helper for repetitive checks",
    objective: "Implement a small declarative macro that removes repetitive check boilerplate and stays readable at the call site.",
    starterPrompt:
      "Define a `service_checks!` macro that accepts several `name => bool` pairs and returns the number of passing checks.",
    prompts: [
      "Keep the call site list-shaped and compact.",
      "Use repetition instead of hard-coding one fixed number of inputs.",
      "Do not push runtime business logic into the macro beyond the repetitive count pattern.",
    ],
    acceptanceCriteria: [
      "The macro accepts repeated `name => bool` pairs.",
      "The expansion counts the true cases correctly.",
      "The runnable lab prints the expected passed and total counts.",
      "The call site remains easier to read than the repeated code it replaced.",
    ],
    hints: [
      "This page uses a simple check harness instead of real `cargo test`, but the macro shape is the same one you would use to remove repetitive test scaffolding.",
      "A `let mut passed = 0;` block plus repetition is usually enough here.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Replace a useless macro with a normal function",
    objective: "Identify where a macro hides no real syntax win and refactor to a simpler API.",
    starterPrompt:
      "You inherit `route_label!(service, route)` that only expands to `format!(\"{}::{}\", service, route)` and `retry_limit!()` that only expands to a constant integer.",
    prompts: [
      "Which one should become a normal function?",
      "Which one should become a `const`, `static`, or associated constant instead?",
      "What readability or tooling advantage appears once the macro disappears?",
    ],
    acceptanceCriteria: [
      "You replace at least one macro with an ordinary function and justify the change.",
      "You identify one case where a constant is clearer than a macro call.",
      "You explain the refactor in terms of call-site honesty, diagnostics, or tooling, not only personal style.",
    ],
    hints: [
      "If the macro call reads like a function already, it may want to be a function.",
      "If there is no repeated syntax and no item generation, the macro burden is harder to justify.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Sketch a derive macro API",
    objective: "Design a plausible derive macro boundary without overcommitting to implementation detail too early.",
    starterPrompt:
      "Sketch a derive macro such as `#[derive(EventEnvelope)]`, `#[derive(TopicKey)]`, or `#[derive(StableName)]` for a service type in your system.",
    prompts: [
      "What input item shape does the derive attach to?",
      "What helper attributes, if any, should the type support?",
      "Which impls or helper methods should the derive emit?",
      "What compile-time diagnostic should appear for one obvious misuse?",
    ],
    acceptanceCriteria: [
      "You describe a plausible derive macro name and target item.",
      "You specify at least one emitted impl or generated method clearly.",
      "You mention any supporting attributes and one misuse diagnostic.",
      "You acknowledge that the implementation lives in a separate proc-macro crate.",
    ],
    hints: [
      "A good derive macro does one type-local job well.",
      "The best sketch says what code gets emitted, not only what the annotation is called.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose declarative macro, derive, attribute, function-like proc macro, or build script",
    objective: "Map several production metaprogramming needs to the correct tool without cargo-culting one mechanism.",
    starterPrompt:
      "You are designing a platform with repetitive integration tests, event types that need codec impls, handler functions that need registration metadata, a compact route-table DSL, and an API client generated from an external schema.",
    prompts: [
      "Which concern wants `macro_rules!` because it is local repeated syntax?",
      "Which concern wants a derive macro because code should attach to a type definition?",
      "Which concern wants an attribute macro because an item needs annotation-driven rewriting or registration?",
      "Which concern wants a function-like proc macro because a token-level DSL is the real API?",
      "Which concern belongs in a build script or offline generator because the source of truth is external?",
    ],
    acceptanceCriteria: [
      "You map at least four distinct concerns to the correct metaprogramming or non-macro tool.",
      "You justify one proc-macro choice and one non-macro choice in operational terms.",
      "You mention at least one testing or observability hook, such as compile-fail tests, generated-code snapshots, or expansion-focused diagnostics.",
    ],
    hints: [
      "One system can legitimately use several different code-generation strategies.",
      "The most maintainable answer usually gives each tool one narrow job.",
    ],
  },
]

const reviewQuestions = [
  "What operational difference separates `macro_rules!` from a procedural macro?",
  "Why do procedural macros operate on `TokenStream` instead of inferred types?",
  "When is a derive macro the right fit instead of an attribute macro?",
  "Why can a public macro be harder to evolve than a public function?",
  "What is one concrete signal that a normal function is better than a macro?",
]

const workingLoop = [
  "Choose the smallest abstraction that solves the real syntax or generation problem.",
  "Sketch the public call site or annotation before you design the expansion internals.",
  "Keep runtime logic in ordinary functions after expansion whenever possible.",
  "If a proc macro is involved, define the separate crate boundary and the emitted API surface explicitly.",
]

export function PageCh20MetaprogrammingExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch20-metaprogramming-exercises")
  const mainPageIndex = getPageIndexById("ch20-metaprogramming")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 20 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice metaprogramming the way it survives production review: choose the smallest tool, keep syntax APIs
          deliberate, and use macros only where syntax itself is the real abstraction target.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a compile-time API review. The runnable lab focuses on
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">macro_rules!</code>
                because real derive, attribute, and function-like proc macros live in separate
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">proc-macro</code>
                crates. Those proc-macro exercises are therefore sketch-driven by design.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 20
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
                  Metaprogramming drill
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
          title="Runnable lab · `macro_rules!` helper for repetitive checks"
          description={
            <>
              Repair the starter so <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">service_checks!</code>{" "}
              counts the passing cases from a repeated list of
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">name =&gt; bool</code>
              pairs. The in-browser runner does not execute
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">cargo test</code>,
              but the macro shape is the same one you would use to reduce repetitive test-case scaffolding.
            </>
          }
          filename="service_checks_macro_lab.rs"
          runKey="ch20_ex_service_checks_macro"
          expectedOutput={"passed = 2\ntotal = 3"}
          helperText={
            <>
              Tip: use repetition, keep a local counter inside a block expression, and return that counter. The macro
              should compress repeated syntax, not become a tiny runtime framework.
            </>
          }
          initialCode={`macro_rules! service_checks {\n    ($($name:ident => $status:expr),* $(,)?) => {{\n        0\n    }};\n}\n\nfn main() {\n    let passed = service_checks!(\n        health => true,\n        orders => true,\n        billing => false,\n    );\n\n    println!(\"passed = {}\", passed);\n    println!(\"total = {}\", 3);\n}`}
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
            By the end of this page, you should be able to explain when
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">macro_rules!</code>
            is enough, when a separate proc-macro crate is justified, how to sketch a derive macro API clearly, and when
            a normal function or build-time generator is the more honest tool.
          </p>
        </section>
      </div>
    </div>
  )
}
