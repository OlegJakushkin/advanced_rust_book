"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Network, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "IO cost lives at boundaries, not in one clever syscall",
    body: "The expensive part of an IO path is rarely the algorithm in the middle. It is the number of syscalls you make, the number of times bytes are copied, the number of queue hops between stages, and whether one slow consumer can force every producer to wait or to buffer without limit. Optimizing the wrong middle while ignoring those boundaries is how a rewrite makes a system slower.",
  },
  {
    title: "Buffering and batching change the shape of work, not just its speed",
    body: "A buffered wrapper or a bounded queue is not a cosmetic tweak you sprinkle on at the end. It decides when bytes actually move, when a write reaches the kernel, and where backpressure becomes visible to the rest of the system. Add buffering without knowing which layer owns flush timing, and you have changed correctness, not only throughput.",
  },
  {
    title: "Ownership still decides the calmest design",
    body: "A file, socket, or stream handle should have one clear Rust owner at a time. Borrow it locally for a narrow read or write, move it when a worker takes responsibility, and duplicate the OS handle only when that duplication is semantically real. The handle is a resource with a close protocol, and Rust lets you make that protocol an API decision instead of a discipline rule.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "The themes transfer almost directly: stream buffering, readv and writev, mmap, and socket options are old friends. The shift is that a descriptor handoff or a buffer borrow stops being a discipline rule enforced by code review and becomes an API decision the compiler checks. Where you once relied on convention to avoid a double close, Rust asks you to encode who owns the handle and when it is moved.",
  },
  {
    title: "C# background",
    body: "Buffered streams and async stream APIs will feel familiar, but the runtime no longer hides when data is owned versus borrowed. There is no garbage collector to absorb a leaked buffer or a forgotten handle, so the question of who holds the bytes when they cross a thread or task boundary moves to the front and stays explicit in the type.",
  },
  {
    title: "Go background",
    body: "bufio, io.Reader, and net.Conn map cleanly, but Rust makes ownership and backpressure first-class rather than ambient. A bounded channel is a deliberate overload policy you choose, not a convenience; passing an owned handle to a worker is a move you can see, not a shared pointer everyone quietly assumes is safe.",
  },
  {
    title: "Python background",
    body: "Coming from file objects, io.BufferedReader, and asyncio, the buffering ideas carry over but the costs become visible. There is no interpreter smoothing over copies and no with-block magic deciding when a handle closes; you decide when bytes are owned, when a flush happens, and when the descriptor is dropped, and those choices are part of the function signature rather than runtime behavior.",
  },
]

const bufferingCards = [
  {
    title: "Buffered IO",
    body: "Use BufReader and BufWriter when the underlying source or sink is syscall-expensive and the workload naturally moves data in many small pieces. The buffer amortizes syscall cost across many reads or writes. It does not remove parse cost or in-process copy cost; it only changes how often you cross into the kernel.",
  },
  {
    title: "Batching",
    body: "Buffering and batching are related but distinct. Buffering smooths many small writes into fewer larger syscalls at the byte level. Batching groups logical units so one flush, one send, or one wakeup handles several items at once. You often want both, but they answer different questions and have different latency costs.",
  },
  {
    title: "Backpressure",
    body: "A bounded queue is already an overload policy. It makes one promise visible: when the downstream stage falls behind, producers eventually wait or fail fast instead of growing memory without limit. An unbounded queue does not remove overload; it just defers it until the process runs out of heap.",
  },
]

const zeroCopyCards = [
  {
    title: "Zero-copy concepts",
    body: "A borrowed slice can be zero-copy inside your process and still not be zero-copy end to end. Kernel crossings, protocol framing, checksums, and TLS may each force a copy you do not control. Be precise about which copy you actually removed, because removing a local allocation while the kernel copy still dominates buys nothing.",
  },
  {
    title: "Scatter/gather IO",
    body: "Vectored reads and writes let one syscall operate over several non-contiguous buffers. That removes the user-space stitching step where you would otherwise concatenate a small header and a body into one owned buffer just to issue a single write. It is the cleanest way to send framed responses without building a contiguous copy first.",
  },
  {
    title: "Memory-mapped files",
    body: "Memory mapping is best treated as an OS contract and an ecosystem tool, not the universal fast path. It shines for large, read-heavy files and random access. It is often the wrong first move for one linear pass or for write-heavy scratch data, where a buffered reader or writer is simpler and just as fast.",
  },
]

