"use client"

import { useEffect } from "react"
import { Activity, ArrowRight, BookOpen, Bug, Cpu, Gauge, Layers, Shield, Timer, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "Start from a question, not a tool",
    body: "Before you reach for a profiler, decide what you are trying to learn. A profile is only useful when it answers one operational question at a time: where is wall time or CPU time actually going, and is the cost compute, waiting, locking, copying, or crossing a boundary? Picking the tool before the question is how teams end up with a flame graph that does not explain the regression they were chasing.",
  },
  {
    title: "Sampling and instrumentation see different things",
    body: "Sampling interrupts the program at a fixed rate and records the call stack each time, so it is cheap and shows you broadly where CPU time concentrates. Instrumentation adds explicit timers around code you choose, so it can measure a single boundary precisely: queue wait, lock acquisition, serialization, or an FFI call. Neither is better; they answer different questions, and reaching for the wrong one wastes a debugging cycle.",
  },
  {
    title: "Wall time is a sum of layers, not one number",
    body: "A request that takes 40ms is almost never 40ms of one thing. It can be mostly CPU, mostly IO wait, mostly lock contention, or mostly time spent queued before the handler even began. The single most valuable move in profiling is to split that wall time into its layers first. Only then does it make sense to argue about which code to change.",
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
    body: "The hardware-level intuition transfers directly: cache misses, branch misprediction, and heap traffic still dominate hot loops, and perf and flame graphs work the same way. The shift is that Rust pins down clone and handoff costs in the source, so a code reviewer can spot an accidental deep copy before it ever reaches the profiler. Spend less time reverse-engineering where a copy happened and more time on the algorithm.",
  },
  {
    title: "C# background",
    body: "There is no GC to blame and no GC pause to hunt for in a trace. Allocation cost in Rust is paid at a deterministic point you can see in the code, so a profile points at the call site, not at a background collector. The trap is expecting an allocation profiler to be the main tool; in Rust, the allocation is usually visible at the line that owns the value.",
  },
  {
    title: "Go background",
    body: "The lightweight-task instinct carries over to Tokio, but the pprof-style 'just look at the goroutine profile' reflex does not map cleanly. A slow async service is usually slow because of queue wait, semaphore limits, or work parked on blocking threads, not because a single function is hot. Profile where the task waits before you profile where it computes.",
  },
  {
    title: "Python background",
    body: "You are leaving the world where cProfile and line-level timers are the default because the interpreter dominates everything. In Rust the interpreter overhead is gone, so the remaining cost is real work: serialization, syscalls, contention, and boundary crossings. The lesson from Python data and ML code still applies, though — when Rust is the fast kernel behind a slower host, the cost often lives at the boundary, so measure the call frequency across it first.",
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
          Performance profiling converts slow paths into verifiable bottlenecks with owners, budgets, and measurements.
          This chapter covers benchmarks, flame graphs, counters, and regression checks.
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
            A release went out last night and p99 latency climbed. The on-call dashboards are not helping, because every
            team is reading a different signal: one engineer points at a CPU flame graph, another at growing queue depth,
            a third at serialization timings that look slightly worse than last week. They are all looking at fragments of
            the same wall-clock budget, and none of those fragments alone tells you which subsystem to change.
          </p>
          <p className="mt-3 text-sm text-muted-foreground leading-6">
            The job for this chapter is the discipline that resolves that argument. Before anyone rewrites a function, the
            wall time of a slow request has to be split into the layers it actually spends time in: CPU compute, time spent
            waiting in a queue, time blocked on a lock, IO, serialization, and the overhead of crossing a boundary such as
            FFI or WASM. Once the budget is decomposed, the owning subsystem is usually obvious, and the next code change
            is aimed instead of guessed.
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Req[Slow request] --> Q[Queue wait]\n  Q --> CPU[CPU compute]\n  CPU --> Lock[Lock wait]\n  Lock --> Ser[Serialization]\n  Ser --> IO[IO and boundary]\n  IO --> Resp[Response]`}
            caption="Wall time is a chain of layers. A profile that names one number hides which link is long."
          />
          <p className="mt-1 text-sm text-muted-foreground leading-6">
            Each question below maps to a different tool. The skill is matching the question to the instrument that answers
            it with the least distortion.
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
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">At a glance</h3>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Choose the profiling tool from the question: benchmark, sampler, instrumentation, trace, or live telemetry.</li>
              <li>Read flame graphs as stack-width evidence, not as a chronological movie.</li>
              <li>Separate CPU time from queue wait, lock wait, serialization, IO, and boundary overhead.</li>
              <li>Use each profile to narrow the next experiment instead of reaching for a rewrite immediately.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Timer className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Questions to ask before you optimize</h3>
            </div>
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
          <p className="text-sm text-muted-foreground leading-6">
            Profiling is less about the tools than about how you frame the work. Three ideas sit underneath everything in
            this chapter, and they are the difference between a profile that ends an argument and one that starts a new
            one.
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
            {mentalModelPoints.map((point) => (
              <div key={point.title} className="rounded-lg border border-border bg-card p-4">
                <h4 className="font-semibold text-foreground mb-2">{point.title}</h4>
                <p className="text-sm text-muted-foreground leading-6">{point.body}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            The sections below unpack each of these ideas with the specific tools and failure modes.
          </p>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Choosing the tool from the question</h4>
            <p className="text-sm text-muted-foreground leading-6">
              The whole toolkit fans out from a single decision: what kind of answer do you need? The diagram below is the
              one to keep in your head. Walk it from the question, not from the tool you happen to have open. A benchmark
              compares two implementations under a fixed workload; a sampler finds the hot CPU path; instrumentation and
              tracing explain where a request spends its timeline; live telemetry confirms the fix mattered in production.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Ask{What do you need?}\n  Ask -->|Compare two versions| Bench[Criterion benchmark]\n  Ask -->|Find hot CPU path| Sample[Sampling profiler + flame graph]\n  Ask -->|Explain a timeline| Instr[Tracing / instrumentation]\n  Ask -->|Prove it in prod| Tele[Live telemetry: p95/p99]`}
              caption="First half: the question picks the instrument. Match the answer you need to the tool before you open anything."
            />
            <p className="mt-3 text-sm text-muted-foreground leading-6">
              All four instruments feed the same loop: make a targeted change, then confirm it with live telemetry.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Bench[Criterion benchmark] --> Fix[Targeted change]\n  Sample[Sampling profiler] --> Fix\n  Instr[Tracing / instrumentation] --> Fix\n  Fix --> Tele[Live telemetry: p95/p99]`}
              caption="Second half: every tool leads to one targeted change, which is then verified in production."
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">CPU profiling</h4>
            <p className="text-sm text-muted-foreground leading-6">
              A sampling CPU profiler is your first move when the symptom is &quot;something is burning cores.&quot; It
              interrupts the running binary many times per second, records the call stack, and aggregates those samples
              into a picture of where compute time concentrates. The output is statistical, not exhaustive, which is
              exactly why it stays cheap enough to run on something close to a real workload. The most important habit is
              to separate inclusive time (a function plus everything it calls) from exclusive time (the function&apos;s
              own body): a caller can look enormously wide only because one child beneath it is doing all the work.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {cpuProfilingNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`cargo flamegraph --bin service -- --workload representative

