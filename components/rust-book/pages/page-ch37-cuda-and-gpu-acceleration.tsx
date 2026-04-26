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
    title: "A GPU is a throughput device with an expensive boundary",
    body: "CUDA work pays for launch, transfer, and synchronization before the kernel does any useful arithmetic. The payoff comes when the kernel is large, regular, and arithmetic-heavy enough to amortize that boundary.",
  },
  {
    title: "Rust's main job is to keep the host-side boundary honest",
    body: "Kernel code, device buffers, launch configuration, and stream or queue policy usually sit behind a narrow Rust wrapper. The wrapper should make ownership, lengths, mutability, and lifetime assumptions explicit before any unsafe launch happens.",
  },
  {
    title: "GPU acceleration is a systems decision, not only a math decision",
    body: "A kernel can be fast and the service can still be slow. Queueing, device admission, host-device copies, retry policy, and distributed orchestration often dominate once the GPU becomes a shared production resource.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You may already know CUDA from C++ host code. The key Rust difference is not the GPU itself. It is the host-side wrapper discipline: safe ownership on the Rust side, small unsafe launch regions, and explicit buffer contracts.",
  },
  {
    title: "C# background",
    body: "Think less in terms of runtime marshalling and more in terms of explicit resource ownership. A device buffer is not a managed array with nicer syntax. It is a separate memory domain with transfer and lifetime cost.",
  },
  {
    title: "Go background",
    body: "Do not treat a GPU like another goroutine target. Device work is a scarce specialized resource behind transfers and queueing. The honest design usually looks like a bounded worker lane, not a free fan-out destination.",
  },
]

const whenGpuCards = [
  {
    title: "High arithmetic intensity",
    body: "The more math you do per transferred byte, the more likely the GPU wins. Matrix multiply, batched dense kernels, and large reductions fit better than tiny scalar transforms.",
  },
  {
    title: "Regular dense layout",
    body: "Flat dense buffers with predictable access patterns are easier to move, easier to coalesce, and easier to profile than irregular pointer-heavy graphs or tiny stateful objects.",
  },
  {
    title: "Large enough batches",
    body: "A kernel that launches once for a large batch is very different from a service that launches hundreds of tiny kernels per request. Launch count is part of the throughput budget.",
  },
  {
    title: "Few synchronization points",
    body: "Every forced device sync, host wait, or transfer back to the CPU breaks the throughput story. Multi-stage GPU pipelines work best when intermediate results stay on the device for a while.",
  },
  {
    title: "When not to use CUDA",
    body: "Tiny request-local transforms, irregular branchy business logic, frequent host callbacks, and workloads dominated by network or storage wait usually want CPU, Rayon, or MPI first.",
  },
]

const choiceRows = [
  {
    title: "CPU / plain Rust",
    body: "Best for small request-local work, irregular control flow, and latency-sensitive paths where transfer and launch overhead would dominate.",
  },
  {
    title: "Rayon",
    body: "Best for one-node CPU saturation when data already lives in host memory and parallel iteration is the real need.",
  },
  {
    title: "MPI ± threads",
    body: "Best when the dominant boundary is already multi-process or multi-node decomposition and the data distribution problem is bigger than one device.",
  },
  {
    title: "CUDA",
    body: "Best when the kernel is dense, regular, large enough, and likely to reuse device residency long enough to pay back transfer and launch cost.",
  },
]

const ecosystemCards = [
  {
    title: "FFI to existing CUDA or C++ kernels",
    body: "Many teams keep kernels in `.cu` or C++/CUDA code and call them from Rust through a narrow FFI wrapper. This is often the calmest migration path when native kernels already exist.",
  },
  {
    title: "Rust wrappers over CUDA driver or runtime APIs",
    body: "The ecosystem includes crates that wrap lower-level CUDA APIs. They can reduce host-side boilerplate, but the same operational questions remain: device ownership, launch safety, and transfer budgeting.",
  },
  {
    title: "Higher-level tensor or inference runtimes",
    body: "Some systems never launch kernels directly from business code. They call a higher-level runtime and let that layer own streams, kernels, and device memory. That can be right when the abstraction matches the product boundary.",
  },
]

const memoryCards = [
  {
    title: "Host memory",
    body: "Ordinary Rust owners such as `Vec<T>` and slices describe host-side layout. They do not imply device residency. Copying into GPU memory is a separate step with its own lifetime and cost.",
  },
  {
    title: "Device memory",
    body: "A device buffer should usually be modeled as its own owner handle. The handle owns residency on the device. The host wrapper owns when it is allocated, reused, and dropped.",
  },
  {
    title: "Pinned host memory",
    body: "Page-locked host memory can reduce transfer overhead for some paths, but it also changes system memory behavior and should be justified by measured transfer cost, not by habit.",
  },
  {
    title: "Unified or managed memory caveat",
    body: "Unified-memory-style designs can simplify some ownership stories, but they do not remove data movement. They often trade explicit copies for runtime page migration and a less visible performance model.",
  },
]

