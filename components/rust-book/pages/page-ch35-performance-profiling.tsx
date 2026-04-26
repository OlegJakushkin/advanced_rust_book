"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "Profile the question, not the syntax",
    body: "A performance profile should answer one operational question: where is wall time or CPU time actually going, and is the cost compute, waiting, locking, copying, or boundary overhead?",
  },
  {
    title: "Sampling and instrumentation answer different questions",
    body: "Sampling is strong for broad CPU hot-path discovery with modest overhead. Instrumentation is strong when you need precise timing around chosen boundaries such as queue wait, lock acquisition, serialization, or FFI calls.",
  },
  {
    title: "Wall time is usually composed, not singular",
    body: "A 'slow request' can be mostly CPU, mostly IO wait, mostly lock wait, or mostly queueing before work even starts. A good profile separates those layers before anyone rewrites code.",
  },
]

const questionCards = [
  {
    title: "Compare two implementations",
    body: "Use a benchmark. Keep the workload fixed, run in release mode, and compare the same logical work under each implementation.",
  },
  {
    title: "Find the hot CPU path",
    body: "Use a sampling profiler and a flame graph. Start wide, then drill down into the hottest stack.",
  },
  {
    title: "Explain request timeline",
    body: "Use tracing or explicit instrumentation. You want queue wait, handler time, lock wait, and downstream boundaries on one timeline.",
  },
  {
    title: "Validate live impact",
    body: "Use production observability. Check p95 or p99 latency, queue depth, retry rate, and saturation signals before claiming the local fix mattered.",
  },
]

const flameGraphRules = [
  "Each box width represents aggregate sampled time, usually inclusive of children.",
  "The x-axis is not a time-series timeline. Adjacent boxes are grouped by stack shape, not by chronological order.",
  "The stack grows upward. Parents sit below their callees.",
  "A wide leaf inside a wide stack is often the immediate optimization target.",
  "A wide parent with several medium children often means the work is spread across several callees and needs a broader design fix.",
]

const samplingVsInstrumentationCards = [
  {
    title: "Sampling",
    body: "Strong for CPU profiling in release builds, flame graphs, and wide production investigation. Weak when the critical section is very short or when you need precise per-event accounting.",
  },
  {
    title: "Instrumentation",
    body: "Strong for queue wait, lock acquisition, serialization bytes, request phases, and FFI call counts. Weak when the added probes perturb an already tiny hot loop too much.",
  },
]

const criterionChecklist = [
  "Benchmark in release mode with representative input shapes, not toy-only data.",
  "Use `black_box` or an equivalent technique when dead-code elimination could fake a win.",
  "Compare the same logical work under both variants. Do not let one version allocate more, parse more, or branch differently by accident.",
  "Treat Criterion as a comparison tool, not as a full profile or a substitute for tracing the real service.",
]

const criterionSnippet = `use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn bench_encode(c: &mut Criterion) {
    let payloads = make_payloads(1024);

    c.bench_function("encode_batch", |b| {
        b.iter(|| encode_batch(black_box(&payloads)))
    });
}

criterion_group!(benches, bench_encode);
criterion_main!(benches);`

const cpuProfilingNotes = [
  "Start from a release build with symbols good enough for stack resolution.",
  "On Linux, sampling with `perf` or a flamegraph wrapper is a common first step. On macOS, Instruments is a common first step. On Windows, WPA or Visual Studio profiling is a common first step.",
  "Separate inclusive time from exclusive time. A caller can look wide only because one child is wide beneath it.",
]

const asyncProfilingNotes = [
  "Measure queue wait before handler execution, not only handler time after the task starts running.",
  "Count spawned tasks, queue depth, semaphore wait, and blocking-pool pressure. These often explain 'async is slow' complaints better than CPU samples alone.",
  "Use tracing spans or ecosystem task-inspection tools as options, but keep the question narrow: is the cost waiting, local CPU, or overload from too much in-flight work?",
]

const lockProfilingNotes = [
  "Measure lock wait time separately from time spent holding the guard.",
  "Count contended acquisitions. A rare lock taken for a long time and a tiny lock taken constantly are different failures.",
  "If a lock is hot, test narrower scope, sharding, one-owner message passing, or read-mostly redesign before reaching for lower-level lock-free structures.",
]

const serializationProfilingNotes = [
  "Measure encode and decode time, allocations per message, and bytes per message together.",
  "Separate serialization cost from compression, hashing, or encryption layered around it.",
  "If a queue or task boundary keeps large owned payloads alive, profile retained bytes as well as encode time.",
]

