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
    title: "Choose owned versus borrowed fields for two domain objects",
    objective:
      "Practice separating a short-lived view type from a long-lived stored type instead of trying to make one struct serve both jobs.",
    starterPrompt:
      "Design two structs for an API gateway: `RouteMatchView` used only during request parsing, and `StoredRouteMatch` used later in metrics and retries.",
    prompts: [
      "Which fields in `RouteMatchView` should borrow from the request buffer?",
      "Which fields in `StoredRouteMatch` should become owned before they hit metrics, retries, or persistence?",
      "Explain one concrete reason the two structs should not have the same field types.",
    ],
    acceptanceCriteria: [
      "You give the view type borrowed fields only where the upstream owner is obvious and nearby.",
      "You give the stored type owned fields for data that must outlive the parse step.",
      "You explain at least one tradeoff involving allocation cost versus lifetime simplicity.",
    ],
    hints: [
      "A parser view and a stored record usually have different jobs.",
      "Ask whether the second struct could sit in a `Vec`, queue, or cache without external lifetime baggage.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Explain the lifetime coupling in a borrowed-field struct",
    objective:
      "Read a struct with references and describe what the lifetime parameter means operationally rather than syntactically.",
    starterPrompt:
      "Given `struct HeaderView<'a> { name: &'a str, value: &'a str }`, explain what `<'a>` says, what it does not say, and where this type is a good fit.",
    prompts: [
      "Who owns the bytes behind `name` and `value`?",
      "Why does the struct need a lifetime parameter at all?",
      "Why is this design usually comfortable in parsing code but awkward in caches and queues?",
    ],
    acceptanceCriteria: [
      "You explain that the struct borrows from some external owner and therefore cannot outlive that owner.",
      "You state that the lifetime parameter constrains reference validity and does not extend storage lifetime.",
      "You identify at least one scenario where the type is a good fit and one where it becomes burdensome.",
    ],
    hints: [
      "Treat `<'a>` as a relationship marker, not as a retention policy.",
      "A good answer names the owner outside the struct.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Build a struct that owns a buffer and exposes read-only views safely",
    objective:
      "Implement an owned-buffer pattern that returns borrowed views derived from `&self` instead of storing self-references.",
    starterPrompt:
      "Implement `AuditLine` so it owns a raw log line and exposes a `level(&self) -> &str` method that returns the text before the first colon.",
    prompts: [
      "Keep the owned field as `String`.",
      "Return `&str` from `level`.",
      "Do not store a second field borrowing from `raw`.",
    ],
    acceptanceCriteria: [
      "The struct stores the raw line as owned `String` data.",
      "The `level` method returns a borrowed `&str` view derived from `&self`.",
      "The sample output is exactly `level = WARN` and `raw = WARN: cache miss`.",
    ],
    hints: [
      "Own the line once, then slice it on demand.",
      "A method returning `&str` from `&self` is the key idea here.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Refactor a self-referential design into stable indices",
    objective:
      "Replace an invalid self-borrowing layout with a representation Rust can move and reason about safely.",
    starterPrompt:
      "You inherit the shape `struct ParsedLine<'a> { raw: String, first: &'a str }` (this layout cannot be constructed in safe Rust — see why in the chapter, then refactor it away entirely). Refactor it so the type still owns `raw` but can recover the first token later without storing a self-reference.",
    prompts: [
      "Will you store a byte range, a start/end offset pair, or a typed token ID?",
      "How will the accessor recover `&str` from `&self`?",
      "What happens if the owned buffer can mutate later?",
    ],
    acceptanceCriteria: [
      "Your redesign removes the self-reference entirely.",
      "Your replacement stores stable metadata such as offsets, ranges, or IDs.",
      "You explain how the accessor reconstructs a borrowed view from the owned buffer.",
      "You note that mutation rules must preserve whatever indexing metadata you store.",
    ],
    hints: [
      "If the accessor starts from `&self`, it can borrow from the owned buffer at call time.",
      "Offsets and ranges are often simpler than pointer-like designs.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Choose Box, Rc, or Arc intentionally",
    objective:
      "Practice mapping pointer types to actual ownership semantics instead of treating them as interchangeable heap wrappers.",
    starterPrompt:
      "Choose a field type for each case: a recursive AST node owned by one parent, a read-mostly UI template shared inside one thread, and a schema object shared across worker threads.",
    prompts: [
      "Where is `Box<T>` the right indirection tool?",
      "Why is `Rc<T>` wrong at a thread boundary?",
      "What extra truth must hold before `Arc<T>` is enough?",
    ],
    acceptanceCriteria: [
      "You choose `Box<T>` for the recursive single-owner case.",
      "You choose `Rc<T>` only for single-thread shared ownership.",
      "You choose `Arc<T>` only for cross-thread shared ownership and mention that `T` must still be thread-safe.",
    ],
    hints: [
      "Reference counting answers an ownership-count question, not a mutability-design question.",
      "Start with 'how many owners?' and 'which threads?' before naming the type.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Design long-lived service structs without over-lifetime-parameterization",
    objective:
      "Make a lifetime-aware struct design for a service pipeline without turning every downstream type into `Thing<'a>`.",
    starterPrompt:
      "You are designing `socket bytes -> parse headers -> build Event -> enqueue -> retry -> persist`. Decide which types are temporary borrowed views and which types should own their fields.",
    prompts: [
      "Which types exist only inside parsing or validation?",
      "At which boundary does `Event` become fully owned?",
      "Where would `Arc<T>` be semantically real, and where would it merely hide unclear ownership?",
      "What is one allocation you would accept to simplify the rest of the system?",
    ],
    acceptanceCriteria: [
      "You keep borrowed views local to parsing or validation.",
      "You convert queued, retried, or persisted data into owned forms before those boundaries.",
      "You justify at least one tradeoff involving allocation, indirection, or shared ownership cost.",
      "You avoid making all downstream service structs lifetime-parameterized by default.",
    ],
    hints: [
      "Queues and retries are ownership boundaries.",
      "If a type survives past the input buffer, it should usually stop borrowing from it.",
    ],
  },
]

const reviewQuestions = [
  "When is a borrowed-field struct a strong design, and when is it a maintenance smell?",
  "Why does one borrowed field often force a lifetime parameter onto the whole struct?",
  "What problem does `Box<T>` solve that plain owned `T` does not?",
  "Why is `Arc<T>` not a synonym for 'safe to share and mutate however I want'?",
  "Why do offsets, ranges, or IDs often beat self-references inside owned structs?",
]

const workingLoop = [
  "Say whether the struct is a view or an owner before choosing field types.",
  "If a field borrows, name the external owner that keeps it valid.",
  "If the struct must live in queues, caches, tests, or persistence, bias toward owned fields.",
  "If you are tempted by self-reference, replace the layout with indices, offsets, or an owner-plus-view split.",
]

export function PageCh05OwnershipInsideStructsExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch05-ownership-inside-structs-exercises")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 05 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice making struct boundaries explicit: who owns the data, who borrows it briefly, and which layout
          choices remain calm under production pressure.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a design review. The question is rarely “what lifetime syntax makes this pass?”
                The question is “should this type be borrowing at all?” Use the objective and acceptance criteria as your
                working spec.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(getPageIndexById("ch05-ownership-inside-structs"))} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 05
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
                  Struct design drill
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
          title="Runnable lab · Exercise 3"
          description={
            <>
              Implement <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">AuditLine</code> so it owns
              the raw line and exposes a borrowed level view safely. The checker expects the struct to keep the source as{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">String</code> and compute the level
              from that owned buffer.
            </>
          }
          filename="audit_line_lab.rs"
          runKey="ch05_ex_audit_line"
          expectedOutput={"level = WARN\nraw = WARN: cache miss"}
          helperText={
            <>
              Tip: do not store a second borrowed field. Let the struct own{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">raw</code>, then derive the{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">level</code> slice from{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">&amp;self</code>.
            </>
          }
          initialCode={`struct AuditLine {\n    raw: String,\n}\n\nimpl AuditLine {\n    fn new(raw: &str) -> Self {\n        Self {\n            raw: String::new(), // intentional stub - fix me: store the raw argument\n        }\n    }\n\n    fn level(&self) -> &str {\n        "UNKNOWN" // intentional stub - fix me: derive the level from self.raw\n    }\n}\n\nfn main() {\n    let line = AuditLine::new("WARN: cache miss");\n    println!("level = {}", line.level());\n    println!("raw = {}", line.raw);\n}`}
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
            By the end of this page, you should be able to decide when a struct is a borrowed view versus an owned
            record, explain why lifetime-heavy service types often signal the wrong boundary, choose between `Box`,
            `Rc`, and `Arc` by ownership semantics, and refactor self-referential ideas into stable layouts Rust can move
            and maintain safely.
          </p>
        </section>
      </div>
    </div>
  )
}