const overheadCards = [
  {
    title: "Host-device transfer cost",
    body: "Every input buffer moved to the GPU and every result buffer moved back costs bytes on the bus. For small vector operations, transfer can dominate kernel time completely.",
  },
  {
    title: "Kernel launch overhead",
    body: "A kernel launch is not free. A service that launches one kernel per tiny request often loses to a CPU loop even when the GPU kernel is individually efficient.",
  },
  {
    title: "Synchronization overhead",
    body: "A forced sync after every launch or every micro-stage destroys overlap. Profile where the host waits, not only how long the kernel itself runs.",
  },
  {
    title: "Device reuse beats repeated setup",
    body: "Long-lived device buffers, reused streams, and batch-oriented admission policies are often more important than shaving a small amount of arithmetic from one kernel.",
  },
]

const matrixVectorCards = [
  {
    title: "Vector kernels",
    body: "Vector add is the classic demo, but it is often memory-bandwidth-limited and transfer-sensitive. It is useful as a boundary lesson, not as proof that every GPU offload is worthwhile.",
  },
  {
    title: "Matrix and tensor kernels",
    body: "Dense matrix multiply, batched GEMM, convolution-like kernels, and large reductions usually amortize the GPU boundary better because the math per byte is much higher.",
  },
  {
    title: "Irregular workloads",
    body: "Sparse, branch-heavy, pointer-rich, or graph-shaped workloads may still fit the GPU, but they usually need much more careful data preparation and often lose their simplicity advantage quickly.",
  },
]

const profilingChecklist = [
  "Separate HtoD copy time, kernel time, DtoH copy time, and host-side queue wait.",
  "Count launches. A fast kernel launched too often is still a slow service path.",
  "Measure batch size and bytes per batch before tuning occupancy or register use.",
  "Compare against a CPU or Rayon baseline that does the same logical work.",
  "Profile overlap and synchronization: where is the host actually waiting?",
  "Record device utilization, transfer size, and per-stage wall time together.",
]

const abstractionCards = [
  {
    title: "Low-level safe wrapper",
    body: "One narrow Rust function validates lengths, shapes, device residency assumptions, and launch config before entering one small unsafe region.",
  },
  {
    title: "Mid-level buffer and queue abstraction",
    body: "A device-buffer handle, stream handle, or GPU-job queue wrapper makes reuse and admission policy explicit instead of scattering driver calls through handlers.",
  },
  {
    title: "High-level domain API",
    body: "The best public API often says `score_batch`, `multiply_tiles`, or `run_inference` rather than `launch_kernel`. Kernel names are frequently the wrong abstraction for the rest of the system.",
  },
]

const integrationCards = [
  {
    title: "Async integration",
    body: "Treat the GPU like a scarce shared worker. Bound in-flight jobs, own inputs before task handoff, and keep driver or launch calls off the wrong executor threads when they can block.",
  },
  {
    title: "Distributed integration",
    body: "Do not serialize raw device pointers or pretend device residency survives a process boundary. Ship owned envelopes, rebuild device buffers at the worker, and keep idempotency at the task level.",
  },
  {
    title: "Queue admission",
    body: "A bounded GPU queue is already a policy choice. It says when callers wait, when work spills to CPU fallback, and when overload becomes visible to operators.",
  },
  {
    title: "Retry and failure policy",
    body: "GPU OOM, device reset, or one slow specialist worker should not silently stall the whole service. Separate transient retry from terminal routing just as you would in any other distributed subsystem.",
  },
]

const callBoundarySnippet = `unsafe fn raw_launch(
    cfg: LaunchConfig,
    input: &DeviceBuffer,
    output: &mut DeviceBuffer,
) -> Result<(), LaunchError> {
    // driver call or FFI launch
    Ok(())
}

fn checked_launch(...) -> Result<(), LaunchError> {
    validate_lengths(...)?
    unsafe { raw_launch(...) }
}`

const productionPatterns = [
  "Start with one workload budget: transfer bytes, batch size, launch count, and expected arithmetic intensity.",
  "Own host buffers on the Rust side and move them across one explicit host-device boundary. Do not let borrowed request-local data leak into long-lived GPU jobs.",
  "Wrap kernel launches in a checked safe function that states shape, launch-config, and lifetime invariants before the unsafe call.",
  "Keep dense data flat and contiguous. GPU code, SIMD CPU fallbacks, and distributed staging all benefit from the same boring layout discipline.",
  "Treat GPU access like a worker-pool resource with bounded admission, queue age metrics, and a visible retry policy.",
  "Profile the whole path: queue wait, transfer, launch, kernel, sync, and result handling. The fastest kernel in isolation is still a slow feature if the boundary is wrong.",
]