const ioProfilingNotes = [
  "Measure syscalls per request, bytes per write, flush frequency, queue depth, and blocked time.",
  "Do not blame one read loop before checking whether the real cost is tiny writes, partial writes, or unbounded admission downstream.",
  "A flame graph may show a parser function, while tracing shows the request mostly waited in a queue before the parser even started.",
]

const wasmProfilingNotes = [
  "Use browser Performance and Memory tools for JS↔WASM boundaries, host-call count, typed-array copies, and memory growth.",
  "Count boundary crossings first. Many small JS↔WASM calls can dominate before the Rust kernel does.",
  "Measure serialization and copy cost separately from pure compute inside the module.",
]

const ffiProfilingNotes = [
  "Compare a noop or tiny payload call against the real payload call so wrapper overhead is visible.",
  "Count FFI call frequency. A batched API is often a larger win than a faster callee.",
  "Separate marshalling, string conversion, and ownership transfer from native compute time before deciding where the real slowdown lives.",
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Rust profiling still cares about cache misses, branch prediction, and heap traffic, but ownership boundaries make clone and handoff costs easier to review before they reach the profiler.",
  },
  {
    title: "C# background",
    body: "You no longer get a GC to blur allocation lifetime. Rust performance work is often calmer because the code already names where values become owned and how long they survive.",
  },
  {
    title: "Go background",
    body: "Async and queue-heavy services can hide backlog cost the same way goroutine-heavy systems can. Rust asks you to make the queue and ownership story explicit enough that profiling has somewhere honest to point.",
  },
]

const productionPatterns = [
  "Record one profiling question at a time: CPU hot path, queue wait, lock contention, serialization cost, or boundary overhead.",
  "Benchmark representative hot paths with Criterion, then profile the slower variant to explain the result rather than merely report it.",
  "Keep explicit counters around queue depth, lock wait, message size, and FFI or WASM call count. They often explain regressions faster than a full-system profile.",
  "Profile in release builds and under realistic workload shape. Debug-build numbers are usually noise for this chapter's questions.",
  "Save the exact input set and capture conditions that produced the regression. A profile without workload context is hard to trust later.",
]

const pitfalls = [
  "Treating a flame graph like a chronological timeline. It is a sampled stack-shape view, not a movie.",
  "Using one microbenchmark to justify a production rewrite without checking whether the live system is actually bottlenecked there.",
  "Profiling async services without queue wait, semaphore wait, or blocking-pool pressure, then blaming the runtime generically.",
  "Calling every wide stack 'CPU bound' when serialization, lock wait, or boundary marshalling is actually the wide child underneath.",
  "Measuring FFI or WASM only from inside the native function and ignoring wrapper, conversion, or host-call overhead.",
]

