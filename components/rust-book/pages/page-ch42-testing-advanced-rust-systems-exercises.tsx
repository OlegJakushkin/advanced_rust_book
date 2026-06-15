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
    title: "Choose unit, integration, property, fuzz, snapshot, or benchmark from the claim",
    objective: "Practice selecting the cheapest test layer that can prove the real behavior instead of defaulting to one broad test shape.",
    starterPrompt:
      "Classify five needs, each to its cheapest test layer: (1) a state-machine invariant, (2) a public HTTP contract, (3) a hostile binary parser input space, (4) a large human-reviewable error report, and (5) a latency budget for one hot batch encoder.",
    prompts: [
      "Which need is best served by a unit test first?",
      "Which need wants a true integration test against a public boundary?",
      "Which need wants property testing because one invariant should hold across many generated cases?",
      "Which need wants fuzzing because the input space is adversarial or malformed by nature?",
      "Which need wants snapshot or golden review, and which one wants a benchmark budget instead?",
    ],
    acceptanceCriteria: [
      "You map each claim to a plausible primary test layer and justify it with cost and confidence.",
      "You distinguish snapshot or golden review from semantic assertions clearly.",
      "You keep performance budgets separate from functional correctness tests.",
    ],
    hints: [
      "Start with the claim, not with the tool you already know best.",
      "A good answer minimizes cost while preserving the right kind of evidence.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Find the missing layers in one test suite",
    objective: "Read a realistic but incomplete suite and explain which claims are still unproven.",
    starterPrompt:
      "A crate has only slow API integration tests. The domain model has no direct tests, the binary parser has no fuzz target, the async worker has sleep-based tests, and snapshot updates are accepted blindly.",
    prompts: [
      "Which invariants should move into unit or property tests?",
      "Which parser boundary wants fuzzing instead of only end-to-end fixtures?",
      "Why are sleep-based async tests brittle here?",
      "Which snapshot practice is too trusting for a production-facing report format?",
    ],
    acceptanceCriteria: [
      "You identify at least one missing unit or property layer, one missing fuzz layer, and one async determinism problem.",
      "You propose at least one replacement or repair for each gap.",
      "You explain why the current suite is expensive and still incomplete.",
    ],
    hints: [
      "The goal is not 'more tests'. The goal is the right missing tests.",
      "If the suite is slow and still vague, the layering is probably wrong.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Write property tests for a domain invariant",
    objective: "Design a property test around one real state invariant instead of only enumerating a few hand-picked examples.",
    starterPrompt:
      "Take a small domain type such as a quota window, account ledger, or reservation tracker and write a property asserting the state never exceeds its declared limit after any generated sequence of operations.",
    prompts: [
      "State the invariant before you state the generator.",
      "Use generated operations, not only a couple of example sequences.",
      "Keep a deterministic reference rule if that helps explain the expectation.",
      "Say what should shrink when the invariant fails.",
    ],
    acceptanceCriteria: [
      "You express one real invariant in clear Rust-domain terms.",
      "You generate a sequence or batch of inputs rather than a single fixed example.",
      "You explain how a failing case becomes smaller or easier to diagnose under shrinking.",
    ],
    hints: [
      "A good property reads like a rule the business or subsystem actually cares about.",
      "The generator serves the invariant, not the other way around.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Plan fuzz targets for unsafe parsing code",
    objective: "Choose the right harness boundary and corpus strategy for an unsafe or FFI-adjacent parser.",
    starterPrompt:
      "You inherit a framed binary parser with one small unsafe fast path that reconstructs headers from bytes and then walks a payload cursor.",
    prompts: [
      "Which function should be the fuzz boundary: raw bytes to parse result, or a much larger transport stack?",
      "Which seed corpus cases should exist on day one: empty, truncated, exact header, oversized length, duplicated frame, malformed footer?",
      "How will you compare the unsafe fast path against a safer reference parser or structural invariant?",
      "What crash or sanitizer signals should fail the fuzz lane immediately?",
    ],
    acceptanceCriteria: [
      "You pick a small direct fuzz boundary and justify it.",
      "You define at least five useful seed inputs or input classes.",
      "You mention either a reference implementation or explicit unsafe invariants to check.",
      "You include at least one tool signal such as sanitizer failure, panic, or UB detection.",
    ],
    hints: [
      "The best fuzz target is usually smaller than the whole service.",
      "Keep the harness close enough to the parser that the crashing bytes still mean something.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Design async integration tests for a service boundary",
    objective: "Make time, retries, task joins, and durable side effects explicit in an async test plan.",
    starterPrompt:
      "You are testing `HTTP request -> async worker -> database write -> queue publish`, and the retry path must stay idempotent under duplicate delivery or cancellation.",
    prompts: [
      "Which boundaries deserve fake time or a paused runtime?",
      "Which durable side effects should be asserted before the handler considers the work complete?",
      "How will the test distinguish join failure, inner failure, and cancellation?",
      "Which IDs should appear in the assertions so the failure stays attributable later?",
    ],
    acceptanceCriteria: [
      "You include at least one deterministic time-control technique.",
      "You define one idempotency or duplicate-suppression assertion at the durable boundary.",
      "You separate task-join behavior from inner operation behavior.",
      "You describe what happens to in-flight work under cancellation.",
      "You mention at least one request, task, or message identity field in the assertions.",
    ],
    hints: [
      "If the plan still depends on `sleep`, it probably is not deterministic enough.",
      "The right assertion is often at the database or outbox boundary, not only at the HTTP status code.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Build a production test matrix for a distributed Rust subsystem",
    objective: "Combine correctness, fuzzing, snapshots, golden files, and performance budgets into one reviewable plan.",
    starterPrompt:
      "Create a test matrix for a service that parses binary frames, enriches them asynchronously, writes an outbox entry, renders operator-facing reports, and exposes one FFI plugin boundary.",
    prompts: [
      "Which claims stay in unit or property tests?",
      "Which boundaries want fuzz targets or unsafe invariant tests?",
      "Which output wants a golden file and which wants a snapshot?",
      "Which benchmark budget or regression lane belongs in CI, and which one belongs in a separate performance lane?",
      "What is the minimum end-to-end suite that still proves the transport reality without turning CI into a random-timing lottery?",
    ],
    acceptanceCriteria: [
      "You define at least four distinct layers or lanes in the matrix.",
      "You include one property or invariant layer, one fuzz or unsafe layer, one output-review layer, and one performance-regression layer.",
      "You justify why each layer exists and what claim it proves.",
      "You keep the end-to-end layer narrow enough to stay maintainable.",
    ],
    hints: [
      "The cleanest matrix proves different claims at different costs.",
      "If every claim is left to end-to-end tests, the suite will usually be slow and still incomplete.",
    ],
  },
]

const reviewQuestions = [
  "Why is a property test often a better fit than several ad hoc example tests for one invariant?",
  "What does fuzzing prove that a curated integration fixture set usually does not prove?",
  "Why are sleep-based async tests brittle even when they 'usually pass' locally?",
  "What is the practical difference between golden files and snapshot tests?",
  "Why should benchmark regression budgets be looser and more isolated than ordinary correctness assertions?",
]

const workingLoop = [
  "State the invariant or failure model first.",
  "Choose the cheapest test layer that can prove that claim honestly.",
  "Remove nondeterminism with fake time, normalized IDs, and bounded queues where possible.",
  "Add hostile-input coverage for parsers and unsafe boundaries explicitly.",
  "Keep performance budgets visible, but separate them from semantic correctness.",
]

export function PageCh42TestingAdvancedRustSystemsExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch42-testing-advanced-rust-systems-exercises")
  const mainPageIndex = getPageIndexById("ch42-testing-advanced-rust-systems")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 42 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice advanced testing the way it survives review: invariant-first, deterministic where possible, hostile to
          malformed inputs where necessary, and honest about performance and distributed replay boundaries.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a proof-design review. The strongest answer does not stop at “add tests.” It says
                which claim matters, which layer proves it most cheaply, how nondeterminism is controlled, and which
                failure would still escape if the layer were missing.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 42
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
                  Testing drill
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
          title="Runnable lab · Deterministic property-style invariant harness"
          description={
            <>
              Repair the starter so the quota object refuses reservations that would exceed the limit, and the deterministic
              invariant harness reports zero violations. This keeps the browser example dependency-light while teaching the
              same invariant-first shape you would later lift into a property-testing crate. This lab is a companion to
              Example 1 in the main chapter, not the same program: the lab prints a{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">violations</code> count, while the
              chapter example prints the <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">limit</code>,
              so the third output line differs by design.
            </>
          }
          filename="property_invariant_lab.rs"
          runKey="ch42_ex_property_invariant"
          expectedOutput={"cases = 5\nall valid = true\nviolations = 0"}
          helperText={
            <>
              Tip: the fix belongs in the state transition itself. If one reservation would exceed the limit, return{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">false</code> and leave the used value
              unchanged. The harness already counts violations for you.
            </>
          }
          initialCode={`#[derive(Debug, Clone, Copy)]
struct Quota {
    limit: u32,
    used: u32,
}

impl Quota {
    fn reserve(&mut self, qty: u32) -> bool {
        self.used += qty;
        true
    }
}

fn invariant_holds(limit: u32, ops: &[u32]) -> bool {
    let mut quota = Quota { limit, used: 0 };

    for &qty in ops {
        let _accepted = quota.reserve(qty);
        if quota.used > quota.limit {
            return false;
        }
    }

    true
}

fn main() {
    let scenarios: &[&[u32]] = &[
        &[1_u32, 1, 1],
        &[4_u32, 4],
        &[5_u32, 4],
        &[2_u32, 2, 2, 2],
        &[8_u32],
    ];

    let all_valid = scenarios.iter().all(|ops| invariant_holds(8, ops));
    let violations = scenarios.iter().filter(|ops| !invariant_holds(8, ops)).count();

    println!("cases = {}", scenarios.len());
    println!("all valid = {}", all_valid);
    println!("violations = {}", violations);
}`}
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
            By the end of this page, you should be able to choose unit, integration, property, fuzz, snapshot, golden, or
            benchmark layers from the real claim being tested; remove nondeterminism from async and distributed paths; and
            describe one production-ready testing matrix another senior engineer could review quickly.
          </p>
        </section>
      </div>
    </div>
  )
}
