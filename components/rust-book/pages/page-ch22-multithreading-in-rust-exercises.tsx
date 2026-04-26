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
    title: "Decide whether a type is Send, Sync, both, or neither",
    objective: "Practice reading thread-boundary capability from type semantics instead of from guesswork.",
    starterPrompt:
      "Classify `String`, `Rc<String>`, `Arc<String>`, `RefCell<Vec<u8>>`, `Mutex<Vec<u8>>`, and one wrapper around a raw pointer you have not audited.",
    prompts: [
      "Which values can move to another thread safely as owned values?",
      "Which shared references are safe to use from multiple threads?",
      "Which type is single-thread only because the ownership counter or borrow checks are not thread-safe?",
      "Which type should never get an `unsafe impl Send` or `Sync` casually?",
    ],
    acceptanceCriteria: [
      "You define `Send` and `Sync` precisely before classifying any example.",
      "You identify `Rc<T>` as not appropriate for thread transfer or cross-thread sharing.",
      "You distinguish `Arc<T>` from `Arc<Mutex<T>>` instead of treating them as the same idea.",
      "You state that a raw-pointer wrapper needs an explicit proof before any unsafe auto-trait impl is acceptable.",
    ],
    hints: [
      "Start from ownership movement first, then shared-reference safety second.",
      "A type that compiles in one thread is not automatically safe to move or share across threads.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Compare a channel-based design with a shared-state design",
    objective: "Read two production shapes and explain when each one is the calmer model.",
    starterPrompt:
      "Compare a worker-result pipeline built around `mpsc::channel` against a design built around `Arc<Mutex<HashMap<String, usize>>>`.",
    prompts: [
      "Which design keeps one thread as the owner of mutation?",
      "Which design makes contention and lock scope the main runtime risk?",
      "Which design is easier to reason about when message order matters?",
      "Which design is easier to reason about when many threads truly need to observe and update the same structure?",
    ],
    acceptanceCriteria: [
      "You explain ownership and mutation authority clearly for both designs.",
      "You name one operational win and one operational cost for message passing.",
      "You name one operational win and one operational cost for shared-state locking.",
      "You avoid claiming that one model is globally superior in every workload.",
    ],
    hints: [
      "Ask where the mutable state really lives.",
      "A strong answer talks about contention, backlog, and failure visibility, not only syntax.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Move owned jobs into worker threads and report totals",
    objective: "Implement a small multithreaded design where workers own their job batches and publish results back to the caller.",
    starterPrompt:
      "Spawn two worker threads, move an owned `Vec<Job>` into each one, compute a per-worker total, and return the totals through a channel.",
    prompts: [
      "Use `move` closures deliberately.",
      "Keep the worker input owned rather than borrowing stack-local job slices into `thread::spawn`.",
      "Join both workers before treating the result as complete.",
      "Print one total per worker plus a grand total.",
    ],
    acceptanceCriteria: [
      "Each worker closure owns its input jobs.",
      "The design uses a channel for results instead of a shared mutable result map updated by both workers directly.",
      "The caller joins the workers explicitly.",
      "The runnable lab prints the expected ingest, index, and grand totals.",
    ],
    hints: [
      "This is a good place to choose channels first and shared state second.",
      "A `move` closure should consume the job vector and the sender clone cleanly.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair a thread boundary that captures the wrong thing",
    objective: "Fix two classic compile-time failures: borrowing stack data into `thread::spawn` and sending single-thread-only state across threads.",
    starterPrompt:
      "You inherit one function that borrows a local slice into `thread::spawn` and another that tries to send `Rc<RefCell<State>>` into a thread.",
    prompts: [
      "Which case wants owned data moved into the child thread?",
      "Which case wants `thread::scope` because the work is local and borrowed data is actually fine?",
      "Which case wants `Arc<Mutex<T>>` only if the state is semantically shared across threads?",
      "Which case should become message passing instead of shared mutation?",
    ],
    acceptanceCriteria: [
      "You repair at least one case by moving owned data.",
      "You repair at least one case by choosing scoped threads for borrowed data.",
      "You explain why `Rc<RefCell<T>>` is the wrong cross-thread shape.",
      "You justify any `Arc<Mutex<T>>` repair in semantic terms rather than as a compiler escape hatch.",
    ],
    hints: [
      "There are at least three valid repairs here. The right one depends on the lifetime and ownership story.",
      "If the child cannot outlive the parent, `thread::scope` deserves a look before cloning everything.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Choose channel-based or shared-state concurrency for a service",
    objective: "Map one realistic service boundary to the concurrency model that makes ownership easiest to operate.",
    starterPrompt:
      "You are designing `accept request -> parse -> schedule work -> update metrics -> publish completion` for a CPU-heavy service with a few hot counters and one central retry table.",
    prompts: [
      "Which parts want owned messages over channels?",
      "Which parts truly want shared immutable state through `Arc<T>` only?",
      "Which parts, if any, justify `Arc<Mutex<T>>` or another synchronized shared-state tool?",
      "What backpressure or contention signal would you monitor in production?",
    ],
    acceptanceCriteria: [
      "You choose at least one channel-based boundary and justify it.",
      "You choose at least one immutable shared-state boundary and justify it.",
      "You justify any mutable shared-state boundary in terms of real shared ownership, not convenience.",
      "You mention at least one observability hook such as queue depth, lock wait, or worker panic count.",
    ],
    hints: [
      "A service can legitimately use more than one concurrency model at once.",
      "The cleanest design usually has one owner per mutable subsystem, even if some immutable data is shared widely.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose OS threads, scoped threads, work stealing, async tasks, or distributed workers",
    objective: "Practice distinguishing five execution models that are often blurred together in design reviews.",
    starterPrompt:
      "You must parallelize four workloads: a request-local slice transform, a large CPU-bound collection map, a network fan-out with many waiting sockets, and a job that must run on another machine for isolation or capacity reasons.",
    prompts: [
      "Which workload wants scoped OS threads because it only borrows parent-owned data briefly?",
      "Which workload wants a work-stealing data-parallel scheduler because chunk sizes may be uneven?",
      "Which workload is an async-task problem rather than an OS-thread problem?",
      "Which workload is no longer a multithreading problem because the boundary is distributed?",
    ],
    acceptanceCriteria: [
      "You keep OS threads, async tasks, and distributed workers clearly separate.",
      "You choose scoped threads for at least one borrowed local CPU-bound case.",
      "You choose a work-stealing or data-parallel model for at least one uneven CPU-bound collection workload.",
      "You explain why network fan-out is more naturally an async-task or executor problem than a raw-thread spray.",
    ],
    hints: [
      "One of the easiest design mistakes is solving waiting with more threads when the real model is async IO.",
      "Another is calling a cross-machine queue 'multithreading' when the ownership and failure model has already changed completely.",
    ],
  },
]

const reviewQuestions = [
  "What does `Send` mean, and what does `Sync` mean?",
  "Why is a `move` closure the ordinary shape for `thread::spawn`?",
  "When is `thread::scope` a better answer than cloning or heap-sharing more data?",
  "What is the difference between message passing and shared-state locking as an ownership design?",
  "Why is work stealing a scheduler strategy rather than a synonym for threads?",
  "Why are async tasks and distributed workers separate from OS-thread design even when all three are 'concurrent'?",
]

const workingLoop = [
  "Name the execution model first: OS thread, scoped OS thread, async task, work-stealing data parallelism, or distributed worker.",
  "Name the ownership boundary second: moved owner, borrowed slice inside a scope, shared immutable state, or synchronized mutable state.",
  "Choose the primitive third: channel, `Arc`, `Mutex`, scoped thread, or a higher-level scheduler.",
  "Define one failure signal and one observability signal before calling the design production-ready.",
]

export function PageCh22MultithreadingInRustExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = 43
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 22 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice Rust multithreading the way it shows up in real systems: explicit thread-boundary ownership, honest
          <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Send</code>
          and
          <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Sync</code>
          reasoning, deliberate shared-state choices, and clear separation from async or distributed work.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a concurrency design review. The best answer does not stop at “use threads.” It
                states what crosses the boundary by ownership, which values are merely shared, where synchronization
                exists, and why a different execution model might actually be the more honest choice.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(42)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 22
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
                  Multithreading drill
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
          title="Runnable lab · Move owned jobs into worker threads and report results"
          description={
            <>
              Repair the starter so each worker thread owns its job batch, sums the job costs, and sends the result back to
              the caller through a channel. The checker expects a real
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs mx-1">move</code>
              thread boundary and the correct ingest, index, and grand totals.
            </>
          }
          filename="owned_jobs_channel_lab.rs"
          runKey="ch22_ex_owned_jobs_channel"
          expectedOutput={"ingest = 5\nindex = 4\ngrand = 9"}
          helperText={
            <>
              Tip: keep the worker input as an owned <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Vec&lt;Job&gt;</code>,
              spawn with a <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">move</code> closure, compute the total from{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">job.cost</code>, and send{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">(worker, total)</code> back over the channel.
            </>
          }
          initialCode={`use std::sync::mpsc;\nuse std::thread;\n\n#[derive(Debug)]\nstruct Job {\n    cost: u32,\n}\n\nfn spawn_worker(\n    tx: mpsc::Sender<(&'static str, u32)>,\n    worker: &'static str,\n    jobs: Vec<Job>,\n) -> thread::JoinHandle<()> {\n    thread::spawn(|| {\n        let total = 0;\n        tx.send((worker, total)).unwrap();\n    })\n}\n\nfn main() {\n    let (tx, rx) = mpsc::channel();\n\n    let ingest_jobs = vec![Job { cost: 2 }, Job { cost: 3 }];\n    let index_jobs = vec![Job { cost: 4 }];\n\n    let ingest = spawn_worker(tx.clone(), "ingest", ingest_jobs);\n    let index = spawn_worker(tx, "index", index_jobs);\n\n    ingest.join().unwrap();\n    index.join().unwrap();\n\n    let mut ingest_total = 0;\n    let mut index_total = 0;\n    let mut grand = 0;\n\n    for (worker, total) in rx {\n        grand += total;\n        if worker == "ingest" {\n            ingest_total = total;\n        } else if worker == "index" {\n            index_total = total;\n        }\n    }\n\n    println!(\"ingest = {}\", ingest_total);\n    println!(\"index = {}\", index_total);\n    println!(\"grand = {}\", grand);\n}`}
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
            By the end of this page, you should be able to classify
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Send</code>
            and
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Sync</code>
            without hand-waving, move owned data into worker threads intentionally, compare channel-driven and lock-driven
            designs from workload shape, and explain clearly when the right answer is scoped OS threads, work stealing,
            async tasks, or distributed workers.
          </p>
        </section>
      </div>
    </div>
  )
}