const pitfalls = [
  "Offloading tiny work items because the GPU is available, then paying more in transfer and launch overhead than the CPU would have spent doing the work directly.",
  "Hiding kernel launches behind a 'simple' wrapper that never validates lengths, shapes, or launch configuration before the unsafe boundary.",
  "Treating device memory like a borrowed view of host memory. The residency boundary is real, and so is its lifetime.",
  "Letting async tasks fire unbounded GPU work into one device with no queue budget, no fallback policy, and no saturation metrics.",
  "Profiling only kernel duration while host-device transfer, sync, or queue wait dominates wall time.",
  "Forgetting that multi-node GPU work often wants MPI or another distributed control plane first, not only more local launch abstraction.",
]

const summaryPoints = [
  "CUDA acceleration pays when the kernel is dense, regular, large enough, and arithmetic-heavy enough to amortize transfer and launch cost.",
  "Rust's main job is usually to make the host-side boundary honest: owned buffers, checked launch config, small unsafe regions, and explicit resource lifetimes.",
  "Host-device transfer cost and kernel launch overhead often decide the first offload question before the math kernel does.",
  "Matrix and tensor workloads usually justify the GPU boundary more easily than tiny vector demos or irregular service logic.",
  "Good profiling separates queue wait, transfer, launch, kernel, and sync time instead of calling the whole feature 'GPU work.'",
  "In async and distributed systems, a GPU is best treated as a bounded specialized worker with explicit admission, retry, and observability policy.",
]