const asyncVsBlockingCards = [
  {
    title: "Blocking IO",
    body: "Blocking code is frequently the simplest correct choice for one-shot tools, dedicated worker threads, or small services with modest concurrency. It is also right when the surrounding architecture already budgets threads explicitly, because a thread that blocks on a read is easy to reason about and cheap to debug.",
  },
  {
    title: "Async IO",
    body: "Async wins when many operations spend most of their time waiting and the concurrency level is high enough to repay the orchestration cost. It loses when CPU work dominates, when blocking code sneaks onto runtime workers and stalls the executor, or when the concurrency is so small that threads would have been simpler.",
  },
]

const fdOwnershipNotes = [
  "Moving File, TcpStream, or another handle transfers the Rust owner outright. That is the calm default for handing work to a worker.",
  "A duplicated handle changes semantics. try_clone creates another owner of the same kernel object; it is not the same as borrowing or moving.",
  "Raw descriptor escape hatches are where invariants get sharp: one owning close path, one valid handle value, and no hidden double-close or use-after-close story.",
  "If a subsystem only needs to observe or write through the handle briefly, borrow it. If it may outlive the caller, give it ownership instead.",
]

const socketTuningNotes = [
  "Start with ordinary questions: latency or throughput, tiny writes or large writes, idle waits or hot request bursts.",
  "Common stable tuning points are set_nodelay(true) for latency-sensitive small writes, set_nonblocking, and read or write timeouts for blocking code.",
  "Broader socket option tuning usually belongs in a lower-level socket configuration layer rather than scattered through handler code.",
  "Tune with measurements. A socket option that helps one protocol shape can easily hurt another.",
]

const mmapNotes = [
  "Use mapping when random access or file-backed index access is the real job, not because the phrase sounds fast.",
  "Mapped pages still fault in from storage. Page faults are IO, just with a different surface that does not show up as a read syscall.",
  "External truncation or mutation changes the safety and correctness story, even when the mapping API itself is safe to call.",
  "Keep mapped data boring at the boundary: read-only tables, indexes, immutable blobs, or structures whose lifetime and mutation model are explicit.",
]

