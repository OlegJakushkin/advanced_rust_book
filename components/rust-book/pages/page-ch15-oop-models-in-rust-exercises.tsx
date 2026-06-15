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
    title: "Choose composition, open polymorphism, or closed polymorphism honestly",
    objective: "Practice deciding whether a problem wants plain composition, traits, trait objects, or enums.",
    starterPrompt:
      "Classify four cases: a payment service with swappable fraud checks, a fixed set of workflow commands, a reusable retry helper shared by three services, and a deployment-time plugin registry for exporters.",
    prompts: [
      "Which case wants composition with helper structs and no polymorphism at all?",
      "Which case wants an enum because the variant set is closed?",
      "Which case wants a trait because several implementations are semantically real?",
      "Which case truly wants runtime trait objects because one collection or registry must hold heterogeneous implementations?",
    ],
    acceptanceCriteria: [
      "You distinguish open and closed polymorphism clearly.",
      "You choose composition where no polymorphism is actually needed.",
      "You justify at least one choice with deployment or runtime behavior, not only with abstract vocabulary.",
    ],
    hints: [
      "Ask whether the set of variants is closed inside one crate or open across time and deployment.",
      "The calmest design is often the one that uses the fewest abstraction mechanisms honestly.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Collapse an inheritance tree into Rust pieces",
    objective: "Read a familiar base-class design and restate it as Rust-native components instead of a direct port.",
    starterPrompt:
      "You inherit `BaseNotifier` with shared metrics fields plus subclasses `EmailNotifier`, `SlackNotifier`, and `WebhookNotifier`. Rewrite the design in words using Rust terms.",
    prompts: [
      "Which data belongs in a composed metrics or configuration component?",
      "Which behavior belongs in a trait?",
      "Should notifier selection be generic, dynamic, or enum-based at the call site?",
      "Where should encapsulation live once there is no base class with protected fields?",
    ],
    acceptanceCriteria: [
      "You separate shared state from shared behavior precisely.",
      "You use traits, composition, modules, and visibility as distinct tools.",
      "You choose static or dynamic dispatch from the boundary rather than by habit.",
    ],
    hints: [
      "A base class often hid two unrelated concerns: reusable fields and replaceable behavior.",
      "Rust usually wants those concerns split apart.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Model closed polymorphism with an enum",
    objective: "Implement a small closed variant set without trait objects.",
    starterPrompt:
      "Define an enum such as `Command` or `Transport` with two or three variants and write one function that handles every variant with `match`.",
    prompts: [
      "Keep the variant set closed and explicit.",
      "Return a small owned or borrowed result rather than logging from everywhere.",
      "Let the compiler's exhaustiveness checking do real work for you.",
    ],
    acceptanceCriteria: [
      "The design uses an enum, not boxed trait objects, for a closed set.",
      "The handler uses `match` exhaustively.",
      "Adding a new variant would force a compiler-visible repair in the operation.",
    ],
    hints: [
      "If you already know every variant at compile time, the enum is usually the point.",
      "The gain is not just speed. It is exhaustiveness and simpler review.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair encapsulation after a direct OOP port",
    objective: "Refactor a port that exposed too much structure publicly because it was modeled like a class hierarchy.",
    starterPrompt:
      "A ported design made every field `pub` so downstream code could mutate state the way subclass code once did. Repair the boundary.",
    prompts: [
      "Which fields should become private immediately?",
      "Which methods or constructors should replace direct field mutation?",
      "Should the module re-export a narrower public API rather than exposing internal submodules directly?",
    ],
    acceptanceCriteria: [
      "You move representation details behind private fields or narrower visibility.",
      "You preserve the externally useful operations through methods or constructors.",
      "You explain the refactor as encapsulation repair, not just style cleanup.",
    ],
    hints: [
      "Rust gives you modules and visibility for a reason. Use them before you widen the public surface forever.",
      "A public field is an API promise, not a temporary shortcut.",
    ],
  },
  {
    number: 5,
    kind: "state modeling",
    title: "Refactor a state machine into Rust-native transitions",
    objective: "Replace flag-based or inheritance-heavy state transitions with an enum or typestate model.",
    starterPrompt:
      "You inherit `status: String` plus booleans like `approved` and `published`. Redesign the model so invalid combinations stop existing.",
    prompts: [
      "Would an enum represent the runtime state clearly enough?",
      "Would typestate be justified if the transitions are compile-time linear and API-facing?",
      "How will the redesign prevent `published = true` while `status = \"draft\"`?",
    ],
    acceptanceCriteria: [
      "You eliminate impossible flag combinations from the model.",
      "You choose enum or typestate with a reason tied to runtime or API shape.",
      "You describe at least one transition explicitly rather than leaving it as ad hoc mutation.",
    ],
    hints: [
      "This is one of Rust's strongest improvements over classical OOP state models.",
      "If the same runtime value can be in several states, start with an enum. If callers should only hold valid phase-specific types, typestate may be stronger.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose enums, traits, trait objects, and typestate across one service platform",
    objective: "Make the OOP-modeling choices explicit for a realistic production system.",
    starterPrompt:
      "You are designing `ingest -> validate -> enrich -> route -> persist -> export`, with a fixed set of input commands, pluggable exporters, and a review/publish workflow for operator-authored rules.",
    prompts: [
      "Which parts are closed variant sets and therefore enum-shaped?",
      "Which parts are open plugin seams and therefore trait-object-shaped or trait-bound generic boundaries?",
      "Where is plain composition enough with no polymorphism at all?",
      "Would the operator rule workflow benefit from enum state or typestate, and why?",
    ],
    acceptanceCriteria: [
      "You assign at least one concern to enums, one to traits or trait objects, and one to plain composition.",
      "You justify one runtime-dispatch boundary in operational terms.",
      "You justify one closed-polymorphism boundary in domain terms.",
      "You mention at least one observability or testing hook, such as exhaustive state tests, plugin contract tests, or event-log rendering.",
    ],
    hints: [
      "One service can legitimately use several modeling styles at once.",
      "The best answer says which tool fits each boundary, not which tool is globally best.",
    ],
  },
]

const reviewQuestions = [
  "What is the difference between open polymorphism and closed polymorphism in Rust design?",
  "Why does composition usually replace inheritance for shared state and shared helpers?",
  "When is `dyn Trait` the honest runtime model instead of an enum?",
  "Why are enums and typestate often better than classical state-pattern objects in Rust?",
  "Where does encapsulation usually live in Rust if not in a base class hierarchy?",
]

const workingLoop = [
  "Decide whether the domain set is open or closed before choosing traits or enums.",
  "Separate shared data, shared behavior, and visibility rules before you talk about dispatch.",
  "If a state machine is involved, remove invalid states first and worry about API aesthetics second.",
  "Prefer the least dynamic model that still tells the truth about the workload.",
]

export function PageCh15OopModelsInRustExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch15-oop-models-in-rust-exercises")
  const mainPageIndex = getPageIndexById("ch15-oop-models-in-rust")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 15 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice translating familiar class-heavy instincts into Rust-native modeling choices: composition, traits,
          enums, module visibility, and state machines that stop impossible cases from compiling.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a modeling review, not a syntax puzzle. The best answer explains why a boundary is
                open or closed, why a component is composed instead of inherited, and why a state machine should or should
                not be pushed into the type system.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 15
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
                  {exercise.kind}
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
          title="Runnable lab · Typestate workflow"
          description={
            <>
              Repair the starter so the workflow uses three types with explicit transitions. The checker expects the
              published post to have a non-empty slug and to print{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">rust-oop</code>.
            </>
          }
          filename="typestate_workflow_lab.rs"
          runKey="ch15_ex_typestate_post"
          expectedOutput={"published = true\nslug = rust-oop"}
          helperText={
            <>
              Tip: the point is not inheritance. The point is one valid transition per type. Keep the draft-to-review and
              review-to-published handoffs explicit, and build the slug when the value becomes published: derive it from
              the title with <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">{`.to_lowercase().replace(' ', "-")`}</code>.
            </>
          }
          initialCode={`struct DraftPost {\n    title: String,\n}\n\nstruct ReviewPost {\n    title: String,\n}\n\nstruct PublishedPost {\n    title: String,\n    slug: String,\n}\n\nimpl DraftPost {\n    fn new(title: &str) -> Self {\n        Self {\n            title: title.to_string(),\n        }\n    }\n\n    fn request_review(self) -> ReviewPost {\n        ReviewPost { title: self.title }\n    }\n}\n\nimpl ReviewPost {\n    fn publish(self) -> PublishedPost {\n        PublishedPost {\n            title: self.title,\n            slug: String::new(),\n        }\n    }\n}\n\nimpl PublishedPost {\n    fn slug(&self) -> &str {\n        &self.slug\n    }\n}\n\nfn main() {\n    let draft = DraftPost::new(\"Rust OOP\");\n    let review = draft.request_review();\n    let published = review.publish();\n\n    println!(\"published = {}\", !published.slug().is_empty());\n    println!(\"slug = {}\", published.slug());\n}`}
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
            By the end of this page, you should be able to defend when Rust wants composition, traits, trait objects,
            enums, or typestate; replace an inheritance-shaped design with clearer ownership and visibility boundaries; and
            model workflows in a way that removes invalid states instead of documenting them after the fact.
          </p>
        </section>
      </div>
    </div>
  )
}
