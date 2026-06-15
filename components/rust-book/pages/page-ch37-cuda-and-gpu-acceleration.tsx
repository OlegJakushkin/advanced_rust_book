"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Layers, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
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
    body: "You probably already know CUDA from C++ host code, so the kernels and the driver API will look familiar. The shift is that in C++ the host-side contract — buffer length, device residency, launch shape — lives in comments and team convention. In Rust you push that contract into types and a small checked function, and the GPU itself is the part that stays the same.",
  },
  {
    title: "C# background",
    body: "Stop thinking in terms of a managed runtime marshalling arrays for you. A device buffer is not a GC-tracked array that happens to live on a card; it is a separate memory domain with its own allocation, copy, and free. Rust makes that ownership explicit, which is closer to how the hardware actually behaves than a managed abstraction would suggest.",
  },
  {
    title: "Go background",
    body: "A GPU is not another goroutine destination. Goroutines are cheap and you fan out freely; a device is one scarce piece of hardware sitting behind a transfer bus and a launch queue. The honest Rust design is a bounded worker lane with admission control and a CPU fallback, not an unbounded go func that fires kernels.",
  },
  {
    title: "Python background",
    body: "In Python the GPU usually hides behind PyTorch, CuPy, or a kernel a framework launched for you, so device memory and copies feel invisible. In Rust you are often the layer that owns those copies and launches. The trap is assuming the boundary is free the way a one-line .cuda() call makes it look; here you account for the transfer and the launch yourself.",
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

fn checked_launch(
    cfg: LaunchConfig,
    input: &DeviceBuffer,
    output: &mut DeviceBuffer,
) -> Result<(), LaunchError> {
    validate_lengths(cfg, input, output)?;
    unsafe { raw_launch(cfg, input, output) }
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
          A GPU is a throughput machine guarded by an expensive boundary. The kernel does not run until you have paid to
          move data across the bus, configured a launch, and synchronized the result back. This chapter is about owning
          that boundary from Rust honestly: when the accelerator actually pays for itself, how to wrap a kernel launch so
          its invariants are checked instead of assumed, and how to run a GPU as a bounded resource inside a real service.
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
            A batch-scoring service already runs on the CPU and meets its latency target most of the time. Under load it
            starts to fall behind, and someone proposes adding a GPU-backed execution lane beside the existing CPU path.
            The card is approved on the assumption that &ldquo;the GPU is faster.&rdquo; That assumption is the thing this
            chapter refuses to take on faith.
          </p>
          <p className="mt-3 text-sm text-muted-foreground leading-6">
            The real requirement is to prove the accelerator boundary pays for itself before it ships. That means
            measuring the whole round trip, not just the kernel: how long requests wait in the queue, how many bytes cross
            to the device and back, what each launch costs, how long the kernel actually runs, where the host blocks on a
            synchronize, and what happens when the device is busy or out of memory. A kernel that is individually fast can
            still produce a feature that is slower and less reliable than the CPU path it replaced. The Rust code in this
            chapter is built to make every one of those costs visible instead of hidden behind a convenient wrapper.
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

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">The shape of a GPU offload</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Before any of the details, fix the overall shape in your head. A request arrives on the host, where ordinary
            Rust owns the data. To use the GPU you copy that data across the bus into device memory, launch a kernel,
            wait for it, then copy the result back. Each arrow in the picture below is a cost the kernel itself does not
            pay for: the host-to-device copy, the launch, the synchronize, and the device-to-host copy. The kernel is the
            one box in the middle that does arithmetic; everything around it is boundary tax. When people say the GPU
            &ldquo;won&rdquo; they usually mean the middle box shrank, while the surrounding arrows are what actually
            decide whether the feature is faster end to end.
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Req[Request on host] --> HostBuf[Host buffer: owned Vec]\n  HostBuf -->|copy H2D| DevIn[(Device input)]\n  DevIn -->|launch + sync| Kernel[GPU kernel: the only arithmetic]\n  Kernel --> DevOut[(Device output)]\n  DevOut -->|copy D2H| Result[Host result]\n  Result --> Resp[Response]`}
            caption="The kernel is one box; the copies, the launch, and the synchronize are the boundary tax around it."
          />
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Mental model</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Three ideas carry most of the weight in this chapter. The GPU is a throughput device, not a latency device,
            so it only repays you when the work is big and regular enough to amortize that boundary. Rust&apos;s job is
            rarely to write the kernel; it is to keep the host side of the boundary honest, so ownership, lengths, and
            lifetimes are stated before any unsafe launch runs. And the decision to accelerate is a systems decision, not
            a math one: a perfect kernel sitting behind bad queueing or too many tiny launches still produces a slow
            service.
          </p>
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
            <p className="text-sm text-muted-foreground leading-6">
              The single number that predicts whether a GPU helps is <em>arithmetic intensity</em>: how much math you do
              per byte you move across the bus. A workload that does a great deal of computation on a small amount of data
              can hide the transfer cost behind the kernel and win comfortably. A workload that touches each byte once and
              then ships it back spends most of its time on the bus, and the GPU rarely beats a tuned CPU loop there. The
              cards below are really four facets of the same question: is there enough regular, dense, batched work to make
              the boundary worth crossing?
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {whenGpuCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground leading-6">
              CUDA is one option on a spectrum, not the default destination for anything slow. Before reaching for the
              device, place the work on this ladder of escalating mechanisms. Most service code never needs to climb past
              the first two rungs, and the right answer is frequently &ldquo;a CPU path that does the same logical work,
              measured honestly&rdquo; rather than any accelerator at all.
            </p>
            <div className="mt-3 grid gap-3 lg:grid-cols-4">
              {choiceRows.map((row) => (
                <div key={row.title} className="rounded-lg border border-border bg-card p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">{row.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{row.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">How Rust reaches the GPU</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Rust does not have a single blessed CUDA story, and that is fine, because the choice is mostly about where
              your team wants the boundary to sit rather than which crate is fashionable. There are three broad shapes,
              and they differ in how much of the device you are choosing to own directly.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
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
            <p className="text-sm text-muted-foreground leading-6">
              Whatever FFI or wrapper layer you pick, the safe call shape is the same and it is worth memorizing. There is
              one public, safe function the rest of the service calls, and one tiny private <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">unsafe</code> function
              that does the actual launch. The safe function&apos;s only job is to check the invariants the unsafe launch
              depends on — buffer lengths, shapes, launch configuration — and only then enter the unsafe region. Look at
              how <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">checked_launch</code> calls <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">validate_lengths</code> first
              and treats a validation failure as a normal <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Result</code> error: the unsafe
              block is never reached unless the preconditions already hold. That gate is the whole pattern.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Caller[Service code] --> Checked[checked_launch: safe]\n  Checked --> Validate{validate lengths and config}\n  Validate -->|invalid| Err[Return LaunchError]\n  Validate -->|valid| Unsafe[unsafe raw_launch]\n  Unsafe --> Driver[Driver / FFI launch]\n  Driver --> Ok[Return Ok]`}
              caption="One safe gate validates every precondition; the unsafe launch is only reachable once the checks pass."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{callBoundarySnippet}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  This is one of the cleanest places for Rust to earn its keep. In C++ host code the buffer shape and
                  launch invariants usually live in convention and review comments, so a mismatched length is a silent
                  corruption waiting to happen. The Rust version makes those checks routine and impossible to skip,
                  without ever pretending the device call itself is safe by default — the <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">unsafe</code> keyword
                  still marks exactly where the responsibility shifts from the compiler to you.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">GPU memory ownership</h4>
            <p className="text-sm text-muted-foreground leading-6">
              The most common mental-model mistake is to treat device memory as if it were just host memory with a faster
              processor attached. It is not. Host memory and device memory are two separate domains with separate
              allocators, and a pointer into one is meaningless in the other. A <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec&lt;T&gt;</code> on
              the host describes a host layout and nothing more; getting that data to the device is an explicit copy that
              allocates a separate device buffer with its own lifetime. Model that device buffer as its own owner handle —
              something that allocates on construction and frees on drop — so the residency on the card is tied to a Rust
              value the host controls. The diagram shows the two domains and the only legal way to move between them.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph Host[Host memory domain]\n    Vec[Vec or slice: owned by Rust]\n  end\n  subgraph Device[Device memory domain]\n    Buf[DeviceBuffer: owns residency]\n  end\n  Vec -->|copy_to_device| Buf\n  Buf -->|copy_to_host| Vec\n  Buf -->|drop frees device memory| Freed[Released]`}
              caption="Two separate domains. A host owner and a device owner; copies cross between them and drop frees the device side."
            />
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
            <p className="text-sm text-muted-foreground leading-6">
              Two fixed costs sit between you and the kernel, and both are easy to forget because neither shows up in a
              kernel-only profile. The first is the copy across the bus, paid in both directions: every input you move to
              the device and every result you move back is bytes on the wire. For small vector-shaped operations this copy
              alone can dwarf the kernel. The second is the launch itself, which carries real per-call overhead in the
              driver. A service that launches one tiny kernel per request often loses to a plain CPU loop even when each
              individual launch is efficient, simply because it pays the launch tax hundreds of times. The way out is
              usually fewer, bigger launches and keeping intermediate data resident on the device instead of round-tripping
              it.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
            <p className="text-sm text-muted-foreground leading-6">
              The classic GPU demo is a vector add, and it is a misleading one. Vector add reads two arrays, adds them, and
              writes a third: one arithmetic operation per several bytes moved, which makes it memory-bandwidth-limited and
              acutely transfer-sensitive. It is a fine way to learn the boundary, but a poor argument that offloading pays.
              Dense matrix multiply is the opposite case. Multiplying two N-by-N matrices moves on the order of N-squared
              bytes but does on the order of N-cubed arithmetic, so the math grows faster than the data and the transfer
              cost gets buried under real work. That is why GEMM, batched GEMM, convolutions, and large reductions are
              where the GPU earns its reputation, while tiny elementwise transforms often do not.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
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
            <p className="text-sm text-muted-foreground leading-6">
              The point of profiling here is to refuse to call the whole feature &ldquo;GPU work&rdquo; and instead break
              the wall-clock time into named stages. A request spends time waiting in the queue, copying host-to-device,
              launching and running the kernel, synchronizing, and copying device-to-host. Each stage points at a different
              fix: a queue-bound path needs admission and capacity changes, a transfer-bound path needs bigger batches or
              pinned memory, a launch-bound path needs fewer launches, and only a kernel-bound path is improved by tuning
              occupancy or registers. The timeline below is the question every profile should answer.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Q[Queue wait] --> H2D[H2D copy]\n  H2D --> K[Kernel run]\n  K --> Sync[Synchronize]\n  Sync --> D2H[D2H copy]\n  D2H --> Done[Result ready]`}
              caption="Attribute wall-clock time to each stage. The widest stage, not the kernel, names your real bottleneck."
            />
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
            <p className="text-sm text-muted-foreground leading-6">
              Good GPU code tends to layer into three levels, and the most common design mistake is exposing the wrong one
              to the rest of the system. At the bottom is a narrow safe wrapper around a single launch. In the middle are
              the handles that make reuse and admission explicit — a device buffer, a stream, a job queue. At the top is a
              domain API. The rest of your service should almost never see <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">launch_kernel</code>;
              it should see <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">score_batch</code> or <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">run_inference</code>.
              Kernel names are an implementation detail, and leaking them upward couples your business logic to the device.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
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
            <p className="text-sm text-muted-foreground leading-6">
              Once a GPU lives inside an async service, treat it the way you would treat any scarce shared resource: as one
              worker behind a bounded queue, not as an open destination for fan-out. Async tasks can generate work far
              faster than a single device can absorb it, so the queue is where you decide who waits, when work spills to a
              CPU fallback, and when overload becomes visible to operators. Two further rules keep the integration honest.
              Own your input data before you hand it to a task, because borrowed request-local buffers cannot safely back a
              job that outlives the request. And never serialize a raw device pointer across a process boundary — device
              residency does not survive the trip, so ship owned data envelopes and rebuild device buffers at the worker.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {integrationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <h4 className="font-semibold text-foreground mb-3">How this lands depending on where you came from</h4>
            <p className="text-sm text-muted-foreground leading-6">
              The GPU hardware is the same regardless of your background; what differs is the habit you bring to its
              boundary. Each of these is a mental-model shift rather than an API mapping — the trap that the language you
              know best sets for you when you reach for a device.
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {comparisonCallouts.map((comparison) => (
                <div key={comparison.title} className="rounded-lg border border-border bg-card p-4">
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
            These are the habits that keep a GPU lane healthy once it is more than a benchmark. They share a theme: state
            the budget and the ownership before the device ever runs, and measure the whole path afterward, so the
            accelerator stays a deliberate decision rather than an assumption.
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
            Almost every failure mode below is a systems mistake wearing a performance costume. The kernel is rarely the
            problem; the trouble is what surrounds it — too many small launches, too much copying, a borrowed buffer that
            outlived its request, or one shared device with no admission control.
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
                The most common CUDA mistake in service code is not a wrong kernel intrinsic. It is a wrong systems model:
                too many tiny launches, too much copying, or too little admission control around one scarce device.
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
                <h4 className="font-semibold text-foreground">Example 1: a safe Rust wrapper around a kernel launch</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  This is the safe-gate pattern from earlier, made runnable. Read it in the order of the flow diagram
                  above: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">launch_vec_add</code> calls <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">build_launch_config</code> first
                  (which rejects empty input and zero thread counts), allocates the three <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">DeviceBuffer</code> owners,
                  and only then enters the <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">unsafe</code> block. Notice the SAFETY comment that
                  states the invariants the raw launch relies on. The unsafe region is a handful of lines; everything that
                  could go wrong has been checked before it.
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
                  The first GPU decision is a budgeting question, and this code makes it an explicit one. The function to
                  watch is <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">should_use_gpu</code>: it does
                  not offload just because the work exists, it requires three conditions to hold at once — enough transfer
                  bytes, high enough arithmetic intensity, and low enough launch overhead. The diagram traces that gate; if
                  any branch fails, the honest answer is to stay on the CPU.
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
            <MermaidDiagram
              chart={`flowchart TD\n  Start[Workload] --> Bytes{enough transfer bytes}\n  Bytes -->|no| Cpu[Stay on CPU]\n  Bytes -->|yes| Intensity{high enough intensity}\n  Intensity -->|no| Cpu\n  Intensity -->|yes| Launch{launch overhead low}\n  Launch -->|no| Cpu\n  Launch -->|yes| Gpu[Offload to GPU]`}
              caption="should_use_gpu offloads only when all three thresholds pass; any single failure routes back to the CPU."
            />
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
