"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "IO performance is usually about boundaries, not one clever syscall",
    body: "The expensive part is often the number of syscalls, the number of copies, the number of queue hops, and whether one slow consumer can force every producer to wait or buffer forever.",
  },
  {
    title: "Buffering and batching change the shape of work",
    body: "A buffered wrapper or a bounded queue is not a cosmetic optimization. It changes when bytes move, when writes flush, and where backpressure becomes visible to the rest of the system.",
  },
  {
    title: "Ownership still decides the calmest design",
    body: "A file, socket, or stream handle should usually have one clear Rust owner at a time. Borrow locally, move across thread or task boundaries, and duplicate the OS handle only when that duplication is semantically real.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "The themes will feel familiar: stream buffering, `readv` and `writev`, memory mapping, and socket options. Rust adds sharper ownership edges, so a descriptor handoff or buffer borrow becomes an API decision rather than only a discipline rule.",
  },
  {
    title: "C# background",
    body: "Buffered streams and async APIs will look familiar, but Rust asks for more explicit control over when data is owned, when it is merely borrowed, and when a handle is moved to another thread or task.",
  },
  {
    title: "Go background",
    body: "`bufio`, `io.Reader`, and `net.Conn` are close comparisons, but Rust is more explicit about ownership and backpressure. A bounded queue or owned task handoff is a first-class design choice rather than ambient convention.",
  },
]

const bufferingCards = [
  {
    title: "Buffered IO",
    body: "Use `BufReader` and `BufWriter` when the underlying source or sink is syscall-expensive and your workload naturally reads or writes in many small pieces. The buffer amortizes syscall cost. It does not remove parse cost or copy cost inside your process.",
  },
  {
    title: "Batching and buffering",
    body: "These are related but different. Buffering smooths many small writes into fewer larger writes. Batching groups logical units so one flush, one send, or one wakeup handles several items at once.",
  },
  {
    title: "Backpressure-aware IO",
    body: "A bounded queue is already an overload policy. It makes one promise visible: when the downstream stage falls behind, producers eventually wait or fail fast instead of growing memory without limit.",
  },
]

const zeroCopyCards = [
  {
    title: "Zero-copy IO concepts",
    body: "A borrowed slice can be zero-copy inside your process and still not be zero-copy end-to-end. Kernel crossings, protocol framing, checksums, and TLS may still force copies elsewhere. Be precise about which copy you are removing.",
  },
  {
    title: "Scatter/gather IO",
    body: "Vectored reads and writes let one syscall operate over several buffers. That reduces buffer stitching in user space and is often the cleanest way to send small headers plus bodies without first building one contiguous owned response.",
  },
  {
    title: "Memory-mapped files",
    body: "Memory mapping is best treated as an ecosystem tool and an OS contract, not as the universal answer. It shines for large read-heavy files and random access. It is often the wrong first move for one linear pass or write-heavy scratch data.",
  },
]

const asyncVsBlockingCards = [
  {
    title: "Blocking IO",
    body: "Blocking code is often the simplest choice for one-shot tools, dedicated worker threads, or small services with modest concurrency. It can also be the right answer when the surrounding architecture already budgets threads explicitly.",
  },
  {
    title: "Async IO",
    body: "Async wins when many operations spend most of their time waiting. It loses when CPU work dominates, blocking code sneaks onto runtime workers, or the concurrency level is too small to repay the extra orchestration cost.",
  },
]

const fdOwnershipNotes = [
  "Moving `File`, `TcpStream`, or another handle transfers the Rust owner. That is the calm default for worker handoff.",
  "A duplicated handle changes semantics. `try_clone` creates another owner of the same kernel object. That is not the same thing as borrowing or moving.",
  "Raw descriptor escape hatches are where the invariants get sharp: one owning close path, one valid handle value, and no hidden double-close or use-after-close story.",
  "If a subsystem only needs to observe or write through the handle briefly, borrow the handle. If it may outlive the caller, own the handle instead.",
]

const socketTuningNotes = [
  "Start with ordinary questions: latency or throughput, tiny writes or large writes, idle waits or hot request bursts.",
  "Common stable tuning points include `set_nodelay(true)` for latency-sensitive small writes, `set_nonblocking`, and read or write timeouts for blocking code.",
  "Broader socket option tuning often belongs in a lower-level socket configuration layer rather than being scattered through handler code.",
  "Tune with measurements. A socket option that helps one protocol shape can easily hurt another.",
]