# or sample the real binary directly
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
            <h4 className="font-semibold text-foreground mb-3">Reading a flame graph</h4>
            <p className="text-sm text-muted-foreground leading-6">
              A flame graph is the standard way to display sampled CPU data, and it is misread constantly. It is not a
              timeline. The x-axis is not chronological; boxes are grouped by the shape of the call stack, and width is
              the total sampled time attributed to that stack. The stack grows upward, so a parent sits below the callees
              it invoked. The diagram below shows the one reading move worth memorizing: find the widest plateau, then
              follow it upward until the work is specific enough to change.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Root[main 100%] --> H[handle_request 95%]\n  H --> P[parse 20%]\n  H --> S[serialize 60%]\n  S --> Enc[encode_fields 55%]\n  Enc --> Alloc[alloc + copy 50%]`}
              caption="Width is sampled time, height is call depth. The wide leaf at the top of a wide stack is the change target."
            />
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {flameGraphRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The trap is optimizing the first named function you recognize. In the graph above, <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">serialize</code> looks
                like the culprit, but the real width is the allocation and copy beneath it. Tuning the serializer&apos;s
                control flow would barely move the number; cutting the copy would.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Sampling versus instrumentation</h4>
            <p className="text-sm text-muted-foreground leading-6">
              These are the two ways to measure a running program, and the choice is a tradeoff between overhead and
              precision. Sampling watches from the outside at a fixed rate, so it perturbs the program very little but
              only sees code that runs often enough to be caught between samples. Instrumentation places explicit timers
              inside the code, so it can account for a single rare event exactly, at the cost of adding work to every
              measured region. Reach for sampling when you do not yet know where the time goes; reach for instrumentation
              when you already suspect a specific boundary and want its number to the microsecond.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
            <p className="text-sm text-muted-foreground leading-6">
              When the question is &quot;is version B actually faster than version A?&quot; a profiler is the wrong tool;
              you want a benchmark. Criterion is the ecosystem default. It runs the measured closure many times, discards
              warmup, and reports a distribution with confidence intervals rather than a single brittle number, which is
              what makes its comparisons trustworthy. The catch is that a benchmark is only as honest as its setup: it
              must run in release mode, on representative input, and it must defeat the optimizer&apos;s habit of deleting
              work whose result is never used. That last point is what <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">black_box</code> is for &mdash; it
              hides a value from dead-code elimination so the compiler cannot &quot;optimize away&quot; the very thing you
              are timing.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
                  Criterion tells you which alternative won and by how much. It does not tell you why. Once you have the
                  comparison, profile the slower variant so the result comes with an explanation instead of just a number.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Profiling async Rust</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Async services break the assumption that a CPU profiler tells the whole story. A task can take 200ms of wall
              time while using almost no CPU, because most of that time was spent enqueued, waiting on a semaphore permit,
              or parked on the blocking thread pool. The diagram below traces a single request through a Tokio runtime so
              you can see where the clock runs without the cores running. When async &quot;feels slow,&quot; profile each
              of those wait points before you profile the handler body.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  In[Request] --> RQ[Runtime queue: queue wait]\n  RQ --> Worker[Worker thread]\n  Worker --> Sem[Await semaphore permit]\n  Sem --> Run[Handler CPU work]\n  Run -->|blocking call| Pool[spawn_blocking pool]\n  Pool --> Done[Complete]\n  Run --> Done`}
              caption="Most async latency hides in the waits: queue, permit, and blocking-pool pressure, not the handler body."
            />
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {asyncProfilingNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                An async regression usually lives in admission policy, queue wait, or CPU work left on runtime workers. The
                first fix is almost never &quot;rewrite the executor.&quot; It is &quot;measure where the task actually
                waits or blocks,&quot; which is exactly what tracing spans around each transition in the diagram will tell
                you.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Profiling lock contention</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Lock cost has two halves that must be measured separately. One is the time a thread spends holding the
              guard and doing work; the other is the time other threads spend blocked, waiting to acquire it. They fail in
              opposite ways: a lock held briefly but acquired constantly is a contention problem, while a lock held for a
              long time by one path starves everyone regardless of frequency. Counting contended acquisitions tells you
              which failure you have, and that determines whether the fix is to shrink the critical section, shard the
              state, or move to a one-owner message-passing design.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {lockProfilingNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                A hot lock is not only a synchronization problem. It is often an ownership problem hiding underneath:
                too-broad shared state, too-long critical sections, or one subsystem missing its own owner. Reach for
                lower-level lock-free structures last, after the cheaper redesigns have been ruled out.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Profiling serialization</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Serialization shows up on flame graphs as a wide, busy stack, and it is easy to blame the encoder when the
              real cost is the data itself. Measure encode and decode time alongside two numbers that explain them:
              allocations per message and bytes per message. A format that looks slow is often just moving too many bytes,
              or allocating a fresh buffer per field. It is also worth separating the serializer from the compression,
              hashing, or encryption frequently layered on top of it, since those can dominate while masquerading as
              &quot;serialization cost.&quot; And when a queue or task boundary keeps large owned payloads alive, the
              retained bytes can matter as much as the encode time.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {serializationProfilingNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Profiling IO pipelines</h4>
            <p className="text-sm text-muted-foreground leading-6">
              IO is where flame graphs lie most convincingly. A sampler shows the CPU busy inside a parser, so the parser
              gets blamed, while a trace reveals the request actually spent most of its life queued before the parser ever
              ran. The honest measurements for an IO path are not CPU samples at all: syscalls per request, bytes per
              write, flush frequency, queue depth, and blocked time. Many tiny writes, partial writes, or an unbounded
              admission queue downstream cause more real latency than any single read loop, and none of them show up
              clearly in a CPU profile.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {ioProfilingNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Profiling boundary crossings: WASM and FFI</h4>
            <p className="text-sm text-muted-foreground leading-6">
              WASM and FFI share one performance failure mode: the cost is rarely in the Rust kernel and almost always in
              the crossing. A native or WASM function can be blazing fast per call and still dominate a workload because
              it is called a million times, or because each call marshals a string, copies a typed array, or transfers
              ownership. The diagram makes the layers visible. Count boundary crossings first, then measure marshalling
              and copy cost, and only then look at the compute inside.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Host[Host: JS or C/C++] -->|call N times| Marshal[Marshal args + copy buffers]\n  Marshal --> Kernel[Rust kernel compute]\n  Kernel --> Back[Marshal result back]\n  Back --> Host`}
              caption="The kernel is fast. The per-call marshalling and copies, multiplied by call count, are usually the bottleneck."
            />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">WASM</div>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {wasmProfilingNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">FFI</div>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {ffiProfilingNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The single highest-leverage experiment for both is to compare a noop call (tiny or empty payload) against
                the real call. The difference is your fixed per-crossing overhead, and if it is large, a batched API that
                crosses once will beat any amount of tuning on the callee.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-foreground">If you are coming from C++, C#, Go, or Python</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The tools overlap with what you already know, but the mental model shifts. The useful question is not
              &quot;which Rust crate replaces my old profiler,&quot; it is &quot;what does Rust make visible that my old
              runtime hid, and where does that change where I point the instrument first.&quot;
            </p>
            <div className="grid gap-3 lg:grid-cols-2">
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
          <p className="text-sm text-muted-foreground leading-6">
            These are the habits that keep a profiling effort honest over time, especially across a team where the person
            who captured a regression is rarely the person who later has to reproduce it. The common thread is discipline
            about scope: one question, one build, one recorded workload.
          </p>
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
          <p className="text-sm text-muted-foreground leading-6">
            Each of these is a mistake made by people who know how to use the tools. They come not from ignorance of the
            profiler but from trusting a single view too far, or from optimizing the thing that was easy to see rather
            than the thing that was actually slow.
          </p>
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
            <h3 className="text-lg font-semibold text-foreground">Examples</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Both examples model the core move of this chapter in a few lines you can run: take per-stage timings, find the
            one that owns the most time, and report it. A real flame graph or trace is richer, but the logic of
            &quot;decompose, then point at the widest layer&quot; is identical, and seeing it as plain data makes the
            graphical tools easier to read.
          </p>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 1: find the hottest stage before drawing the flame graph</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  What to watch: the code records a duration for each stage, then scans for the maximum. That single
                  reduction &mdash; from a list of timings to one named winner &mdash; is exactly the question a flame graph answers
                  visually. The diagram below shows that flow before you read the code.
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
            <MermaidDiagram
              chart={`flowchart TD\n  Stages[parse / decode / serialize timings] --> Max{Pick max stage}\n  Max --> Hot[hottest = serialize]\n  Stages --> Sum[Sum to total us]\n  Hot --> Report[Report hottest + total]\n  Sum --> Report`}
              caption="Decompose into per-stage timings, reduce to the widest one, report it. That is the whole profiling loop in miniature."
            />
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
                  What to watch: the code attributes wall time to named layers, picks the dominant one, and reports the
                  bytes that crossed the serialization boundary. The output (<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">dominant = cpu</code>)
                  is the classification that decides which fix is even worth trying. The diagram shows how the layers feed
                  that decision.
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
            <MermaidDiagram
              chart={`flowchart TD\n  Wall[Wall time budget] --> CPU[CPU]\n  Wall --> IO[IO]\n  Wall --> Lock[Lock wait]\n  Wall --> Ser[Serialization + bytes]\n  CPU --> Pick{Largest layer?}\n  IO --> Pick\n  Lock --> Pick\n  Ser --> Pick\n  Pick --> Dom[dominant = cpu]`}
              caption="Attribute wall time to layers, then let the largest layer choose the fix. A queue tweak cannot help a CPU-bound path."
            />
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
            The companion exercise page asks you to match each profiling question to its instrument, trace the
            hottest-stage reduction, report each stage as a share of wall time, measure fixed per-crossing overhead at a
            WASM or FFI boundary, fix a lock metric that hides contention, and write the decompose-first plan that settles
            a p99 regression argument.
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