export function PageCh35PerformanceProfiling() {
  const {
    codes,
    updateCode,
    resetCode,
    outputs,
    setOutput,
    isRunning,
    setIsRunning,
    markPageComplete,
    setCurrentPage,
  } = useBook()
  const pageIndex = getPageIndexById("ch35-performance-profiling")
  const chapter25PageIndex = getPageIndexById("ch25-tokio")
  const chapter27PageIndex = getPageIndexById("ch27-io-tricks-and-systems-programming-patterns")
  const chapter28PageIndex = getPageIndexById("ch28-cpp-integration")
  const chapter29PageIndex = getPageIndexById("ch29-js-and-cpp-integration-for-wasm")
  const chapter33PageIndex = getPageIndexById("ch33-performance-oriented-rust")
  const chapter34PageIndex = getPageIndexById("ch34-memory-profiling")
  const exercisesPageIndex = getPageIndexById("ch35-performance-profiling-exercises")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  const runCode = (key: string) => {
    setIsRunning(key)
    setTimeout(() => {
      const output = simulateRustExecution(codes[key], key)
      setOutput(key, output)
      setIsRunning(null)
    }, 650)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <BookOpen className="h-4 w-4" />
          Chapter 35 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Performance profiling is how you turn “it feels slow” into one bounded question another engineer can verify,
          benchmark, and fix without guesswork.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 25, 27, 28, 29, 33, and 34</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 25 covered Tokio task boundaries. Chapter 27 covered IO pipelines and batching. Chapter 28 covered
                FFI boundaries. Chapter 29 covered WASM boundaries. Chapter 33 established Rust&apos;s broader performance
                model, and Chapter 34 narrowed that to memory symptoms. This chapter turns those cost surfaces into a
                practical profiling discipline.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter25PageIndex)}>
                Chapter 25
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter27PageIndex)}>
                Chapter 27
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter28PageIndex)}>
                Chapter 28
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter29PageIndex)}>
                Chapter 29
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter33PageIndex)}>
                Chapter 33
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter34PageIndex)}>
                Chapter 34
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A service regressed after a “small cleanup.” The new code looks fine in review, but p99 latency rose, queue
            depth climbed, and CPU samples now show more time under serialization than parsing. Another path spends most of
            its wall time waiting on a lock, yet the flame graph makes the parser look guilty because the parser sits above
            the lock acquisition in the call stack. This is the point of profiling: separate wall time from CPU time, and
            separate symptoms from stories.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {questionCards.map((card) => (
              <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">{card.title}</div>
                <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">At a glance</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Choose the profiling tool from the question: benchmark, sampler, instrumentation, trace, or live telemetry.</li>
              <li>Read flame graphs as stack-width evidence, not as a chronological movie.</li>
              <li>Separate CPU time from queue wait, lock wait, serialization, IO, and boundary overhead.</li>
              <li>Use each profile to narrow the next experiment instead of reaching for a rewrite immediately.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">Review lens</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>What is the unit of work the profile is actually describing?</li>
              <li>Which layer owns the wall-clock budget: compute, waiting, locking, copying, or crossing a boundary?</li>
              <li>Which tool will answer the next question with the least distortion?</li>
              <li>What observable signal would prove the follow-up change mattered in production?</li>
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Mental model</h3>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {mentalModelPoints.map((point) => (
              <div key={point.title} className="rounded-lg border border-border bg-card p-4">
                <h4 className="font-semibold text-foreground mb-2">{point.title}</h4>
                <p className="text-sm text-muted-foreground leading-6">{point.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">CPU profiling</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {cpuProfilingNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`cargo build --release
cargo flamegraph --example hot_stage_summary

# or sample the real binary
perf record -g ./target/release/service
perf report`}</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  The exact tool varies by platform. The discipline does not: release build, symbols good enough for
                  stacks, representative input, and one bounded question at a time.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Flame graphs</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {flameGraphRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A useful reading habit is simple. Start at the widest plateau. Then look upward until the work becomes
                specific enough to change. Do not optimize the first named function you recognize if the real width lives
                deeper underneath it.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Sampling vs instrumentation</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {samplingVsInstrumentationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Benchmarking with Criterion</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {criterionChecklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{criterionSnippet}</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  Criterion is a strong ecosystem default for controlled benchmarks. Use it to compare alternatives. Then
                  use profiles and traces to explain why one alternative won or lost.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Profiling async Rust</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {asyncProfilingNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                An async regression often lives in admission policy, queue wait, or CPU work left on runtime workers. The
                first fix is usually not “rewrite the executor.” It is “measure where the task actually waits or blocks.”
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Profiling lock contention</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {lockProfilingNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                A hot lock is not only a synchronization problem. It is often an ownership problem hiding underneath:
                too-broad shared state, too-long critical sections, or one subsystem missing its own owner.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Profiling serialization</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {serializationProfilingNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Profiling IO pipelines</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {ioProfilingNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="font-semibold text-foreground mb-3">Profiling WASM</h4>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                {wasmProfilingNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="font-semibold text-foreground mb-3">Profiling FFI overhead</h4>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                {ffiProfilingNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Comparison callout</h4>
            <div className="grid gap-3 lg:grid-cols-3">
              {comparisonCallouts.map((comparison) => (
                <div key={comparison.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Production patterns</h3>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {productionPatterns.map((pattern) => (
              <div key={pattern} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">{pattern}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Pitfalls and tradeoffs</h3>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {pitfalls.map((pitfall) => (
              <div key={pitfall} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">{pitfall}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <TriangleAlert className="h-5 w-5 text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                A profiling tool does not remove judgment. It only makes a narrower judgment possible. The wrong metric, the
                wrong build, or the wrong workload can still send a senior team straight at the wrong fix.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Worked examples</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 1: summarize the hottest stage before drawing the flame graph</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  A flame graph is a richer view than this summary, but the first question is the same: which stage owns the
                  most inclusive sampled time?
                </p>
              </div>
              {codes.performance_profiling_hot_stage_summary !== DEFAULT_CODES.performance_profiling_hot_stage_summary && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("performance_profiling_hot_stage_summary")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.performance_profiling_hot_stage_summary}
              onChange={(newCode) => updateCode("performance_profiling_hot_stage_summary", newCode)}
              onRun={() => runCode("performance_profiling_hot_stage_summary")}
              output={outputs.performance_profiling_hot_stage_summary ?? null}
              isRunning={isRunning === "performance_profiling_hot_stage_summary"}
              filename="hot_stage_summary.rs"
              expectedOutput={"hottest = serialize\nstage us = 620\ntotal us = 840"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.performance_profiling_hot_stage_summary}
              onRevert={() => resetCode("performance_profiling_hot_stage_summary")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Inclusive time</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The widest stage is the first suspect because it owns the most aggregate sampled time.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Narrative</div>
                <p className="text-xs text-muted-foreground leading-5">
                  If serialization is wide here, the next question is whether bytes, schema shape, or compression underneath it are the real cost.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Tool fit</div>
                <p className="text-xs text-muted-foreground leading-5">
                  This kind of summary often comes from instrumentation first, then a sampler confirms the call stack beneath it.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: separate CPU, IO, lock, and serialization before tuning</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  One total latency number is not enough. The profile should tell you which component dominates wall time and
                  how much data crossed the expensive boundary.
                </p>
              </div>
              {codes.performance_profiling_pipeline_bottleneck !== DEFAULT_CODES.performance_profiling_pipeline_bottleneck && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("performance_profiling_pipeline_bottleneck")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.performance_profiling_pipeline_bottleneck}
              onChange={(newCode) => updateCode("performance_profiling_pipeline_bottleneck", newCode)}
              onRun={() => runCode("performance_profiling_pipeline_bottleneck")}
              output={outputs.performance_profiling_pipeline_bottleneck ?? null}
              isRunning={isRunning === "performance_profiling_pipeline_bottleneck"}
              filename="pipeline_bottleneck.rs"
              expectedOutput={"dominant = cpu\nserialized bytes = 16384\nwall us = 800"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.performance_profiling_pipeline_bottleneck}
              onRevert={() => resetCode("performance_profiling_pipeline_bottleneck")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Classification</div>
                <p className="text-xs text-muted-foreground leading-5">
                  If CPU is dominant, a queue tweak will not save the path. If lock or IO dominates, a loop micro-optimization probably will not either.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Bytes matter</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Serialization cost grows with message size, allocation shape, and follow-on compression or encryption work.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Next step</div>
                <p className="text-xs text-muted-foreground leading-5">
                  After a summary like this, benchmark the candidate fix, then profile the slower variant to explain the difference.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">examples/ch35_performance_profiling/</code>{" "}
              including small async and FFI boundary cost sketches alongside the two in-browser worked examples.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to interpret a flame graph narrative, design a Criterion benchmark,
            separate CPU and waiting bottlenecks in an async pipeline, and build a profiling plan for WASM and FFI edges.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 35 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>CPU profiling, flame graphs, benchmarks, tracing, and production metrics answer different questions.</li>
            <li>Sampling finds broad hot paths. Instrumentation explains chosen boundaries such as lock wait, queue wait, serialization, and FFI or WASM calls.</li>
            <li>Criterion is a strong default for controlled comparisons, but it is not a replacement for profiles or live-service observability.</li>
            <li>Async, lock, IO, serialization, WASM, and FFI performance work all improve when wall time is decomposed before code is rewritten.</li>
            <li>The best profile is the one attached to one explicit workload, one explicit build, and one explicit question.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
````

### File: `components/rust-book/pages/page-ch35-performance-profiling-exercises.tsx`
```tsx
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
    title: "Interpret a flame graph narrative before touching code",
    objective: "Practice reading a flame graph as an explanation of sampled stack width rather than as a chronological movie.",
    starterPrompt:
      "A flame graph shows `request_handler` across most of the width, but the widest child under it is `serialize_payload`, and the widest child under that is `escape_json_string`.",
    prompts: [
      "Which function is the first concrete optimization suspect, and why?",
      "Why is `request_handler` not automatically the right optimization target even though it is wide?",
      "What further measurement would you take before rewriting the serializer?",
    ],
    acceptanceCriteria: [
      "You identify the widest concrete child as the first likely target.",
      "You explain inclusive versus child cost clearly.",
      "You mention at least one follow-up measurement such as bytes per message, allocations per encode, or a Criterion comparison.",
    ],
    hints: [
      "Read downward for ownership of inclusive time, then upward for concrete causes.",
      "A wide parent can simply be wide because one child is wide.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Choose sampling, instrumentation, or tracing from the question",
    objective: "Map one regression story to the right mix of tools instead of treating profiling as one activity.",
    starterPrompt:
      "An async service regressed. CPU usage rose slightly, queue wait rose sharply, and one handler now formats larger JSON payloads.",
    prompts: [
      "Which question wants a sampling profiler?",
      "Which question wants instrumentation around queue wait or serialization?",
      "Which question wants tracing across admission, handler, and downstream publish time?",
      "Which question wants a live production metric rather than only a local profile?",
    ],
    acceptanceCriteria: [
      "You choose at least one sampling, one instrumentation, and one tracing use correctly.",
      "You distinguish hotspot discovery from timeline explanation clearly.",
      "You mention one production metric such as queue depth, p99 latency, or bytes per message.",
    ],
    hints: [
      "The tool follows the question, not the other way around.",
      "Queue wait is rarely visible in a CPU sampler by itself.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Create a Criterion benchmark for a hot path",
    objective: "Design a benchmark harness that compares one hot function fairly and in release conditions.",
    starterPrompt:
      "Write a Criterion benchmark for two versions of a route-enrichment helper: one clone-heavy and one borrow-first with preallocation.",
    prompts: [
      "Fix one representative input shape and size distribution.",
      "Use `black_box` or an equivalent technique when dead-code elimination could hide real work.",
      "Run the benchmark in release mode and record at least wall time plus one ownership-related signal such as allocation count or output length.",
      "Keep the logical work identical between the two benchmarked functions.",
    ],
    acceptanceCriteria: [
      "Your harness benchmarks the same workload under both implementations.",
      "You mention release mode explicitly.",
      "You mention one fairness guard such as `black_box`, fixed inputs, or identical output validation.",
      "You avoid claiming that the benchmark alone explains the production regression.",
    ],
    hints: [
      "Criterion compares alternatives. It does not replace profiling.",
      "A good benchmark plan is boring enough that another engineer can rerun it exactly.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Profile async Rust and lock contention without blaming the runtime first",
    objective: "Separate queue wait, handler work, blocking-pool work, and lock wait in one async service review.",
    starterPrompt:
      "A Tokio service now shows higher latency. One task set fans out aggressively, one shared map sits behind a mutex, and one CPU-heavy normalization step still runs inline on runtime workers.",
    prompts: [
      "Which signals would tell you the runtime is overloaded versus the lock being hot?",
      "Which stage wants `spawn_blocking` or a separate CPU pool?",
      "Which stage wants narrower lock scope or message passing instead of one broad mutex?",
      "What would you trace before and after the refactor?",
    ],
    acceptanceCriteria: [
      "You identify at least one queue, one lock, and one CPU boundary explicitly.",
      "You propose one measurement for runtime backlog and one for lock contention.",
      "You justify one ownership or scheduling repair instead of only saying 'Tokio is slow.'",
    ],
    hints: [
      "Queue wait, lock wait, and CPU work are different wall-time buckets.",
      "The runtime is often exposing the design rather than causing the design.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Separate CPU, IO, lock, and serialization bottlenecks in one report",
    objective: "Read one mixed latency report and decide which subsystem actually deserves the next change.",
    starterPrompt:
      "A profiling report shows `cpu_us = 230`, `io_wait_us = 840`, `lock_wait_us = 40`, `serialize_us = 190`, and `serialized_bytes = 8192` for one request path.",
    prompts: [
      "Which category dominates wall time?",
      "Which code rewrite is probably premature because the profile says the wrong thing is hot?",
      "Which next measurement would you take to refine the diagnosis inside the dominant category?",
      "What would you record after the fix to prove the improvement is real?",
    ],
    acceptanceCriteria: [
      "You identify the dominant category correctly.",
      "You reject at least one likely but wrong optimization target.",
      "You propose one deeper measurement inside the dominant category.",
      "You name one before-and-after validation metric.",
    ],
    hints: [
      "Wall time should drive the next question first.",
      "Do not optimize the smaller bar just because it is more pleasant code to edit.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Build a profiling plan for WASM and FFI boundaries",
    objective: "Choose measurements that expose boundary overhead instead of only the native kernel time.",
    starterPrompt:
      "You are shipping a browser path that calls into Rust/WASM and a native plugin path that calls through a C ABI shim into Rust.",
    prompts: [
      "Which browser tools would you use to measure JS↔WASM call count, copy cost, and memory growth?",
      "How would you measure a chatty FFI API against a batched FFI API fairly?",
      "Which fields or counters belong in the boundary logs or spans for production incident work?",
      "What would make you redesign the public boundary instead of only optimizing the callee?",
    ],
    acceptanceCriteria: [
      "You mention at least one browser profiling tool and one native or FFI boundary measurement technique.",
      "You separate wrapper or marshalling cost from native compute cost.",
      "You propose at least one boundary redesign trigger such as call-count explosion or repeated large copies.",
      "You mention one observability signal for each boundary shape.",
    ],
    hints: [
      "A fast kernel can still lose if the boundary is too chatty.",
      "Measure the wrapper, not only the function inside the wrapper.",
    ],
  },
]

const reviewQuestions = [
  "What does a flame graph show that a benchmark does not show?",
  "Why is queue wait often invisible in a CPU-only profile?",
  "When is instrumentation a better tool than sampling?",
  "Why should a Criterion result usually be followed by a profile or a trace before a larger redesign?",
  "What is the practical difference between profiling serialization cost and profiling message size alone?",
]

const workingLoop = [
  "Write the performance question in one sentence before choosing a tool.",
  "Separate wall time into compute, wait, lock, serialization, and boundary overhead before rewriting code.",
  "Benchmark alternatives in release mode, then profile the slower path to explain the result.",
  "Validate the live system with queue depth, latency, and saturation signals after the fix lands.",
]

export function PageCh35PerformanceProfilingExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = 69
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 35 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice profiling the way it survives review: interpret the narrative, choose the right tool, and separate
          CPU, waiting, lock, and boundary cost before you change the code.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a performance review. The strongest answer names the workload, the metric, the tool,
                and the suspected boundary before it recommends a fix.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(68)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 35
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
                  Profiling drill
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
          title="Runnable lab · Separate CPU, IO, lock, and serialization cost"
          description={
            <>
              Repair the starter so the report picks the real dominant category and computes full wall time. The checker
              expects the exact output below from the provided stats sample.
            </>
          }
          filename="bottleneck_report_lab.rs"
          runKey="ch35_ex_bottleneck_report"
          expectedOutput={"dominant = serialize\nwall us = 1010\nbytes = 24576"}
          helperText={
            <>
              Tip: build one tuple array of
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs mx-1">{`("name", value)`}</code>
              pairs, use <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">max_by_key</code> for the
              dominant category, and sum all four time components in
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs mx-1">wall_time</code>.
            </>
          }
          initialCode={`#[derive(Debug)]
struct ProfileSummary {
    cpu_us: u64,
    io_wait_us: u64,
    lock_wait_us: u64,
    serialize_us: u64,
    serialized_bytes: usize,
}

fn dominant(_stats: &ProfileSummary) -> &'static str {
    "cpu"
}

fn wall_time(_stats: &ProfileSummary) -> u64 {
    0
}

fn main() {
    let stats = ProfileSummary {
        cpu_us: 210,
        io_wait_us: 140,
        lock_wait_us: 80,
        serialize_us: 580,
        serialized_bytes: 24_576,
    };

    println!("dominant = {}", dominant(&stats));
    println!("wall us = {}", wall_time(&stats));
    println!("bytes = {}", stats.serialized_bytes);
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
            By the end of this page, you should be able to read a flame graph narrative without folklore, design a
            Criterion benchmark for one hot path, separate CPU and waiting bottlenecks in an async service, and build a
            profiling plan for WASM and FFI boundaries that another senior engineer can execute and verify.
          </p>
        </section>
      </div>
    </div>
  )
}
````

### File: `examples/ch35_performance_profiling/hot_stage_summary.rs`
````
#[derive(Debug, Clone, Copy)]
struct StageSample {
    name: &'static str,
    micros: u64,
}

fn hottest_stage(samples: &[StageSample]) -> (&'static str, u64, u64) {
    let total: u64 = samples.iter().map(|sample| sample.micros).sum();
    let hottest = samples
        .iter()
        .max_by_key(|sample| sample.micros)
        .copied()
        .unwrap();

    (hottest.name, hottest.micros, total)
}

fn main() {
    let samples = [
        StageSample {
            name: "parse",
            micros: 180,
        },
        StageSample {
            name: "serialize",
            micros: 620,
        },
        StageSample {
            name: "lock_wait",
            micros: 40,
        },
    ];

    let (stage, hottest, total) = hottest_stage(&samples);

    println!("hottest = {}", stage);
    println!("stage us = {}", hottest);
    println!("total us = {}", total);
}
````

### File: `examples/ch35_performance_profiling/pipeline_bottleneck.rs`
````
#[derive(Debug)]
struct PipelineStats {
    cpu_us: u64,
    io_wait_us: u64,
    lock_wait_us: u64,
    serialize_us: u64,
    serialized_bytes: usize,
}

fn dominant(stats: &PipelineStats) -> &'static str {
    [
        ("cpu", stats.cpu_us),
        ("io", stats.io_wait_us),
        ("lock", stats.lock_wait_us),
        ("serialize", stats.serialize_us),
    ]
    .into_iter()
    .max_by_key(|(_, value)| *value)
    .map(|(name, _)| name)
    .unwrap()
}

fn wall_time(stats: &PipelineStats) -> u64 {
    stats.cpu_us + stats.io_wait_us + stats.lock_wait_us + stats.serialize_us
}

fn main() {
    let stats = PipelineStats {
        cpu_us: 410,
        io_wait_us: 120,
        lock_wait_us: 90,
        serialize_us: 180,
        serialized_bytes: 16_384,
    };

    println!("dominant = {}", dominant(&stats));
    println!("serialized bytes = {}", stats.serialized_bytes);
    println!("wall us = {}", wall_time(&stats));
}
````

### File: `examples/ch35_performance_profiling/async_queue_story.rs`
````
#[derive(Debug, Clone, Copy)]
struct AsyncStage {
    queue_wait_us: u64,
    poll_us: u64,
    lock_wait_us: u64,
}

fn dominant(stage: &AsyncStage) -> &'static str {
    [
        ("queue_wait", stage.queue_wait_us),
        ("poll", stage.poll_us),
        ("lock_wait", stage.lock_wait_us),
    ]
    .into_iter()
    .max_by_key(|(_, value)| *value)
    .map(|(name, _)| name)
    .unwrap()
}

fn wall_time(stage: &AsyncStage) -> u64 {
    stage.queue_wait_us + stage.poll_us + stage.lock_wait_us
}

fn main() {
    let stage = AsyncStage {
        queue_wait_us: 900,
        poll_us: 180,
        lock_wait_us: 40,
    };

    println!("dominant = {}", dominant(&stage));
    println!("wall us = {}", wall_time(&stage));
}
````

### File: `examples/ch35_performance_profiling/ffi_batch_vs_chatty.rs`
````
#[derive(Debug, Clone, Copy)]
struct BoundaryProfile {
    calls: u64,
    fixed_us_per_call: u64,
    payload_bytes: u64,
}

fn estimated_overhead(profile: BoundaryProfile) -> u64 {
    profile.calls * profile.fixed_us_per_call + profile.payload_bytes / 1024
}

fn main() {
    let chatty = BoundaryProfile {
        calls: 128,
        fixed_us_per_call: 6,
        payload_bytes: 4_096,
    };
    let batched = BoundaryProfile {
        calls: 4,
        fixed_us_per_call: 6,
        payload_bytes: 4_096,
    };

    let chatty_us = estimated_overhead(chatty);
    let batched_us = estimated_overhead(batched);

    println!("chatty us = {}", chatty_us);
    println!("batched us = {}", batched_us);
    println!("saved us = {}", chatty_us - batched_us);
}
````

### File: `components/rust-book/pages/index.ts`
````diff
--- components/rust-book/pages/index.ts
+++ components/rust-book/pages/index.ts
@@ -65,4 +65,6 @@ export { PageCh32MpiAndHighPerformanceComputing } from "./page-ch32-mpi-and-high
 export { PageCh32MpiAndHighPerformanceComputingExercises } from "./page-ch32-mpi-and-high-performance-computing-exercises"
 export { PageCh33PerformanceOrientedRust } from "./page-ch33-performance-oriented-rust"
 export { PageCh33PerformanceOrientedRustExercises } from "./page-ch33-performance-oriented-rust-exercises"
 export { PageCh34MemoryProfiling } from "./page-ch34-memory-profiling"
 export { PageCh34MemoryProfilingExercises } from "./page-ch34-memory-profiling-exercises"
+export { PageCh35PerformanceProfiling } from "./page-ch35-performance-profiling"
+export { PageCh35PerformanceProfilingExercises } from "./page-ch35-performance-profiling-exercises"
````

### File: `components/rust-book/index.tsx`
````diff
--- components/rust-book/index.tsx
+++ components/rust-book/index.tsx
@@ -75,7 +75,9 @@ import {
   PageCh32MpiAndHighPerformanceComputing,
   PageCh32MpiAndHighPerformanceComputingExercises,
   PageCh33PerformanceOrientedRust,
   PageCh33PerformanceOrientedRustExercises,
   PageCh34MemoryProfiling,
   PageCh34MemoryProfilingExercises,
+  PageCh35PerformanceProfiling,
+  PageCh35PerformanceProfilingExercises,
 } from "./pages"
 
 const PAGE_COMPONENTS = [
@@ -148,7 +150,9 @@ const PAGE_COMPONENTS = [
   PageCh32MpiAndHighPerformanceComputing,
   PageCh32MpiAndHighPerformanceComputingExercises,
   PageCh33PerformanceOrientedRust,
   PageCh33PerformanceOrientedRustExercises,
   PageCh34MemoryProfiling,
   PageCh34MemoryProfilingExercises,
+  PageCh35PerformanceProfiling,
+  PageCh35PerformanceProfilingExercises,
 ]
 
 function BookContent() {
````

### File: `components/rust-book/rust-simulator.ts`
````diff
--- components/rust-book/rust-simulator.ts
+++ components/rust-book/rust-simulator.ts
@@ -1,3 +1,4 @@
+import { simulateCh35Output } from "./rust-simulator-ch35"
 import { simulateCh34Output } from "./rust-simulator-ch34"
 import { simulateCh33Output } from "./rust-simulator-ch33"
 import { simulateCh32Output } from "./rust-simulator-ch32"
@@ -1011,6 +1012,9 @@ function findCompilationError(code: string, filename: string): string | null {
 export function simulateRustExecution(code: string, key?: string, filename = "main.rs"): string {
   const compilationError = findCompilationError(code, filename)
   if (compilationError) return compilationError
+
+  const ch35Output = simulateCh35Output(code, key)
+  if (ch35Output !== null) return ch35Output
 
   const ch34Output = simulateCh34Output(code, key)
   if (ch34Output !== null) return ch34Output
````

### File: `components/rust-book/types.ts`
````diff
--- components/rust-book/types.ts
+++ components/rust-book/types.ts
@@ -23,4 +23,5 @@ import { DEFAULT_CODES_CH30 } from "./default-codes-ch30"
 import { DEFAULT_CODES_CH31 } from "./default-codes-ch31"
 import { DEFAULT_CODES_CH32 } from "./default-codes-ch32"
 import { DEFAULT_CODES_CH33 } from "./default-codes-ch33"
 import { DEFAULT_CODES_CH34 } from "./default-codes-ch34"
+import { DEFAULT_CODES_CH35 } from "./default-codes-ch35"
@@ -852,10 +853,33 @@ export const CHAPTERS: ChapterConfig[] = [
         id: "ch34-memory-profiling-exercises",
         title: "Chapter 34 Exercises",
         shortTitle: "Exercises",
         description:
           "Find clone pressure, diagnose Rc and Arc leaks, choose profiling tools, and build a memory profiling checklist",
         icon: "trophy",
       },
     ],
+  },
+  {
+    id: "ch35-performance-profiling",
+    title: "Chapter 35 · Performance Profiling",
+    icon: "book",
+    pages: [
+      {
+        id: "ch35-performance-profiling",
+        title: "Performance Profiling",
+        shortTitle: "Performance Profiling",
+        description:
+          "CPU profiling, flame graphs, sampling vs instrumentation, Criterion benchmarks, async and lock profiling, serialization and IO analysis, and WASM and FFI profiling boundaries",
+        icon: "book",
+        codeKeys: ["performance_profiling_hot_stage_summary", "performance_profiling_pipeline_bottleneck"],
+      },
+      {
+        id: "ch35-performance-profiling-exercises",
+        title: "Chapter 35 Exercises",
+        shortTitle: "Exercises",
+        description:
+          "Interpret flame graphs, design Criterion benchmarks, separate CPU and waiting bottlenecks, and profile async, WASM, and FFI boundaries deliberately",
+        icon: "trophy",
+      },
+    ],
   },
 ]
@@ -1310,5 +1334,6 @@ export const DEFAULT_CODES: Record<string, string> = {
   ...DEFAULT_CODES_CH31,
   ...DEFAULT_CODES_CH32,
   ...DEFAULT_CODES_CH33,
   ...DEFAULT_CODES_CH34,
+  ...DEFAULT_CODES_CH35,
 }
````