const mmapNotes = [
  "Use mapping when random access or file-backed index access is the real job, not because the phrase sounds fast.",
  "Mapped pages still fault in from storage. Page faults are IO, just with a different surface.",
  "External truncation or mutation changes the safety and correctness story, even if the mapping API itself is safe to call.",
  "Keep mapped data boring at the boundary: read-only tables, indexes, immutable blobs, or other structures whose lifetime and mutation model are explicit.",
]

const profilingChecklist = [
  "Count syscalls per request or per batch, not only CPU samples.",
  "Track bytes per read, bytes per write, flush frequency, and queue depth.",
  "Separate time waiting on IO from time parsing, copying, compressing, or checksumming.",
  "Measure p50 and p99 latency, not only aggregate throughput.",
  "If the service is async, inspect runtime backlog, in-flight task count, and blocking-pool pressure separately from socket throughput.",
]

const productionPatterns = [
  "Borrow buffers locally, but move owned bytes or owned handles across thread, task, cache, or retry boundaries.",
  "Prefer buffered readers and writers when the boundary naturally does many small reads or writes.",
  "Batch small logical units when one flush or one wakeup can cover several items without harming latency goals.",
  "Choose blocking IO for explicit dedicated workers and async IO for large waiting-heavy sets. Do not make the decision by style alone.",
  "Make backpressure visible with bounded queues, concurrency caps, or admission limits before the service is already overloaded.",
]

const pitfalls = [
  "Stacking buffering layers without knowing which layer actually owns flush timing and memory growth.",
  "Calling something zero-copy when the only removed copy was a local string allocation while the expensive kernel or TLS copy still dominates.",
  "Using memory mapping for one simple sequential pass and paying page-fault and lifecycle complexity for no real gain.",
  "Treating a raw descriptor integer as a harmless handle instead of as an ownership trap with double-close risk.",
  "Assuming one vectored write or one socket send always transfers the full logical message. Partial IO is part of the contract.",
  "Profiling only CPU time and missing the real story: syscall count, queue depth, flush behavior, or blocked runtime workers.",
]