const profilingChecklist = [
  "Count syscalls per request or per batch, not only CPU samples.",
  "Track bytes per read, bytes per write, flush frequency, and queue depth.",
  "Separate time spent waiting on IO from time spent parsing, copying, compressing, or checksumming.",
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
  const pageIndex = getPageIndexById("ch27-io-tricks-and-systems-programming-patterns")
  const page = PAGES[pageIndex]
  const exercisesPageIndex = getPageIndexById("ch27-io-tricks-and-systems-programming-patterns-exercises")
  const chapter28PageIndex = getPageIndexById("ch28-cpp-integration")
  const chapter10PageIndex = getPageIndexById("ch10-arrays-slices-and-vectors")
  const chapter22PageIndex = getPageIndexById("ch22-multithreading-in-rust")
  const chapter23PageIndex = getPageIndexById("ch23-synchronization-primitives")
  const chapter24PageIndex = getPageIndexById("ch24-coroutines-futures-and-async-rust")
  const chapter25PageIndex = getPageIndexById("ch25-tokio")
  const chapter26PageIndex = getPageIndexById("ch26-task-libraries-and-parallel-execution")

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
          Systems IO performance comes down to a few measurable quantities: how many syscalls you make, how many times
          bytes are copied, who owns each file descriptor, and whether overload is bounded or hidden. This chapter applies
          those constraints to ordinary Rust IO and process-boundary code.
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
              <Button variant="outline" onClick={() => setCurrentPage(chapter10PageIndex)}>
                Chapter 10
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter22PageIndex)}>
                Chapter 22
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter23PageIndex)}>
                Chapter 23
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter24PageIndex)}>
                Chapter 24
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter25PageIndex)}>
                Chapter 25
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter26PageIndex)}>
                Chapter 26
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A log and event pipeline tails files, parses line-oriented records, proxies small TCP responses, and moves
            bursts through an internal queue.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            The goal is to reduce syscall churn, copies, and unbounded buffering. The way there is to assign clear ownership
            to bytes and handles first, then choose buffering, batching, vectored IO, or async orchestration from measured
            cost rather than from instinct.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            The shape worth holding in your head is a pipeline of stages connected by a bounded queue. Bytes arrive at a
            reader, get parsed into records, get grouped into batches, cross the queue under backpressure, and leave through
            a buffered writer. Every box in that pipeline is a place where a copy can be saved or wasted, and the queue in
            the middle is the only thing that keeps a slow writer from forcing the reader to buffer the whole file in memory.
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Src[(file or socket)] --> R[BufReader]\n  R -->|read_line| P[parse record]\n  P --> Ba[batch records]\n  Ba -->|send, blocks if full| Q[[bounded queue]]\n  Q -->|recv| W[BufWriter]\n  W -->|flush| Sink[(file or socket)]`}
            caption="The pipeline shape matters more than any single wrapper: a bounded queue between reader and writer is what makes backpressure visible instead of letting memory grow without limit."
          />
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              These three levers are often discussed together and confused for one another, but they act on different parts
              of the pipeline. Buffering changes how often bytes cross into the kernel. Batching changes how many logical
              records a single flush or wakeup covers. Backpressure changes what happens when the downstream stage cannot
              keep up. You usually want all three, and you want to know which one you are reaching for.
            </p>
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
                writer flushes every record, the best parser in the system still loses to syscall churn and memory growth.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Zero-copy concepts, scatter/gather, and memory mapping</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              &quot;Zero-copy&quot; is a precise claim, not a mood. The useful version names exactly which copy you removed and
              admits which copies remain. Scatter/gather and memory mapping are two concrete techniques that remove specific
              copies, each with its own cost: vectored IO removes the stitching of small buffers, and mapping removes the
              read syscall in exchange for page faults and a sharper lifetime story.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {zeroCopyCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              The vectored-write idea is the easiest one to picture. Instead of allocating a new buffer to hold the header
              followed by the body, you hand the kernel a small array of slices and let it gather them in one syscall. The
              header and body keep their own owners; nothing is concatenated in user space.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  H[header slice hdr] --> V[write_vectored]\n  Bo[body slice payload] --> V\n  V -->|one syscall| K[(kernel socket buffer)]\n  K --> Net[network]`}
              caption="Scatter/gather hands several borrowed slices to one syscall, so a framed response is sent without first building one contiguous owned buffer."
            />
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
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6 mb-3">
                There is no listing to run here because the standard library has no mapping call, but the ecosystem shape is
                small enough to read at a glance. A read-only mapping over an opened file looks like this:
              </p>
              <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{`// Cargo.toml: memmap2 = "0.9"
use std::fs::File;
use memmap2::Mmap;

let file = File::open("index.bin")?;
// SAFETY: the file must not be truncated or mutated by another
// process for the lifetime of the mapping, or reads can fault.
let map = unsafe { Mmap::map(&file)? };

// map now behaves like a &[u8] backed by page faults, not read syscalls.
let first_four = &map[..4];`}</code>
              </pre>
              <p className="mt-3 text-sm text-muted-foreground leading-6">
                The mapping is created with <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">unsafe</code>{" "}
                because the safety contract lives outside Rust: nothing in the type system stops another process from
                truncating the file out from under the mapping. That is the lifetime story the caveats above are asking you to
                pin down before reaching for it.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Blocking IO, async IO, and handle ownership</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The choice between blocking and async IO is a queueing and scheduling decision, not a matter of taste. A
              blocking read parks one thread until data arrives, which is simple and cheap when you have a small, fixed set of
              workers. An async read parks a task and frees the thread to serve thousands of other waiting tasks, which is the
              right trade only when waiting genuinely dominates and the concurrency is high.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {asyncVsBlockingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <MermaidDiagram
              chart={`flowchart TD\n  Q{What dominates the work?}\n  Q -->|waiting, high concurrency| A[Async runtime]\n  Q -->|small fixed worker set| B[Blocking threads]\n  Q -->|CPU bound| C[Dedicated CPU pool]\n  A -->|never block a worker| C\n  B -->|offload heavy compute| C`}
              caption="Pick the IO model from where the time actually goes: waiting-heavy and highly concurrent leans async, a small worker set leans blocking, and CPU work needs its own budget either way."
            />
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              Whichever IO model you pick, the handle underneath is a resource with a close protocol, and ownership is what
              keeps that protocol correct. Moving a handle into a worker is the calm default; duplicating it with try_clone is
              a real semantic choice; and dropping to a raw descriptor integer is where double-close and use-after-close bugs
              live. Socket tuning is a smaller, related set of decisions you make per workload.
            </p>
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
            <MermaidDiagram
              chart={`stateDiagram-v2\n  [*] --> Owned: open returns File or TcpStream\n  Owned --> Borrowed: lend a mutable ref for a read or write\n  Borrowed --> Owned: borrow ends\n  Owned --> Moved: move into worker thread or task\n  Owned --> Duplicated: try_clone makes a second owner\n  Moved --> Closed: drop runs close once\n  Duplicated --> Closed: each owner closes its own\n  Closed --> [*]`}
              caption="A handle has one owner at a time. Borrowing is temporary, moving transfers responsibility, try_clone makes a real second owner, and drop runs the single close path."
            />
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              An IO subsystem that is slow for an unknown reason cannot be fixed with folklore. Before reaching for a fancy
              technique, measure where the time and the syscalls go. The checklist below is the minimum set of signals that
              tells you whether the bottleneck is copying, flushing, queueing, waiting, or parsing, so the optimization you
              choose addresses the cost that actually exists.
            </p>
            <div className="grid gap-3 lg:grid-cols-2">
              {profilingChecklist.map((item) => (
                <div key={item} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How this lands by background</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            Most engineers reach this chapter already knowing the IO vocabulary from another ecosystem. The buffering and
            vectored-IO ideas transfer almost unchanged; the part that trips people up is ownership. In Rust a file handle
            or a buffer is a value with a single owner and a deterministic close, so the mental shift is about where that
            ownership lives as bytes cross thread, task, and process boundaries, not about new API names.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {comparisonCallouts.map((comparison) => (
              <div key={comparison.title} className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
              </div>
            ))}
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the producer thread and the consumer run on two clocks joined only by a{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">sync_channel(1)</code>. Because the channel
              holds at most one in-flight item, a fast reader cannot race ahead of a slow writer; the{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">send</code> simply blocks until there is
              room. On the consumer side, records accumulate in a small pending vector and are flushed two at a time, with a
              final partial flush so nothing is left behind. Follow one line through the diagram, then read the same path in
              code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  In[(Cursor of 3 lines)] --> BR[BufReader.read_line]\n  BR -->|String| TX[tx.send, blocks if full]\n  TX --> CH[[sync_channel cap 1]]\n  CH -->|rx.recv| Pend[pending vec]\n  Pend -->|len reaches 2| Flush[writeln batch then count]\n  Pend -->|loop ends| Tail[flush leftover]\n  Flush --> BW[BufWriter into Vec]\n  Tail --> BW`}
              caption="Three lines flow reader to bounded channel to consumer; the consumer flushes in batches of two and then drains the final leftover, giving two batches for three records."
            />
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
                  BufReader and BufWriter smooth many small reads and writes into fewer kernel interactions.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Backpressure</div>
                <p className="text-xs text-muted-foreground leading-5">
                  sync_channel(1) means the producer eventually waits when the consumer falls behind.
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the accepted stream is moved into the server thread so exactly one owner drives the response,
              and the response is two borrowed slices, a header and a body, that are never concatenated. The{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">write_all_vectored</code> helper is the
              load-bearing detail: a single{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">write_vectored</code> can write only part
              of the buffers, so the loop calls{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">IoSlice::advance_slices</code> to skip the
              bytes already sent and keeps going until both slices are fully drained. The diagram is that retry loop.
            </p>
            <MermaidDiagram
              chart={`stateDiagram-v2\n  [*] --> Accept\n  Accept --> Tune: set nodelay true\n  Tune --> Write: write_vectored over parts\n  Write --> Advance: wrote some bytes, advance_slices\n  Advance --> Done: all slices empty\n  Advance --> Write: bytes remain\n  Write --> Err: wrote zero bytes\n  Done --> [*]: flush and report\n  Err --> [*]: WriteZero error`}
              caption="Partial writes are part of the contract: advance past the bytes already sent and loop until both slices are empty, treating a zero-byte write as a closed socket."
            />
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
              near the socket boundary in real services instead of assuming small responses always finish in one call. The
              reported{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">vectored parts = 2</code> counts the
              original slice array the response was built from, not how many slices remained after the retry loop. The helper
              advances its own local view of the slices while draining them, so the array the server still holds is unchanged
              at length two; this value is the slice count, not a partial-write progress signal.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Scatter/gather</div>
                <p className="text-xs text-muted-foreground leading-5">
                  IoSlice avoids stitching a tiny response together just to make one small write call.
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
                  set_nodelay(true) is a workload decision. Small request-response protocols often care more about latency
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
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 27 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Next chapter</h3>
              <p className="text-sm text-muted-foreground leading-6">
                This chapter kept everything inside Rust, where ownership decided who held each buffer and handle. Chapter 28
                pushes those same ownership and lifetime questions across a language boundary into C and C++, where the
                compiler can no longer check the contract for you and the handoff has to be encoded by hand.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(chapter28PageIndex)} className="gap-2 shrink-0">
              Continue to Chapter 28
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
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