export function PageCh37CudaAndGpuAcceleration() {
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
  const pageIndex = getPageIndexById("ch37-cuda-and-gpu-acceleration")
  const chapter28PageIndex = getPageIndexById("ch28-cpp-integration")
  const chapter32PageIndex = getPageIndexById("ch32-mpi-and-high-performance-computing")
  const chapter33PageIndex = getPageIndexById("ch33-performance-oriented-rust")
  const chapter35PageIndex = getPageIndexById("ch35-performance-profiling")
  const chapter36PageIndex = getPageIndexById("ch36-distributed-tasks-profiling")
  const exercisesPageIndex = getPageIndexById("ch37-cuda-and-gpu-acceleration-exercises")
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
          Chapter 37 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          GPU acceleration in Rust becomes much calmer once you treat CUDA as a throughput boundary with explicit memory,
          launch, and scheduling cost rather than as a magical faster loop.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 28, 32, 33, 35, and 36</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 28 gave us FFI boundary discipline. Chapter 32 covered flat numeric layout and HPC thinking.
                Chapter 33 explained Rust&apos;s broader performance model. Chapter 35 covered profiling, and Chapter 36
                covered queue wait, saturation, and distributed task profiling. CUDA work sits across all five.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter28PageIndex)}>
                Chapter 28
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter32PageIndex)}>
                Chapter 32
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter33PageIndex)}>
                Chapter 33
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter35PageIndex)}>
                Chapter 35
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter36PageIndex)}>
                Chapter 36
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            You are adding a GPU-backed batch scorer to an existing Rust service. The CPU version already works, the
            queueing layer is already observable, and the operators already know what a healthy p99 looks like. The
            temptation is to launch one kernel per request and declare victory. The production answer is calmer: batch
            move is calmer: batch enough work to amortize the boundary, move owned host data into a checked GPU wrapper, and keep queue wait,
            transfer, launch, and kernel time visible as separate costs.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">At a glance</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Offload only when dense, regular work can amortize transfer and launch cost.</li>
              <li>Count bytes, launches, and synchronization points before tuning arithmetic.</li>
              <li>Keep device-memory ownership explicit and the unsafe launch wrapper as small as possible.</li>
              <li>Treat the GPU like a bounded specialist worker inside the larger Rust system.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">Design questions</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Would a CPU or Rayon path still win for this batch size and latency target?</li>
              <li>Where does the first owned boundary appear: API edge, queue lane, or device wrapper?</li>
              <li>What must be validated before the raw launch becomes legal?</li>
              <li>Which metric will tell you the path is transfer-bound, launch-bound, queue-bound, or actually kernel-bound?</li>
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
            <h4 className="font-semibold text-foreground mb-3">When GPU acceleration makes sense</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {whenGpuCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-4">
              {choiceRows.map((row) => (
                <div key={row.title} className="rounded-lg border border-border bg-card p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">{row.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{row.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Rust and CUDA ecosystem overview</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {ecosystemCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The key decision is less about one specific crate and more about boundary shape. If your team already owns
                CUDA kernels in native code, FFI may be the calmest first move. If Rust should also own the host-side driver
                boundary, a wrapper crate can reduce boilerplate. If the product already lives behind a tensor or inference
                runtime, the right abstraction may be even higher.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Calling CUDA kernels from Rust</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  The operational shape is usually the same no matter which wrapper or FFI layer you choose: validate
                  lengths and launch configuration on the Rust side, keep the raw launch in one small unsafe region, and
                  return an ordinary Rust result to the rest of the service.
                </p>
                <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{callBoundarySnippet}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  This is one of the cleanest places for Rust to help. C++ host code often leaves buffer shape and launch
                  invariants to convention. A Rust wrapper can make those checks routine without pretending the device call
                  itself is safe by default.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">GPU memory ownership</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {memoryCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Host-device transfer costs and kernel launch overhead</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {overheadCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                The fastest wrong architecture is often a service that moves small tensors to the GPU, launches one tiny
                kernel, synchronizes immediately, and moves the result back. Measure the whole round trip before you call the
                kernel a win.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Matrix and vector workloads</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {matrixVectorCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Profiling CUDA workloads</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {profilingChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A practical first question is simple: are you transfer-bound, launch-bound, queue-bound, or actually
                kernel-bound? A kernel-only profile cannot answer that by itself.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Rust abstractions over GPU code</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {abstractionCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Integrating CUDA with async and distributed systems</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {integrationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
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
                The most common CUDA mistake in service code is not a wrong kernel intrinsic. It is a wrong systems model:
                too many tiny launches, too much copying, or too little admission control around one scarce device.
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
                <h4 className="font-semibold text-foreground">Example 1: a safe Rust wrapper around a kernel launch</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The wrapper owns the host-side checks. The unsafe launch is small, auditable, and isolated behind a
                  length-stable device-buffer contract.
                </p>
              </div>
              {codes.cuda_gpu_kernel_launch_wrapper !== DEFAULT_CODES.cuda_gpu_kernel_launch_wrapper && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("cuda_gpu_kernel_launch_wrapper")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.cuda_gpu_kernel_launch_wrapper}
              onChange={(newCode) => updateCode("cuda_gpu_kernel_launch_wrapper", newCode)}
              onRun={() => runCode("cuda_gpu_kernel_launch_wrapper")}
              output={outputs.cuda_gpu_kernel_launch_wrapper ?? null}
              isRunning={isRunning === "cuda_gpu_kernel_launch_wrapper"}
              filename="safe_kernel_launch_wrapper.rs"
              expectedOutput={"blocks = 16\nthreads = 256\ndevice bytes = 49152"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.cuda_gpu_kernel_launch_wrapper}
              onRevert={() => resetCode("cuda_gpu_kernel_launch_wrapper")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Launch config</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Grid and block shape are checked before the raw launch becomes even possible.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Buffer ownership</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Device buffers are explicit owners. The host wrapper decides when they exist and when they disappear.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Safety surface</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The unsafe block is small enough that another engineer can re-derive the invariants quickly.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: estimate transfer and launch budget before offload</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The first GPU decision is often a budgeting question: how many bytes cross the boundary, how much math
                  happens per byte, and how much launch overhead is already visible.
                </p>
              </div>
              {codes.cuda_gpu_transfer_budget !== DEFAULT_CODES.cuda_gpu_transfer_budget && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("cuda_gpu_transfer_budget")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.cuda_gpu_transfer_budget}
              onChange={(newCode) => updateCode("cuda_gpu_transfer_budget", newCode)}
              onRun={() => runCode("cuda_gpu_transfer_budget")}
              output={outputs.cuda_gpu_transfer_budget ?? null}
              isRunning={isRunning === "cuda_gpu_transfer_budget"}
              filename="transfer_budget_estimator.rs"
              expectedOutput={"transfer bytes = 12000000\nintensity = 5.33\ngpu faster = true"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.cuda_gpu_transfer_budget}
              onRevert={() => resetCode("cuda_gpu_transfer_budget")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Transfer budget</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Bytes on the bus are a first-class cost. Count them before you trust the kernel.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Arithmetic intensity</div>
                <p className="text-xs text-muted-foreground leading-5">
                  More math per byte usually improves the odds that the GPU boundary pays for itself.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Decision boundary</div>
                <p className="text-xs text-muted-foreground leading-5">
                  A GPU is often the right tool only after batch size, intensity, and launch cost are already visible.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch37_cuda_and_gpu_acceleration/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to estimate host-device transfer cost for a matrix workload, sketch a safe
            Rust wrapper around a kernel call, and choose among CPU, Rayon, MPI, and CUDA from workload shape.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 37 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {summaryPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
````

### File: `components/rust-book/pages/page-ch37-cuda-and-gpu-acceleration-exercises.tsx`
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
    title: "Choose CPU, Rayon, MPI, or CUDA from the workload",
    objective: "Practice selecting the execution model that matches the real bottleneck instead of treating acceleration tools as interchangeable.",
    starterPrompt:
      "Classify four workloads: a tiny request-local transform over one 4 KB buffer, a large one-node batch score over host memory, a multi-node domain-decomposed solver, and a dense batched tensor operation with high arithmetic intensity.",
    prompts: [
      "Which workload wants plain CPU execution because launch and transfer overhead would dominate?",
      "Which workload wants Rayon because the data already lives on one node and CPU saturation is the real need?",
      "Which workload wants MPI because the process boundary is already the dominant partition?",
      "Which workload wants CUDA because dense math can amortize the host-device boundary?",
    ],
    acceptanceCriteria: [
      "You choose at least one workload for CPU, one for Rayon, one for MPI, and one for CUDA.",
      "You justify each choice with workload shape rather than library familiarity.",
      "You mention at least one transfer or launch overhead argument in the CUDA case.",
    ],
    hints: [
      "Start with arithmetic intensity and batch size.",
      "Then ask whether the real boundary is local host memory, one CPU node, or a cluster process split.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Estimate host-device transfer cost for a matrix workload",
    objective: "Translate one matrix job into bytes on the bus before discussing kernels.",
    starterPrompt:
      "A service offloads one `f32` matrix multiply with `A(4096x4096)`, `B(4096x4096)`, and output `C(4096x4096)`, transferring all three buffers exactly once for the request.",
    prompts: [
      "How many bytes does one `4096 x 4096` `f32` matrix occupy?",
      "What is the total HtoD plus DtoH traffic if A and B go to the device and C comes back once?",
      "Why is this transfer budget less painful for GEMM than for tiny vector add?",
      "What extra cost remains even after the bytes are counted?",
    ],
    acceptanceCriteria: [
      "You compute or approximate the total traffic correctly at about 201,326,592 bytes, or about 192 MiB.",
      "You explain why dense high-intensity math amortizes the boundary better than tiny low-intensity work.",
      "You still mention launch or synchronization overhead as a separate cost category.",
    ],
    hints: [
      "A matrix has `rows * cols` elements, and each `f32` is 4 bytes.",
      "The point is not exact decimal formatting. The point is whether the workload can pay for the transfer.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Sketch a safe Rust wrapper around a CUDA kernel call",
    objective: "Build the host-side wrapper that validates shape and launch config before one small unsafe boundary.",
    starterPrompt:
      "Implement a small `build_config` and `validate_buffers` pair, then call one `unsafe fn raw_launch(...)` only after those checks succeed.",
    prompts: [
      "Keep the wrapper responsible for equal lengths and nonzero launch parameters.",
      "Return a Rust `Result` from the checked boundary.",
      "Keep the unsafe region smaller than the validation logic around it.",
      "Treat the device buffers as explicit owners rather than borrowed host slices.",
    ],
    acceptanceCriteria: [
      "The wrapper checks buffer shape before the unsafe call.",
      "The wrapper computes block count from length and threads per block.",
      "The wrapper returns a Rust `Result` rather than exposing a vague boolean or implicit failure.",
      "The runnable lab prints the expected blocks, threads, and success flag.",
    ],
    hints: [
      "This is the same repair pattern you already use around FFI and unsafe code elsewhere in the book.",
      "The GPU boundary is not special here. The invariants still belong in the safe wrapper.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair a tiny-kernel service path that lost to the CPU",
    objective: "Refactor a design that launches too often, copies too much, and synchronizes too eagerly.",
    starterPrompt:
      "A service currently copies one small vector to the device, launches one kernel, waits immediately, copies the result back, and repeats that whole cycle per request item.",
    prompts: [
      "Which fix should come first: batch work, fuse kernels, reuse device buffers, or keep the path on CPU?",
      "What signal would tell you the path is launch-bound rather than kernel-bound?",
      "When is the best repair to not use the GPU at all for this route?",
    ],
    acceptanceCriteria: [
      "You identify at least one batching or fusion repair and one CPU fallback condition.",
      "You explain the path in terms of transfer, launch, and synchronization overhead rather than only 'GPU is faster.'",
      "You mention at least one profiling signal such as launch count, queue wait, or transfer time.",
    ],
    hints: [
      "The simplest win is often fewer launches.",
      "The second simplest win is not offloading work that is too small to amortize the trip.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Profile a CUDA workload before rewriting the kernel",
    objective: "Separate transfer-bound, launch-bound, sync-bound, and kernel-bound cases clearly.",
    starterPrompt:
      "A profiling report says kernel time is 2 ms, host-device copies are 11 ms, queue wait is 6 ms, and total wall time is 24 ms for one batch scorer.",
    prompts: [
      "Which category dominates the first diagnosis?",
      "Which rewrite is probably premature because the report points elsewhere?",
      "What next measurement would you take inside the dominant category?",
      "How would you prove the fix improved the real path rather than only one micro-kernel number?",
    ],
    acceptanceCriteria: [
      "You identify transfer or admission cost, not kernel math, as the dominant issue.",
      "You reject at least one likely but wrong optimization target, such as low-level kernel tuning first.",
      "You propose one next measurement and one validation metric after the fix.",
    ],
    hints: [
      "If copies and queue wait dominate, shaving a few microseconds off kernel arithmetic is not the first win.",
      "Wall time should drive the next question first.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Integrate a GPU worker into an async and distributed service",
    objective: "Make queue budget, retry policy, and device ownership explicit when the GPU becomes a shared specialist subsystem.",
    starterPrompt:
      "You are designing `ingest -> parse -> score on GPU -> persist -> notify`, with bursty traffic, one device per host, and a requirement that duplicate replay stay harmless after crash recovery.",
    prompts: [
      "Where should the bounded GPU queue sit, and what does it own?",
      "When should the async side hand over owned data to the GPU worker?",
      "How will you separate transient GPU retry from terminal failure or CPU fallback?",
      "What metrics would you require before calling the system production-ready?",
    ],
    acceptanceCriteria: [
      "You define one explicit bounded GPU admission point.",
      "You move owned payloads across the async-to-GPU boundary rather than borrowed request-local views.",
      "You describe one idempotency or duplicate-safe completion rule for replay after crash or lease expiry.",
      "You mention at least three observability hooks such as queue age, transfer bytes, launch count, device saturation, or fallback rate.",
    ],
    hints: [
      "Treat the GPU like a scarce worker pool, not like a free helper thread.",
      "The cleanest design makes queueing, retries, and replay policy visible before the first incident.",
    ],
  },
]

const reviewQuestions = [
  "What kinds of workloads actually amortize host-device transfer and launch cost well?",
  "Why is a safe Rust wrapper around a kernel launch mostly an ownership and invariant story?",
  "What is the practical difference between host memory ownership and device memory ownership?",
  "Why are queue wait and launch count often more useful than one isolated kernel timing?",
  "When is CUDA the wrong choice even when a kernel itself is efficient?",
]

const workingLoop = [
  "Count bytes, launches, and sync points before tuning arithmetic.",
  "Keep host-side ownership explicit and device-side ownership modeled as a separate handle.",
  "Shrink the unsafe launch region until the invariants are obvious to a reviewer.",
  "Treat the GPU as a bounded specialist worker inside async or distributed systems.",
]

export function PageCh37CudaAndGpuAccelerationExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = 73
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 37 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice CUDA design the way it survives production review: explicit transfer budgeting, checked launch wrappers,
          and GPU admission policy that still makes sense inside a larger Rust system.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a throughput-and-boundary review. The best answer does not say only “GPU = fast.”
                It says how many bytes cross the boundary, what the launch invariants are, and which queue or retry budget
                keeps the device usable under real load.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(72)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 37
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
                  CUDA design drill
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
          title="Runnable lab · Safe launch wrapper"
          description={
            <>
              Repair the starter so the wrapper validates equal lengths, rejects zero-sized launches, computes block count
              from length and threads per block, and only then reports a successful launch.
            </>
          }
          filename="safe_launch_wrapper_lab.rs"
          runKey="ch37_ex_safe_kernel_wrapper"
          expectedOutput={"blocks = 8\nthreads = 128\nlaunch ok = true"}
          helperText={
            <>
              Tip: the block formula should be a ceiling division, not a plain truncating division. Keep the shape check in
              the safe wrapper and let the raw launch stay small.
            </>
          }
          initialCode={`#[derive(Debug, Clone, Copy)]
struct LaunchConfig {
    threads_per_block: u32,
    blocks: u32,
}

fn validate_buffers(a_len: usize, b_len: usize, out_len: usize) -> Result<(), &'static str> {
    Ok(())
}

fn build_config(a_len: usize, threads_per_block: u32) -> LaunchConfig {
    LaunchConfig {
        threads_per_block,
        blocks: 0,
    }
}

fn main() {
    let len = 1_024_usize;
    let threads_per_block = 128_u32;

    let launch_ok = validate_buffers(len, len, len).is_ok();
    let config = build_config(len, threads_per_block);

    println!("blocks = {}", config.blocks);
    println!("threads = {}", config.threads_per_block);
    println!("launch ok = {}", launch_ok);
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
            By the end of this page, you should be able to choose CPU, Rayon, MPI, or CUDA from workload shape, estimate
            host-device boundary cost before offload, wrap a kernel launch behind a checked Rust API, and reason about GPU
            admission and replay policy in the same operational language you use for the rest of the system.
          </p>
        </section>
      </div>
    </div>
  )
}
````

### File: `examples/ch37_cuda_and_gpu_acceleration/safe_kernel_launch_wrapper.rs`
````
#[derive(Debug, Clone, Copy)]
struct LaunchConfig {
    threads_per_block: u32,
    blocks: u32,
}

#[derive(Debug)]
struct DeviceBuffer {
    len: usize,
    bytes: usize,
}

impl DeviceBuffer {
    fn for_f32(len: usize) -> Self {
        Self {
            len,
            bytes: len * std::mem::size_of::<f32>(),
        }
    }
}

fn build_launch_config(len: usize, threads_per_block: u32) -> Result<LaunchConfig, &'static str> {
    if len == 0 {
        return Err("empty input");
    }

    if threads_per_block == 0 {
        return Err("threads_per_block must be > 0");
    }

    let blocks = ((len as u32) + threads_per_block - 1) / threads_per_block;

    Ok(LaunchConfig {
        threads_per_block,
        blocks,
    })
}

unsafe fn raw_launch_vec_add(
    config: LaunchConfig,
    a: &DeviceBuffer,
    b: &DeviceBuffer,
    out: &mut DeviceBuffer,
) -> Result<(), &'static str> {
    if a.len != b.len || a.len != out.len {
        return Err("shape mismatch");
    }

    if config.blocks == 0 || config.threads_per_block == 0 {
        return Err("invalid launch");
    }

    Ok(())
}

fn launch_vec_add(len: usize, threads_per_block: u32) -> Result<(LaunchConfig, usize), &'static str> {
    let config = build_launch_config(len, threads_per_block)?;
    let a = DeviceBuffer::for_f32(len);
    let b = DeviceBuffer::for_f32(len);
    let mut out = DeviceBuffer::for_f32(len);

    unsafe {
        // SAFETY:
        // - this wrapper creates all three device buffers with the same logical length.
        // - build_launch_config guarantees nonzero block and thread counts.
        // - the raw launch does not outlive these local buffers in this demo.
        raw_launch_vec_add(config, &a, &b, &mut out)?;
    }

    Ok((config, a.bytes + b.bytes + out.bytes))
}

fn main() {
    let (config, device_bytes) = launch_vec_add(4_096, 256).unwrap();

    println!("blocks = {}", config.blocks);
    println!("threads = {}", config.threads_per_block);
    println!("device bytes = {}", device_bytes);
}
````

### File: `examples/ch37_cuda_and_gpu_acceleration/transfer_budget_estimator.rs`
````
#[derive(Debug, Clone, Copy)]
struct Workload {
    elements: usize,
    flops_per_element: u64,
    input_buffers: usize,
    output_buffers: usize,
}

fn transfer_bytes(work: Workload) -> usize {
    work.elements * std::mem::size_of::<f32>() * (work.input_buffers + work.output_buffers)
}

fn arithmetic_intensity(work: Workload) -> f64 {
    work.flops_per_element as f64
        / (std::mem::size_of::<f32>() as f64 * (work.input_buffers + work.output_buffers) as f64)
}

fn should_use_gpu(work: Workload, launch_us: u64) -> bool {
    let bytes = transfer_bytes(work);
    let intensity = arithmetic_intensity(work);

    bytes >= 8_000_000 && intensity >= 4.0 && launch_us <= 50
}

fn main() {
    let work = Workload {
        elements: 1_000_000,
        flops_per_element: 64,
        input_buffers: 2,
        output_buffers: 1,
    };
    let launch_us = 25_u64;

    println!("transfer bytes = {}", transfer_bytes(work));
    println!("intensity = {:.2}", arithmetic_intensity(work));
    println!("gpu faster = {}", should_use_gpu(work, launch_us));
}
````

### File: `components/rust-book/pages/index.ts`
````diff
--- components/rust-book/pages/index.ts
+++ components/rust-book/pages/index.ts
@@ -69,4 +69,6 @@ export { PageCh34MemoryProfiling } from "./page-ch34-memory-profiling"
 export { PageCh34MemoryProfilingExercises } from "./page-ch34-memory-profiling-exercises"
 export { PageCh35PerformanceProfiling } from "./page-ch35-performance-profiling"
 export { PageCh35PerformanceProfilingExercises } from "./page-ch35-performance-profiling-exercises"
 export { PageCh36DistributedTasksProfiling } from "./page-ch36-distributed-tasks-profiling"
 export { PageCh36DistributedTasksProfilingExercises } from "./page-ch36-distributed-tasks-profiling-exercises"
+export { PageCh37CudaAndGpuAcceleration } from "./page-ch37-cuda-and-gpu-acceleration"
+export { PageCh37CudaAndGpuAccelerationExercises } from "./page-ch37-cuda-and-gpu-acceleration-exercises"
````

### File: `components/rust-book/index.tsx`
````diff
--- components/rust-book/index.tsx
+++ components/rust-book/index.tsx
@@ -81,6 +81,8 @@ import {
   PageCh34MemoryProfilingExercises,
   PageCh35PerformanceProfiling,
   PageCh35PerformanceProfilingExercises,
   PageCh36DistributedTasksProfiling,
   PageCh36DistributedTasksProfilingExercises,
+  PageCh37CudaAndGpuAcceleration,
+  PageCh37CudaAndGpuAccelerationExercises,
 } from "./pages"
 
 const PAGE_COMPONENTS = [
@@ -158,6 +160,8 @@ const PAGE_COMPONENTS = [
   PageCh34MemoryProfilingExercises,
   PageCh35PerformanceProfiling,
   PageCh35PerformanceProfilingExercises,
   PageCh36DistributedTasksProfiling,
   PageCh36DistributedTasksProfilingExercises,
+  PageCh37CudaAndGpuAcceleration,
+  PageCh37CudaAndGpuAccelerationExercises,
 ]
 
 function BookContent() {
````

### File: `components/rust-book/rust-simulator.ts`
````diff
--- components/rust-book/rust-simulator.ts
+++ components/rust-book/rust-simulator.ts
@@ -1,3 +1,4 @@
+import { simulateCh37Output } from "./rust-simulator-ch37"
 import { simulateCh36Output } from "./rust-simulator-ch36"
 import { simulateCh35Output } from "./rust-simulator-ch35"
 import { simulateCh34Output } from "./rust-simulator-ch34"
@@ -1014,6 +1015,9 @@ function findCompilationError(code: string, filename: string): string | null {
 export function simulateRustExecution(code: string, key?: string, filename = "main.rs"): string {
   const compilationError = findCompilationError(code, filename)
   if (compilationError) return compilationError
+
+  const ch37Output = simulateCh37Output(code, key)
+  if (ch37Output !== null) return ch37Output
 
   const ch36Output = simulateCh36Output(code, key)
   if (ch36Output !== null) return ch36Output
````

### File: `components/rust-book/types.ts`
````diff
--- components/rust-book/types.ts
+++ components/rust-book/types.ts
@@ -26,6 +26,7 @@ import { DEFAULT_CODES_CH33 } from "./default-codes-ch33"
 import { DEFAULT_CODES_CH34 } from "./default-codes-ch34"
 import { DEFAULT_CODES_CH35 } from "./default-codes-ch35"
 import { DEFAULT_CODES_CH36 } from "./default-codes-ch36"
+import { DEFAULT_CODES_CH37 } from "./default-codes-ch37"
 
 export interface PageConfig {
   id: string
@@ -912,6 +913,28 @@ export const CHAPTERS: ChapterConfig[] = [
         description:
           "Design saturation metrics, trace tail-latency incidents, identify retry storms, and capacity-plan distributed workers",
         icon: "trophy",
+      },
+    ],
+  },
+  {
+    id: "ch37-cuda-and-gpu-acceleration",
+    title: "Chapter 37 · CUDA and GPU Acceleration",
+    icon: "book",
+    pages: [
+      {
+        id: "ch37-cuda-and-gpu-acceleration",
+        title: "CUDA and GPU Acceleration",
+        shortTitle: "CUDA and GPU",
+        description:
+          "When GPU acceleration pays, Rust and CUDA integration shapes, safe kernel launch wrappers, device-memory ownership, transfer and launch overhead, profiling, abstractions, and async or distributed integration",
+        icon: "book",
+        codeKeys: ["cuda_gpu_kernel_launch_wrapper", "cuda_gpu_transfer_budget"],
+      },
+      {
+        id: "ch37-cuda-and-gpu-acceleration-exercises",
+        title: "Chapter 37 Exercises",
+        shortTitle: "Exercises",
+        description:
+          "Estimate transfer cost, sketch a safe kernel wrapper, and choose CPU, Rayon, MPI, or CUDA from workload shape",
+        icon: "trophy",
       },
     ],
   },
@@ -1366,5 +1389,6 @@ export const DEFAULT_CODES: Record<string, string> = {
   ...DEFAULT_CODES_CH34,
   ...DEFAULT_CODES_CH35,
   ...DEFAULT_CODES_CH36,
+  ...DEFAULT_CODES_CH37,
 }
 
 export interface BookState {
````