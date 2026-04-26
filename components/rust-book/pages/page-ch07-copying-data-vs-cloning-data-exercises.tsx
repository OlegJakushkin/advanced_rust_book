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
    title: "Classify each duplication event correctly",
    objective: "Practice separating moves, implicit copies, explicit clones, and plain borrows in one small flow.",
    starterPrompt:
      "Classify the operation at each marked line in a function that uses `RequestId(u64)`, `String`, `&str`, and `Arc<Schema>` values.",
    prompts: [
      "Which line is a move because the type is non-Copy and ownership transfers?",
      "Which line is an implicit copy because the type is `Copy`?",
      "Which line is an explicit clone of owned data?",
      "Which line is only a borrow and therefore not duplication at all?",
    ],
    acceptanceCriteria: [
      "You classify each event using Rust terms rather than vague 'copy-like' language.",
      "You distinguish shared ownership via `Arc::clone` from deep cloning of inner data.",
      "You explain one case where borrowing removes the need for duplication entirely.",
    ],
    hints: [
      "Ask whether the old binding still owns the value afterward.",
      "The spelling at the call site is a clue: plain assignment, `.clone()`, `Arc::clone`, or `&value`.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Find the hidden allocation budget",
    objective: "Read a small service path and identify which operations are cheap scalar copies, which clone heap data, and which merely add shared owners.",
    starterPrompt:
      "Review a request path that duplicates a `RequestId`, clones a `String` route key, and clones an `Arc<Schema>`. Write a short cost review for the function.",
    prompts: [
      "Which operation is almost certainly trivial bitwise duplication?",
      "Which operation likely duplicates heap-backed bytes?",
      "Which operation increments a reference count instead of deep-cloning the schema?",
      "Where would you replace cloning with borrowing if the helper only reads?",
    ],
    acceptanceCriteria: [
      "You identify a scalar or small ID-style copy correctly.",
      "You identify at least one heap-backed `Clone` correctly.",
      "You explain `Arc::clone` as another shared owner rather than a deep copy.",
      "You propose one borrowing repair that would remove unnecessary allocation.",
    ],
    hints: [
      "Read the field types first. Costs tend to follow ownership shape.",
      "A review answer should say what happened operationally, not just 'this is expensive.'",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Implement Clone manually for a realistic type",
    objective: "Write a correct manual `Clone` implementation for a type with owned and scalar fields.",
    starterPrompt:
      "Implement `Clone` for `JobTemplate { service: String, steps: Vec<String>, retries: usize }` so cloning preserves the data and later mutations to the clone do not affect the original.",
    prompts: [
      "Clone the owned fields explicitly.",
      "Copy the scalar field directly.",
      "Do not implement `Copy` for this type.",
    ],
    acceptanceCriteria: [
      "Your type implements `Clone` manually, not through a placeholder or stub.",
      "Owned fields are duplicated correctly.",
      "Mutating the clone after creation does not change the original value.",
      "You keep the type non-`Copy` because implicit duplication would be misleading here.",
    ],
    hints: [
      "Use `.clone()` on `String` and `Vec<String>`.",
      "A `usize` does not need a `clone()` call in practice. Copying the value is enough.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Remove unnecessary clones from a read-only API",
    objective: "Repair an API that clones owned strings where borrowing would express the contract more accurately.",
    starterPrompt:
      "A helper `fn route_label(route: String) -> String` is called only to log and compare route text. Refactor the API so callers stop cloning route strings just to satisfy the signature.",
    prompts: [
      "What should the parameter type become if the helper only reads?",
      "Should the return type stay owned or become borrowed?",
      "Which call sites can lose `.clone()` after the change?",
    ],
    acceptanceCriteria: [
      "Your refactor changes the signature to borrow when read-only access is enough.",
      "You remove at least one unnecessary clone from the caller side.",
      "You explain why borrowing communicates the contract more clearly than taking ownership here.",
    ],
    hints: [
      "If the helper only inspects text, start with `&str`.",
      "A better signature usually fixes more than one clone at once.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Decide whether a type should implement Copy",
    objective: "Practice the conservative rule set for implementing `Copy` safely.",
    starterPrompt:
      "Evaluate whether each type should implement `Copy`: `RequestId(u64)`, `Span { start: usize, end: usize }`, `SessionKey(String)`, `SharedSchema(Arc<str>)`, and `SocketOwner(TcpStream)`.",
    prompts: [
      "Which ones satisfy Rust's mechanical rules for `Copy`?",
      "Which ones would still be a semantic mistake even if the shape looked small?",
      "Where is explicit `Clone` or no duplication trait the better signal?",
    ],
    acceptanceCriteria: [
      "You approve `Copy` only for types where implicit duplication is trivial and unsurprising.",
      "You reject `Copy` for heap-owning or resource-owning types.",
      "You explain why `Arc<T>` being cheap to clone does not make the wrapper automatically a good `Copy` candidate.",
    ],
    hints: [
      "The `Copy` checklist is stricter than 'this seems lightweight.'",
      "Resource ownership and shared ownership deserve visible APIs.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose receivers and duplication boundaries together",
    objective: "Design a small service API where receiver choice and duplication policy line up.",
    starterPrompt:
      "You are building a `ConfigBuilder`, a long-lived `ServiceConfig`, and a `publish` step that fans work out to multiple workers. Choose where methods should take `self`, `&self`, or `&mut self`, and where cloning is legitimate.",
    prompts: [
      "Which method should consume `self` because it finalizes the builder?",
      "Which methods only need `&self` for inspection or borrowed views?",
      "Which mutations should use `&mut self` rather than rebuilding with a fresh clone?",
      "At the worker fan-out boundary, do you move, clone, or share through `Arc`?",
    ],
    acceptanceCriteria: [
      "You use receiver choices to express ownership transitions clearly.",
      "You justify at least one explicit clone in economic or semantic terms.",
      "You avoid both extremes: cloning everything and forcing everything through shared ownership.",
      "You name one tradeoff involving allocation, atomic cost, or API clarity.",
    ],
    hints: [
      "Builders often end with a consuming `build(self)` or `finish(self)`.",
      "Fan-out work may justify `Arc` when the underlying data is truly shared.",
    ],
  },
]

const reviewQuestions = [
  "What is the practical difference between moving a `String`, copying a `u64`, and cloning an `Arc<T>`?",
  "Why is `Copy` intentionally much narrower than 'cheap enough to duplicate'?",
  "When is `Cow<'a, str>` a better API than always returning `String`?",
  "Why is `Arc::clone` not the same thing as deep-cloning the inner value?",
  "How do receiver choices reduce unnecessary cloning in production APIs?",
]

const workingLoop = [
  "Name the current owner before classifying the line.",
  "Ask whether the next operation really needs independent ownership or only temporary access.",
  "Reserve `Copy` for small value types whose implicit duplication would never surprise a reviewer.",
  "Treat each `.clone()` as a design decision with an allocation or sharing story behind it.",
]

const copySafetyRubric = [
  "All fields must already be `Copy`.",
  "The type must not implement `Drop`.",
  "Two implicit duplicates must still make semantic sense.",
  "Heap ownership, sockets, files, locks, and ref-counted sharing should stay explicit.",
]

export function PageCh07CopyingDataVsCloningDataExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch07-copying-data-vs-cloning-data-exercises")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 07 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice the duplication choices that matter in real Rust code: when to move, when to copy, when to clone,
          when to borrow, and when a receiver or ownership boundary is the real fix.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat these as ownership review drills. The target is not “zero clones.” The target is deliberate clones,
                conservative `Copy`, borrowed read paths where possible, and receiver choices that make the data movement
                obvious to the next engineer.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(12)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 07
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

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Copy safety rubric</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {copySafetyRubric.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
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
                  Duplication drill
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
          title="Runnable lab · Manual Clone implementation"
          description={
            <>
              Implement <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Clone</code> for{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">JobTemplate</code> so the owned fields
              are duplicated correctly and later mutation of the clone does not affect the original.
            </>
          }
          filename="manual_clone_lab.rs"
          runKey="ch07_ex_manual_clone"
          expectedOutput={"original = billing 2\ncloned = billing 3\nretries = 2"}
          helperText={
            <>
              Tip: clone owned fields such as{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">String</code> and{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Vec&lt;String&gt;</code>. Copy the{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">usize</code> field directly.
            </>
          }
          initialCode={`#[derive(Debug)]\nstruct JobTemplate {\n    service: String,\n    steps: Vec<String>,\n    retries: usize,\n}\n\nimpl Clone for JobTemplate {\n    fn clone(&self) -> Self {\n        Self {\n            service: String::new(),\n            steps: Vec::new(),\n            retries: self.retries,\n        }\n    }\n}\n\nfn main() {\n    let original = JobTemplate {\n        service: String::from("billing"),\n        steps: vec![String::from("parse"), String::from("persist")],\n        retries: 2,\n    };\n\n    let mut cloned = original.clone();\n    cloned.steps.push(String::from("notify"));\n\n    println!("original = {} {}", original.service, original.steps.len());\n    println!("cloned = {} {}", cloned.service, cloned.steps.len());\n    println!("retries = {}", cloned.retries);\n}`}
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
            By the end of this page, you should be able to classify a line as move, copy, clone, or borrow without
            hedging, implement `Clone` manually for a realistic owned type, reject unsafe `Copy` candidates quickly, and
            remove clones from APIs by fixing the ownership or receiver contract instead of treating duplication as the
            first repair.
          </p>
        </section>
      </div>
    </div>
  )
}
