"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  Boxes,
  Cpu,
  Gauge,
  Layers,
  Network,
  Workflow,
} from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { PAGES } from "../types"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { Button } from "@/components/ui/button"

const whyReadCards = [
  {
    title: "Cross the language boundary on purpose",
    body: "Call into existing C and C++ from Rust, and expose Rust back across a stable C ABI, deciding deliberately who owns memory, how errors cross the seam, and what happens when a panic meets foreign code.",
  },
  {
    title: "Ship Rust where the browser runs",
    body: "Compile to WebAssembly and wire it to JavaScript, so the same correctness guarantees you rely on server-side reach the client without a rewrite into a second language.",
  },
  {
    title: "Move work off a single process",
    body: "Use message brokers, distributed task runners, and MPI to spread a workload across cores, machines, and a cluster, while keeping delivery, retries, and rank communication explicit rather than hopeful.",
  },
  {
    title: "Make the GPU a first-class target",
    body: "Drive CUDA and accelerator kernels from Rust for the data-parallel inner loops where a CPU simply cannot keep up, and reason about the host-device transfer cost that decides whether it was worth it.",
  },
  {
    title: "Measure before you optimize",
    body: "Profile memory, CPU time, and distributed task flow with real tooling, then apply the algorithm-tuning chapters and their hands-on challenges so the speedups you claim are the ones a profiler can confirm.",
  },
]

const arcSnippet = `// One workload, several execution targets.
let data = load_dataset();

let local   = run_on_threads(&data);   // Part IV foundations
let remote  = dispatch_to_workers(&data);  // brokers, MPI
let on_gpu  = launch_cuda_kernel(&data);   // accelerators

// Whatever the target, the contract stays explicit:
// who owns the bytes, where they travel, and what it cost.
assert_eq!(local, remote);
assert_eq!(local, on_gpu);`

const chapters = [
  {
    id: "ch28-cpp-integration",
    number: "28",
    title: "C++ Integration",
    blurb: "Call C and C++ from Rust and expose Rust over a C ABI, with ownership, error codes, and unwind policy made explicit at the seam.",
  },
  {
    id: "ch29-js-and-cpp-integration-for-wasm",
    number: "29",
    title: "JavaScript and C++ Integration for WASM",
    blurb: "Compile Rust to WebAssembly and bind it to JavaScript so client-side code inherits Rust's safety and performance.",
  },
  {
    id: "ch30-amqp-and-message-brokers",
    number: "30",
    title: "AMQP and Message Brokers",
    blurb: "Treat a broker as an operational contract: routing, at-least-once delivery, idempotent consumers, dead-letter paths, and backpressure.",
  },
  {
    id: "ch31-distributed-task-execution",
    number: "31",
    title: "Distributed Task Execution",
    blurb: "Dispatch units of work across many workers, track their state, and recover cleanly when a worker dies mid-task.",
  },
  {
    id: "ch32-mpi-and-high-performance-computing",
    number: "32",
    title: "MPI and High-Performance Computing",
    blurb: "Partition data across ranks, choose collective-friendly layouts, and combine MPI with threads for cluster-scale workloads.",
  },
  {
    id: "ch33-performance-oriented-rust",
    number: "33",
    title: "Performance-Oriented Rust",
    blurb: "Write code the optimizer and the cache can love: layout, allocation discipline, and the costs that abstractions cannot hide.",
  },
  {
    id: "ch34-memory-profiling",
    number: "34",
    title: "Memory Profiling",
    blurb: "Find where memory actually goes with real allocation and heap tooling, instead of guessing from intuition.",
  },
  {
    id: "ch35-performance-profiling",
    number: "35",
    title: "Performance Profiling",
    blurb: "Locate the true hot path with sampling and instrumentation before changing a single line for speed.",
  },
  {
    id: "ch36-distributed-tasks-profiling",
    number: "36",
    title: "Distributed Tasks Profiling",
    blurb: "Trace work as it crosses process and machine boundaries so latency and bottlenecks become visible, not anecdotal.",
  },
  {
    id: "ch37-cuda-and-gpu-acceleration",
    number: "37",
    title: "CUDA and GPU Acceleration",
    blurb: "Drive GPU kernels from Rust for data-parallel inner loops, and weigh the host-device transfer cost against the gain.",
  },
  {
    id: "ch38-merkle-tree-games-and-challenges",
    number: "38",
    title: "Merkle Tree Games and Challenges",
    blurb: "Sharpen hashing, verification, and tree-structure intuition through hands-on Merkle challenges.",
  },
  {
    id: "ch39-graph-search-games",
    number: "39",
    title: "Graph Search Games",
    blurb: "Practice traversal, frontier management, and search-strategy tuning on graph problems with measurable outcomes.",
  },
  {
    id: "ch40-matrix-optimization-games",
    number: "40",
    title: "Matrix Optimization Games",
    blurb: "Tune matrix kernels for layout, blocking, and parallelism, then confirm the wins against a profiler.",
  },
]

