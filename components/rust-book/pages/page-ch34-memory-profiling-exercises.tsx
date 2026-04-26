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
    title: "Match the symptom to the measurement",
    objective: "Choose whether the next step should be allocation counts, heap snapshots, RSS tracking, queue metrics, or cycle inspection.",
    starterPrompt:
      "Classify four symptoms: rising RSS after a burst, stable RSS but rising task count, flat heap snapshots with a high allocation rate, and a graph of `Rc` nodes that never seems to disappear.",
    prompts: [
      "Which symptom points first toward fragmentation or allocator retention?",
      "Which symptom points first toward async backlog rather than a leak?",
      "Which symptom points first toward churn rather than retained memory?",
      "Which symptom points first toward logical reachability and cycle inspection?",
    ],
    acceptanceCriteria: [
      "You choose a distinct first measurement for each symptom.",
      "You distinguish retained memory from allocation churn clearly.",
      "You avoid calling every memory symptom a leak before evidence exists.",
    ],
    hints: [
      "Start by asking what changed: owner count, queue depth, or allocator behavior.",
      "A useful first measurement is the one that rules out the most wrong theories quickly.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Find clone pressure in a sample workload",
    objective: "Read a request path and identify where deep clones, not Arc clones, are driving memory growth.",
    starterPrompt:
      "A route filter clones owned strings into an output list, then later formats another owned label per selected item before queueing work.",
    prompts: [
      "Which clone creates another owner of the same allocation and which clone duplicates underlying bytes?",
      "Which helper only needed borrowed access?",
      "Where should ownership become explicit if the next stage truly must outlive the input?",
      "What local counter would you add before reaching for a whole-process heap profiler?",
    ],
    acceptanceCriteria: [
      "You identify at least one deep-clone site correctly.",
      "You propose at least one borrowed API repair.",
      "You mention one local measurement such as clone count or cloned-byte count.",
    ],
    hints: [
      "Look for `.to_string()`, `.clone()`, and formatting inside a loop.",
      "The first fix is often API shape, not allocator choice.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Instrument clone pressure on purpose",
    objective: "Add a narrow local measurement before moving to a heavier heap profiler.",
    starterPrompt:
      "Write a small helper that counts how many selected routes are cloned and how many bytes those clones represent.",
    prompts: [
      "Count clones separately from selected outputs.",
      "Track bytes from the borrowed source length before conversion.",
      "Keep the instrumentation local to the hot path instead of turning it into a global abstraction.",
      "Explain when you would delete this instrumentation after the incident is resolved.",
    ],
    acceptanceCriteria: [
      "You count at least clone events and cloned bytes explicitly.",
      "The measurement stays local and workload-focused.",
      "You explain why this is a comparative tool rather than a complete memory profile.",
    ],
    hints: [
      "A small counter is often enough to prove the next refactor target.",
      "The important question is what changed across the refactor or incident window.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Diagnose an Rc cycle leak",
    objective: "Repair a graph whose strong edges make collection impossible even though there is no unsafe code.",
    starterPrompt:
      "A tree stores parent and child edges as strong `Rc<Node>` references and the root never seems to disappear after local work ends.",
    prompts: [
      "Which edge is observational rather than owning?",
      "What should become `Weak<Node>`?",
      "What strong-count signal would you inspect before and after the repair?",
      "Would this design be calmer with arena IDs instead of shared ownership at all?",
    ],
    acceptanceCriteria: [
      "You explain the logical leak precisely in terms of strong ownership count.",
      "You replace at least one back-edge with `Weak<T>` in the design.",
      "You mention one alternative such as arena handles when shared ownership is not semantically real.",
    ],
    hints: [
      "The bug is usually not 'Rust leaked.' The bug is 'the graph still has owners.'",
      "Ask which edge truly owns lifetime and which edge only wants lookup.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Profile async memory usage before calling it a leak",
    objective: "Read an async pipeline and decide whether the real issue is queue growth, too many tasks, large payloads, or an actual retention bug.",
    starterPrompt:
      "A Tokio service has an unbounded channel, a `spawn` per input item, and a large owned payload crossing several awaits before the final consumer falls behind.",
    prompts: [
      "Which metrics should you collect first: queue depth, task count, payload size, or all three?",
      "Which boundary wants a semaphore or bounded queue?",
      "What should become smaller or more borrowed before the spawned task boundary?",
      "When would you still suspect a true leak after those backlog fixes?",
    ],
    acceptanceCriteria: [
      "You identify at least one boundedness failure in the design.",
      "You propose a queue or concurrency cap with a reason.",
      "You mention at least one payload-shape repair and one metric to confirm the change.",
    ],
    hints: [
      "A growing backlog keeps memory alive even if the objects are perfectly reachable by design.",
      "Measure in-flight work before debugging allocator internals.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Prepare a memory profiling checklist for a real service",
    objective: "Build the review checklist another engineer could use during an incident or a regression investigation.",
    starterPrompt:
      "Create a checklist for a service that accepts requests, parses them, queues owned work, fans out to async tasks, uses an arena during parsing, and keeps a read-mostly cache.",
    prompts: [
      "Which numbers belong in the first page of the investigation: RSS, live bytes, queue depth, task count, clone count, or all of them?",
      "Which leak candidates should be named explicitly: Rc or Arc cycles, unbounded queues, non-evicting caches, oversized arenas?",
      "Which OS-specific tools would you choose on Linux, macOS, and Windows?",
      "Which acceptance condition tells you the incident is actually resolved instead of merely masked?",
    ],
    acceptanceCriteria: [
      "Your checklist includes allocator or heap signals plus workload signals such as queue depth or task count.",
      "Your checklist explicitly names at least three likely retention sources.",
      "Your checklist includes at least one Linux, one macOS, and one Windows tool choice.",
      "Your checklist defines one concrete success condition after the fix.",
    ],
    hints: [
      "A checklist is most useful when it forces the team to rule out the wrong theories quickly.",
      "Include one stop condition such as RSS after burst, queue age, or cloned bytes per request.",
    ],
  },
]

const reviewQuestions = [
  "Why is a local clone counter often a good first memory-profiling tool?",
  "What is the practical difference between allocation churn and retained live data?",
  "Why can RSS stay high after the logical working set falls?",
  "Why are unbounded queues and task floods often memory bugs even when no object is unreachable?",
  "What does `Weak<T>` repair that a strong `Rc<T>` or `Arc<T>` back-edge cannot?",
]

const workingLoop = [
  "State the symptom first: growth, churn, backlog, or logical leak.",
  "Measure allocation, retention, and queueing separately before touching code.",
  "Fix one ownership or boundedness boundary at a time.",
  "Re-measure the same symptom after the repair so the team knows the change actually worked.",
]

const checklistItems = [
  "Record RSS, queue depth, task count, and request rate at the same time.",
  "Compare heap snapshots or retained owners before and after the suspected growth window.",
  "Count deep clones on hot paths before assuming allocator or runtime behavior is the main issue.",
  "Inspect `Rc` or `Arc` graphs, caches, and registries for non-owning edges that stayed strong.",
  "If async is involved, cap queue depth and in-flight tasks before calling it a true leak.",
]

export function PageCh34MemoryProfilingExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch34-memory-profiling-exercises")
  const mainPageIndex = getPageIndexById("ch34-memory-profiling")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 34 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice memory profiling the way it survives production review: start with the symptom, measure the right
          boundary, and only then choose the repair.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a profiling review. The strongest answer does not say only “optimize memory.” It
                says what to measure, why that number matters, what ownership boundary is suspicious, and how the fix will
                be verified afterward.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 34
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
          <h3 className="text-lg font-semibold text-foreground mb-3">Memory profiling checklist</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {checklistItems.map((item) => (
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
                  Memory drill
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
          title="Runnable lab · Remove clone pressure from a hot route filter"
          description={
            <>
              Repair the starter so the selected routes stay borrowed instead of cloned. The browser runner counts clone
              activity through the helper
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs mx-1">track_clone</code>
              and expects that count to fall to zero.
            </>
          }
          filename="clone_pressure_lab.rs"
          runKey="ch34_ex_clone_pressure"
          expectedOutput={"selected = 2\nclones = 0"}
          helperText={
            <>
              Tip: the calm repair is to return borrowed routes, not owned cloned strings. Add a lifetime parameter to the
              function signature, keep the input borrowed, and push the borrowed route directly into the output.
            </>
          }
          initialCode={`use std::sync::atomic::{AtomicUsize, Ordering};

static CLONES: AtomicUsize = AtomicUsize::new(0);

fn track_clone(value: &str) -> String {
    CLONES.fetch_add(1, Ordering::Relaxed);
    value.to_string()
}

fn hot_routes(routes: &[&str]) -> Vec<String> {
    let mut out = Vec::with_capacity(routes.len());

    for &route in routes {
        if route.starts_with("/api/") {
            out.push(track_clone(route));
        }
    }

    out
}

fn main() {
    let routes = ["/api/orders", "/health", "/api/users"];
    CLONES.store(0, Ordering::Relaxed);

    let selected = hot_routes(&routes);

    println!("selected = {}", selected.len());
    println!("clones = {}", CLONES.load(Ordering::Relaxed));
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
            By the end of this page, you should be able to choose the right memory signal for the symptom in front of you,
            instrument clone pressure or backlog locally, diagnose an `Rc` cycle leak, and write a memory profiling
            checklist another senior engineer could use under incident pressure.
          </p>
        </section>
      </div>
    </div>
  )
}
