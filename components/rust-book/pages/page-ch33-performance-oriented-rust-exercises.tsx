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
    title: "Separate benchmarking, profiling, tracing, and production observability",
    objective: "Choose the measurement tool that matches the actual performance question.",
    starterPrompt:
      "You need to compare two parsing functions, explain a latency regression inside one of them, understand where request time is spent across queueing and IO, and confirm whether the regression matters in the live service.",
    prompts: [
      "Which question wants a benchmark?",
      "Which question wants a profile?",
      "Which question wants tracing?",
      "Which question wants production metrics or logs?",
    ],
    acceptanceCriteria: [
      "You map each question to a distinct tool with a workload-based reason.",
      "You avoid treating a benchmark result as a complete production diagnosis.",
      "You explain at least one way profiling and tracing answer different questions.",
    ],
    hints: [
      "A benchmark compares alternatives under controlled input.",
      "A trace shows timeline and causality across boundaries.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Find allocation pressure and hidden clones in a hot path",
    objective: "Read a request loop and identify where ownership choices add heap traffic.",
    starterPrompt:
      "A request filter clones route strings into a temporary vector, formats a label per item, and pushes one record at a time into a dynamically growing output buffer.",
    prompts: [
      "Which values only needed borrowed access?",
      "Which allocation could be preplanned from a real bound?",
      "Which clone is semantically real and which only papers over an API-shape problem?",
      "What would you measure after the refactor to confirm the change helped?",
    ],
    acceptanceCriteria: [
      "You identify at least one unnecessary clone and one avoidable growth pattern.",
      "You propose a borrowed read path and one preallocation repair.",
      "You mention at least one follow-up metric such as allocation count, latency, or bytes allocated per request.",
    ],
    hints: [
      "Look for helpers that take ownership only to read.",
      "Look for vectors or strings that grow in obviously bounded loops.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Write a benchmark plan for an allocation-heavy function",
    objective: "Design a benchmark that compares alternatives without confusing it with profiling or production tuning.",
    starterPrompt:
      "You are comparing two versions of a log-enrichment function: one clone-heavy and one borrow-first with preallocation.",
    prompts: [
      "Specify the fixed input shape and size distribution.",
      "State that the benchmark runs in release mode.",
      "Define what you will record: wall-clock time, allocations, output count, or all three.",
      "Describe how you will keep the compiler from optimizing the whole function away when appropriate.",
    ],
    acceptanceCriteria: [
      "Your benchmark plan compares the same logical workload under two implementations.",
      "You name at least one release-build requirement and one measurement target.",
      "You distinguish the later profiling step from the benchmark step.",
      "You avoid claiming a speedup before the plan has been executed.",
    ],
    hints: [
      "A good benchmark plan makes the input and stop condition boring.",
      "If the result is unused, dead-code elimination can fake a win.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Refactor storage to improve locality",
    objective: "Replace an indirection-heavy dense layout with a flatter one that matches the access pattern.",
    starterPrompt:
      "You inherit a dense heatmap stored as `Vec<Vec<u64>>`, and the hot loop walks every row in full on every request.",
    prompts: [
      "What does one flat `Vec<u64>` plus `rows` and `cols` remove from the memory-access pattern?",
      "Which helper methods should expose rows as borrowed slices instead of reconstructing vectors?",
      "How does this change your reasoning about bounds checks in the inner loop?",
      "What measurement would you take before and after the refactor?",
    ],
    acceptanceCriteria: [
      "You replace nested ownership with one flat owner for the dense case.",
      "You mention locality or cache behavior explicitly.",
      "You explain how row views or chunks make inner-loop bounds reasoning simpler.",
      "You mention at least one before-and-after measurement target.",
    ],
    hints: [
      "The point is not only fewer allocations. It is also more predictable traversal.",
      "Chunked slice iteration often gives the optimizer a better proof story than ad hoc indexing.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Compare iterator and loop implementations responsibly",
    objective: "Avoid folklore by designing a fair comparison between two equivalent hot loops.",
    starterPrompt:
      "You have one implementation written as an iterator chain and one as an explicit `for` loop over the same slice.",
    prompts: [
      "How will you keep the logical work identical between the two versions?",
      "What would make the comparison unfair, such as extra allocation or a changed branch structure in only one variant?",
      "Would you inspect generated code or profile data before drawing conclusions from the benchmark alone?",
      "How would you report the result without claiming one style is globally faster?",
    ],
    acceptanceCriteria: [
      "You keep the workload and output identical between variants.",
      "You mention at least one unfair comparison trap.",
      "You include at least one follow-up inspection step such as profiling or generated-code review.",
      "You report the result as workload-specific rather than as a universal rule.",
    ],
    hints: [
      "The style difference should be the variable, not the data shape or allocation pattern.",
      "Iterator versus loop is a measurement question, not a religion.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose release settings and performance review policy for a service",
    objective: "Make build mode, profile settings, and runtime observability part of the performance design.",
    starterPrompt:
      "You are shipping a latency-sensitive binary with one hot parser, one CPU-heavy enrichment step, and an operator requirement that crash behavior remain explicit.",
    prompts: [
      "Which release-build command should every performance run use?",
      "Which profile settings would you consider, and what tradeoff does each one carry?",
      "When might `panic = \"abort\"` be acceptable, and when would it be the wrong contract?",
      "Which live signals would you require before trusting the optimized build in production?",
    ],
    acceptanceCriteria: [
      "You name release mode explicitly for measurement.",
      "You justify at least two profile settings or profile decisions with tradeoffs.",
      "You explain `panic = \"abort\"` as a binary contract choice rather than a free speed flag.",
      "You mention at least two production observability signals such as p99 latency, queue depth, allocation pressure, or error rate.",
    ],
    hints: [
      "Compiler flags are workload tools, not trophies.",
      "A good performance review says what changed in both build behavior and runtime behavior.",
    ],
  },
]

const reviewQuestions = [
  "Why is performance work usually clearer after ownership boundaries become honest?",
  "What is the practical difference between reducing allocations and reducing branch misses?",
  "Why are slice-based and chunk-based loops often easier to optimize than index-heavy loops?",
  "When is a clone economically justified even in performance-sensitive code?",
  "What does release mode change, and what questions does it still not answer by itself?",
]

const workingLoop = [
  "State the workload and the metric first.",
  "Separate benchmarking from profiling, tracing, and production observability.",
  "Refactor allocation and layout before lower-level tricks.",
  "Validate the change in release mode, then confirm it in the live service with the right signals.",
]

export function PageCh33PerformanceOrientedRustExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch33-performance-oriented-rust-exercises")
  const mainPageIndex = getPageIndexById("ch33-performance-oriented-rust")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 33 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice performance work the way it survives review: explicit workload definitions, careful measurement, calmer
          ownership boundaries, and layout choices that make the CPU&apos;s job easier rather than harder.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a performance review. The strongest answer does not stop at “make it faster.” It
                says what the workload is, what the metric is, what moved in the cost model, and which measurement tool
                ownership boundaries, and layout choices that make the CPU&apos;s job easier rather than harder.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 33
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
                  Performance drill
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
          title="Runnable lab · Allocation-aware hot-route filter"
          description={
            <>
              Repair the starter so the result buffer is preallocated and the threshold comparison includes the boundary
              value. The checker expects the exact output below.
            </>
          }
          filename="hot_routes_lab.rs"
          runKey="ch33_ex_hot_routes"
          expectedOutput={"hot = 2\nfirst = /search\ncapacity ok = true"}
          helperText={
            <>
              Tip: switch to{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Vec::with_capacity(requests.len())</code>{" "}
              and change the comparison so a request with exactly{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">512</code> bytes still qualifies.
            </>
          }
          initialCode={`#[derive(Debug)]
struct Request<'a> {
    route: &'a str,
    bytes: usize,
}

fn hot_routes<'a>(requests: &'a [Request<'a>], min_bytes: usize) -> Vec<&'a str> {
    let mut out = Vec::new();

    for request in requests {
        if request.bytes > min_bytes {
            out.push(request.route);
        }
    }

    out
}

fn main() {
    let requests = [
        Request {
            route: "/health",
            bytes: 128,
        },
        Request {
            route: "/search",
            bytes: 900,
        },
        Request {
            route: "/checkout",
            bytes: 512,
        },
        Request {
            route: "/metrics",
            bytes: 64,
        },
    ];

    let hot = hot_routes(&requests, 512);

    println!("hot = {}", hot.len());
    println!("first = {}", hot.first().copied().unwrap_or("none"));
    println!("capacity ok = {}", hot.len() <= hot.capacity());
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
            By the end of this page, you should be able to choose the right measurement tool, spot allocation and locality
            mistakes in hot paths, compare loops and iterators without folklore, and explain performance changes in the
            same ownership-and-boundary language another senior engineer can review quickly.
          </p>
        </section>
      </div>
    </div>
  )
}