export function PagePart5IntegrationDistributedHpc() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("part-5-integration-distributed-hpc")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Layers className="h-4 w-4" />
          Part V
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">
          Integration, Distributed Systems, and HPC
        </h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          What to do when your problem no longer fits inside one process.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground leading-6">
            Up to this point the work has lived inside a single Rust process: ownership, traits, error handling, and
            concurrency all play out within one address space you fully control. This part is about the moment that stops
            being enough. The dataset is too large for one machine, the latency budget demands a GPU, an existing C++
            library is the only sane way to do the math, or the same logic has to run in a browser. Each of those is a
            boundary, and boundaries are where casual assumptions become production incidents.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-4">
            For a senior engineer arriving from C++, C#, Go, or Python, the value here is not a new framework to memorize.
            It is that Rust forces the boundary questions into the open. Who owns these bytes once they cross the FFI seam?
            What happens to that message if the consumer crashes before it acknowledges? Which rank holds which slice of
            the matrix, and what does the all-reduce actually cost? In other ecosystems those answers are often defaults
            buried in a runtime or a task library. Here they become decisions you can read in the code and confirm with a
            profiler.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-4">
            The arc runs from integration outward: first crossing the language boundary with C++ and WebAssembly, then
            crossing the process and machine boundary with brokers, distributed tasks, and MPI, then crossing the
            hardware boundary onto the GPU, and finally the discipline that makes all of it honest, profiling and the
            algorithm-tuning challenges that prove a speedup was real.
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Why read this part</h3>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {whyReadCards.map((card) => (
              <div key={card.title} className="rounded-xl border border-border bg-card p-5">
                <div className="font-medium text-foreground mb-2">{card.title}</div>
                <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">The shape of this part</h3>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground leading-6 mb-2">
              Every chapter in this part pushes the same workload across a different boundary. The big idea is that the
              boundary, not the language, is where the engineering happens: each hop adds serialization, transfer cost,
              and a new failure mode, and the chapters teach you to make those explicit instead of accidental.
            </p>
            <MermaidDiagram
              chart={`flowchart LR\n  Core[Single-process Rust] --> Lang[Language boundary: C++ and WASM]\n  Lang --> Proc[Process and machine boundary: brokers, tasks, MPI]\n  Proc --> HW[Hardware boundary: CUDA and GPUs]\n  HW --> Prof{Profile and tune}\n  Prof -->|confirmed speedup| HW\n  Prof -->|measure the cost| Proc`}
              caption="The part moves outward through boundaries, then loops back through profiling so every claimed speedup is one a profiler can confirm."
            />
            <p className="text-sm text-muted-foreground leading-6 mt-2">
              In code, the spirit is one workload aimed at several targets, where the contract stays the same no matter
              where it runs.
            </p>
            <pre className="mt-3 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{arcSnippet}</code>
            </pre>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Chapters in this part</h3>
          </div>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() => setCurrentPage(getPageIndexById(chapter.id))}
                className="group flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-muted/40"
              >
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                  {chapter.number}
                </span>
                <span className="flex-1">
                  <span className="block font-medium text-foreground">{chapter.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground leading-6">{chapter.blurb}</span>
                </span>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Network className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Start with the language boundary</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 28 begins where most real integration begins: a stable C ABI between Rust and C++, where you
                decide ownership, error signaling, and unwind policy by hand. It sets the habits the rest of the part
                builds on.
              </p>
            </div>
            <Button
              onClick={() => setCurrentPage(getPageIndexById("ch28-cpp-integration"))}
              className="gap-2 shrink-0"
            >
              <Cpu className="h-4 w-4" />
              Begin Part V
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
