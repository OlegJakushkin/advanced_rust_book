"use client"

import { useEffect } from "react"
import { ArrowLeft, Lightbulb, Target, Trophy, Wrench } from "lucide-react"
import { useBook } from "../book-context"
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
    title: "Choose Mutex, RwLock, Condvar, atomic, barrier, or channel from the workload",
    objective: "Practice mapping a workload to the primitive that matches its ownership and visibility story.",
    starterPrompt:
      "Classify six cases: a shared mutable retry map, a read-mostly config snapshot, a worker waiting for a queue to become non-empty, a hot metrics counter, a startup start-gun for several workers, and one owner thread receiving commands.",
    prompts: [
      "Which case is truly shared mutable state?",
      "Which case is a read-mostly state boundary?",
      "Which case is really a waited-on predicate under one mutex?",
      "Which case is small enough for atomics?",
      "Which case is a phase boundary rather than a state container?",
      "Which case wants ownership transfer rather than shared mutation?",
      "For the start-gun case, how does a barrier's phase-gate semantics differ from a condvar's predicate-wait, and why does that difference matter?",
    ],
    acceptanceCriteria: [
      "You map each case to a plausible primitive and justify the choice with state shape.",
      "You distinguish a condvar predicate from a channel handoff clearly.",
      "You avoid treating atomics as the default answer for every shared state problem.",
    ],
    hints: [
      "Start from who should own mutation.",
      "Then ask whether readers are frequent, whether waiting is involved, and whether the invariant fits in one atomic word.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Replace a Mutex with RwLock where appropriate",
    objective: "Read a shared-state design and decide whether read-mostly access makes `RwLock` a better fit than `Mutex`.",
    starterPrompt:
      "You inherit `Arc<Mutex<HashMap<String, Config>>>` for a route-to-config cache. Reads dominate the workload and writes happen only during occasional reloads.",
    prompts: [
      "Which operations become `read()` and which become `write()`?",
      "What workload assumption makes `RwLock` plausible here?",
      "When would a plain mutex still be calmer or faster?",
      "Could channels or immutable snapshots replace the shared-state design entirely?",
    ],
    acceptanceCriteria: [
      "You explain why read-mostly access is the main signal for considering `RwLock`.",
      "You identify at least one case where `RwLock` would still be the wrong upgrade.",
      "You distinguish the primitive change from the larger ownership-model change.",
    ],
    hints: [
      "The goal is not to make the code look more concurrent. The goal is to fit the real access pattern.",
      "If writes are frequent or reads are tiny, a mutex can still be the better tool.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Reason about Acquire and Release in a toy publication protocol",
    objective: "Implement a small atomic publication pattern where a flag publishes a value to a later reader.",
    starterPrompt:
      "Use `AtomicUsize` and `AtomicBool` so one side publishes `42` and another side observes it only after the ready flag becomes visible.",
    prompts: [
      "Keep the payload word itself relaxed.",
      "Use `Release` on the publishing flag store.",
      "Use `Acquire` on the consuming flag load.",
      "Print whether the flag is ready and the consumed value.",
    ],
    acceptanceCriteria: [
      "The publication flag uses `Release` on the writer side.",
      "The consumer uses `Acquire` when it trusts the published state.",
      "The runnable lab prints the expected ready flag and published value.",
      "You can explain why the flag, not the payload load, carries the ordering edge.",
    ],
    hints: [
      "This pattern is deliberately small. The point is the ordering pair, not the arithmetic.",
      "If the consumer has not performed an Acquire load of the flag, it should not trust the published payload.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Find and fix a deadlock scenario",
    objective: "Repair a two-lock design that acquires the same locks in opposite order on different paths.",
    starterPrompt:
      "Thread A locks `accounts` then `audit`. Thread B locks `audit` then `accounts`. The incident is rare, but it exists.",
    prompts: [
      "What is the exact deadlock condition here?",
      "Would one global lock order repair it?",
      "Could one subsystem become the owner with commands sent over a channel instead?",
      "Would splitting or consolidating the protected state reduce the need for two locks at all?",
    ],
    acceptanceCriteria: [
      "You explain the circular wait condition concretely.",
      "You propose at least one repair that is mechanically enforceable, not just 'be careful.'",
      "You justify whether the better repair is lock ordering, state reshaping, or ownership transfer through channels.",
    ],
    hints: [
      "The bug is structural, not statistical.",
      "A rare deadlock is still a production design failure.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Repair a condvar wait loop before it flakes under load",
    objective: "Fix a condvar-based design that treats wakeup as truth instead of re-checking the predicate.",
    starterPrompt:
      "A worker does `if queue.is_empty() { condvar.wait(...) }` and then assumes a job is ready immediately after waking.",
    prompts: [
      "Why is `if` the wrong shape here?",
      "Which predicate belongs under the mutex?",
      "When should the notifying thread update the predicate relative to the notification call?",
      "Would a channel remove the need for the shared queue entirely?",
    ],
    acceptanceCriteria: [
      "You replace wakeup-as-truth with predicate-in-a-loop reasoning.",
      "You explain why the shared predicate is still the source of truth after wakeup.",
      "You note at least one case where a channel-based one-owner design would be simpler.",
    ],
    hints: [
      "The condvar tells you to re-check. It does not tell you the predicate is now true.",
      "The mutex-protected state and the condvar are one design, not two independent pieces.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose the right primitive for a service under load",
    objective: "Make synchronization choices across a realistic service with caches, worker coordination, and shared metrics.",
    starterPrompt:
      "You are designing `accept -> parse -> route -> update metrics -> consult config -> enqueue work -> wait for completion -> publish result`.",
    prompts: [
      "Which parts want immutable shared state with `Arc<T>` only?",
      "Which parts, if any, want `Mutex` or `RwLock`?",
      "Which parts want owned commands or results over channels?",
      "Where would atomics be enough for counters or flags?",
      "What would you measure in production before upgrading to a more complex primitive?",
    ],
    acceptanceCriteria: [
      "You assign at least one subsystem to channels and at least one to shared state or atomics with a reason.",
      "You justify any `RwLock` choice with a read-mostly access pattern rather than aesthetics.",
      "You mention at least one observability hook such as lock wait, queue depth, wakeup rate, or retry latency.",
      "You keep lock-free structures off the critical path unless a measured requirement appears.",
    ],
    hints: [
      "One service can legitimately use several primitives at once.",
      "The cleanest answer keeps each mutable subsystem with one obvious owner whenever possible.",
    ],
  },
]

const reviewQuestions = [
  "Why is `RwLock` not automatically better than `Mutex`?",
  "Why should a condvar wait happen in a loop instead of a one-shot `if`?",
  "What does `Release` on a store and `Acquire` on a load actually buy you?",
  "When is a barrier the right tool, and when does it become the wrong primitive for state propagation?",
  "From the pitfalls section, why are lock-free structures hard even for experienced engineers?",
]

const workingLoop = [
  "Name the state invariant before naming the primitive.",
  "Decide whether one owner plus messages is calmer than shared mutable state.",
  "If the state is shared, decide whether it is write-heavy, read-mostly, or small enough for atomics.",
  "If waiting is involved, name the predicate and who changes it.",
  "Measure contention, queue depth, and latency before escalating to a more complex primitive.",
]

export function PageCh23SynchronizationPrimitivesExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = 49
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 23 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice synchronization the way it behaves in production: choose the primitive from the state model, reason about
          visibility explicitly, and repair deadlock-prone designs before they bite under load.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a state-and-ownership review. The strongest answer explains who owns mutation, what
                other threads are allowed to observe, which predicate wakeups correspond to, and why the chosen primitive
                matches that story.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(48)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 23
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
                  Synchronization drill
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
          title="Runnable lab · Acquire and Release publication"
          description={
            <>
              Repair the starter so the ready flag publishes the payload value with a proper ordering edge. The checker expects a
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs mx-1">Release</code>
              store on the flag and an
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs mx-1">Acquire</code>
              load on the consumer path.
            </>
          }
          filename="acquire_release_lab.rs"
          runKey="ch23_ex_acquire_release"
          expectedOutput={"ready = true\nvalue = 42"}
          helperText={
            <>
              Tip: keep the payload word relaxed. Change the ready flag store to
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs mx-1">Ordering::Release</code>
              and the consuming flag load to
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs mx-1">Ordering::Acquire</code>.
            </>
          }
          initialCode={`use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};\nuse std::thread;\n\nfn publish(value: &AtomicUsize, ready: &AtomicBool, next: usize) {\n    value.store(next, Ordering::Relaxed);\n    ready.store(true, Ordering::Relaxed);\n}\n\nfn try_consume(value: &AtomicUsize, ready: &AtomicBool) -> Option<usize> {\n    if ready.load(Ordering::Relaxed) {\n        Some(value.load(Ordering::Relaxed))\n    } else {\n        None\n    }\n}\n\nfn main() {\n    let value = AtomicUsize::new(0);\n    let ready = AtomicBool::new(false);\n\n    // The publisher and consumer run on two threads, so the Relaxed orderings\n    // above are a real bug: upgrade them to Release/Acquire to publish safely.\n    let consumed = thread::scope(|scope| {\n        scope.spawn(|| publish(&value, &ready, 42));\n        scope\n            .spawn(|| loop {\n                if let Some(found) = try_consume(&value, &ready) {\n                    break found;\n                }\n                thread::yield_now();\n            })\n            .join()\n            .unwrap()\n    });\n\n    println!(\"ready = {}\", ready.load(Ordering::Relaxed));\n    println!(\"value = {}\", consumed);\n}`}
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
            By the end of this page, you should be able to justify when a mutex should stay a mutex, when an
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">RwLock</code>
            earns its cost, why condvars wait on predicates rather than on hope, how Acquire and Release form a publication
            edge, and how to repair a deadlock by changing the structure rather than by waiting for better luck.
          </p>
        </section>
      </div>
    </div>
  )
}