export function PageCh27IoTricksAndSystemsProgrammingPatterns() {
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
  const pageIndex = 52
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
          Chapter 27 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Systems IO performance depends on buffering, batching, file descriptor ownership, syscall count, and copy
          avoidance. This chapter applies those constraints to Rust IO and process-boundary code.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 10, 22, 23, 24, 25, and 26</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 10 gave us contiguous buffers and slice-first APIs. Chapter 22 gave us thread ownership. Chapter 23
                covered synchronization and visibility. Chapters 24 through 26 separated futures, Tokio, and CPU pools. This
                chapter ties those ideas to practical IO pipelines and systems edges.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(18)}>
                Chapter 10
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(42)}>
                Chapter 22
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(44)}>
                Chapter 23
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(46)}>
                Chapter 24
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(48)}>
                Chapter 25
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(50)}>
                Chapter 26
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A log and event pipeline tails files, parses line-oriented records, proxies small TCP responses, and moves
            bursts through an internal queue. The business requirement is to reduce syscall churn, copies, and unbounded
            buffering by assigning clear ownership to bytes and handles, then choosing buffering, batching, vectored IO, or
            async orchestration from measured cost.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Count copies, syscalls, and queue hops before rewriting the whole subsystem.</li>
              <li>Decide where one clear owner should hold the bytes or the handle.</li>
              <li>Decide whether the hot path wants buffering, batching, or both.</li>
              <li>Make overload behavior explicit with bounded queues or admission limits.</li>
            </ol>
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
            <h4 className="font-semibold text-foreground mb-3">Buffered IO, batching, and backpressure</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {bufferingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{`read -> parse -> batch -> bounded queue -> buffered write`}</code>
              </pre>
              <p className="mt-3 text-sm text-muted-foreground leading-6">
                That pipeline shape is often more important than the specific wrapper type. If the queue is unbounded or the
                writer flushes every record, the best parser in the system still loses.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Zero-copy concepts, scatter/gather, and memory mapping</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {zeroCopyCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4">
                <h5 className="font-medium text-foreground mb-2">Memory-mapped file caveats</h5>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {mmapNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                  Rust&apos;s standard library does not expose a cross-platform memory-mapping API directly. In practice, this is
                  an ecosystem-level choice plus an OS contract. That is exactly why the workload and lifetime story should be
                  clear before you adopt it.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Blocking IO, async IO, and handle ownership</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {asyncVsBlockingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4">
                <h5 className="font-medium text-foreground mb-2">File descriptor ownership</h5>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {fdOwnershipNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <h5 className="font-medium text-foreground mb-2">Network socket tuning</h5>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {socketTuningNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                Blocking versus async is not a style preference. It is a queueing and scheduling choice. Low-concurrency
                dedicated workers often want blocking simplicity. Large waiting-heavy front doors often want async
                orchestration. CPU work wants its own budget either way.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">IO profiling</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              {profilingChecklist.map((item) => (
                <div key={item} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">How this maps from other languages</h4>
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
                The fastest-looking IO optimization is often the wrong one. If you do not know whether the hot cost is
                copying, flushing, queueing, waiting, or parsing, you are still choosing by folklore.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Examples</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 1: buffered reads, buffered writes, and bounded handoff</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The producer reads line by line, the queue is bounded, and the consumer batches two records per buffered
                  flush. This is a practical shape for line-oriented log or event pipelines.
                </p>
              </div>
              {codes.io_patterns_buffered_backpressure !== DEFAULT_CODES.io_patterns_buffered_backpressure && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("io_patterns_buffered_backpressure")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.io_patterns_buffered_backpressure}
              onChange={(newCode) => updateCode("io_patterns_buffered_backpressure", newCode)}
              onRun={() => runCode("io_patterns_buffered_backpressure")}
              output={outputs.io_patterns_buffered_backpressure ?? null}
              isRunning={isRunning === "io_patterns_buffered_backpressure"}
              filename="buffered_bounded_pipeline.rs"
              expectedOutput={"sent = 3\nreceived = 3\nbatches = 2\nbytes = 17"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.io_patterns_buffered_backpressure}
              onRevert={() => resetCode("io_patterns_buffered_backpressure")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Buffered IO</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `BufReader` and `BufWriter` smooth many small reads and writes into fewer kernel interactions.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Backpressure</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `sync_channel(1)` means the producer eventually waits when the consumer falls behind.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Batching</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Two logical records per flush is a small but explicit batching policy.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: scatter/gather response with socket tuning and stream handoff</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The listener moves the accepted stream into one owner, sets a latency-sensitive socket option, and writes
                  a small header plus body with vectored IO.
                </p>
              </div>
              {codes.io_patterns_scatter_gather_socket !== DEFAULT_CODES.io_patterns_scatter_gather_socket && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("io_patterns_scatter_gather_socket")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.io_patterns_scatter_gather_socket}
              onChange={(newCode) => updateCode("io_patterns_scatter_gather_socket", newCode)}
              onRun={() => runCode("io_patterns_scatter_gather_socket")}
              output={outputs.io_patterns_scatter_gather_socket ?? null}
              isRunning={isRunning === "io_patterns_scatter_gather_socket"}
              filename="scatter_gather_socket_handoff.rs"
              expectedOutput={"nodelay = true\nvectored parts = 2\nclient = hdr:payload"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.io_patterns_scatter_gather_socket}
              onRevert={() => resetCode("io_patterns_scatter_gather_socket")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              This example already uses a small{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">write_all_vectored</code> helper so the
              logical response is fully sent even if one vectored syscall only writes part of the buffers. Keep that pattern
              near the socket boundary in real services instead of assuming small responses always finish in one call.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Scatter/gather</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `IoSlice` avoids stitching a tiny response together just to make one small write call.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Handle ownership</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The accepted stream moves into one thread and one closure. That keeps ownership simple.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Socket tuning</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `set_nodelay(true)` is a workload decision. Small request-response protocols often care more about latency
                  than about coalescing tiny writes.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch27_io_tricks_and_systems_programming_patterns/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to compare buffered and unbuffered reads, reason about file-descriptor
            ownership, design a backpressure-aware IO pipeline, and choose when vectored IO, memory mapping, or async
            orchestration are the right tool.
          </p>
          <Button onClick={() => setCurrentPage(53)} className="gap-2">
            Open Chapter 27 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Buffered IO reduces syscall churn, but it does not remove parse cost or ownership decisions.</li>
            <li>Zero-copy is only meaningful when you say which copy disappeared and which copies still remain.</li>
            <li>Memory mapping, vectored IO, and raw handle escape hatches are strongest when the workload and invariants are explicit.</li>
            <li>Blocking and async IO solve different scheduling problems. CPU work still needs its own budget either way.</li>
            <li>Backpressure and profiling belong in the design from the start: bounded queues, flush policy, syscall counts, and p99 latency all matter.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
