"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Bug,
  Cpu,
  Gauge,
  Layers,
  Network,
  Shield,
  TriangleAlert,
  Wrench,
} from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "ONNX is a portable graph, not a library you depend on",
    body: "An .onnx file is a frozen computation graph: a list of operators, their connections, the learned weights, and the names and shapes of the inputs and outputs. It says nothing about which framework trained it or which runtime will execute it. That is the whole point. Once a model is exported to ONNX, the question shifts from 'which deep-learning library do I link against' to 'which runtime do I feed this graph to,' and Rust gives you more than one answer.",
  },
  {
    title: "Inference is a pure function with a heavy table of constants",
    body: "Strip away the tooling and a forward pass is arithmetic: matrix multiplies, bias adds, activations, and a final reduction such as argmax or softmax. The weights are just a large, fixed lookup table baked into the graph. The runnable listings in this chapter make that concrete by hand-coding one dense layer, because the shape of the work is identical whether the numbers come from a 4-by-3 array or a 400-million-parameter transformer.",
  },
  {
    title: "The hard part is the boundary code, not the matmul",
    body: "The runtime owns the math. What you own is everything around it: turning bytes, text, or pixels into a tensor of exactly the right shape and dtype, naming inputs to match the graph, and turning raw output tensors back into a decision your domain understands. Most inference bugs in production are shape mismatches, dtype surprises, and pre/post-processing drift, not the model being wrong.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You have probably linked the ONNX Runtime C++ API directly: create an Ort::Env, build a Session from a path, bind Ort::Value tensors by name, and call Run. Rust's ort crate is a safe wrapper over that same C/C++ runtime, so the mental model carries over almost intact, including execution providers and session options. The shift is ownership: instead of remembering to release values and watching for use-after-free across the FFI boundary, the Rust types tie tensor lifetimes to scopes, and a borrow that outlives its buffer becomes a compile error rather than a crash in someone else's datacenter.",
  },
  {
    title: "C# background",
    body: "Microsoft.ML.OnnxRuntime gives you InferenceSession, NamedOnnxValue, and a tidy Run that returns disposable results, with the GC quietly cleaning up tensors. Rust keeps the same session-and-named-tensor shape but removes the ambient cleanup: you decide when a tensor is built, when its backing buffer is freed, and you pre-allocate output buffers deliberately when latency matters. The payoff is a single self-contained binary with no managed runtime to install on the target box.",
  },
  {
    title: "Python background",
    body: "In Python you usually train in PyTorch or TensorFlow, call torch.onnx.export, and then run with onnxruntime's InferenceSession, leaning on NumPy for the tensor plumbing. Rust splits those roles cleanly: training and export stay in Python, while serving moves to a compiled binary. ndarray plays the role NumPy did for shaping inputs, but there is no dynamic typing to absorb a wrong shape, so the contract the model expects becomes something the type system and explicit shape checks enforce rather than something you discover at the first request.",
  },
  {
    title: "Go background",
    body: "Go has no first-party ONNX story; the common path is onnxruntime_go, a cgo binding to the same C runtime, which means you accept a C toolchain dependency and cgo's build and cross-compile constraints. Rust's ort sits in the same FFI-binding category, but Rust also offers tract, a pure-Rust runtime with no C dependency at all. So the Go instinct of 'wrap the C library and live with cgo' has a genuine alternative here: you can choose a build with nothing but Rust in it.",
  },
]

const fundamentals = [
  {
    title: "The graph format",
    body: "ONNX standardizes the operators (Gemm, Conv, Relu, Softmax, and the rest) and the way a model declares its inputs and outputs by name, shape, and element type. A model is a directed graph of these operators plus an initializer table holding the trained weights. Because the format is an open standard, the same file runs under ONNX Runtime, tract, or a browser runtime without re-exporting, which is exactly why teams pick it as the handoff point between training and serving.",
  },
  {
    title: "Sessions",
    body: "A session is the loaded, optimized, ready-to-run form of a graph. Building one parses the file, runs graph optimizations, picks execution providers, and allocates what it needs; it is the expensive step. Running is cheap by comparison. The operational rule that follows is simple: build the session once at startup, keep it alive, and run it many times. Treating session construction as per-request work is the most common way to make inference look slow.",
  },
  {
    title: "Tensors and shapes",
    body: "Every input and output is a tensor: a flat buffer plus a shape and a dtype. The graph names each one and fixes its rank, and often its dimensions, sometimes leaving a batch axis dynamic. Feeding a tensor whose shape or dtype does not match the graph is the single most frequent inference error. The discipline is to know the exact expected shape, build the buffer in the matching memory layout, and check rather than assume.",
  },
]

const ortVsTractCards = [
  {
    title: "ort: FFI to ONNX Runtime",
    body: "The ort crate is a safe, idiomatic binding over Microsoft's ONNX Runtime, the same C/C++ engine used from Python and C#. You get the full operator coverage, the mature graph optimizer, and hardware acceleration through execution providers such as CUDA and TensorRT. The cost is a native dependency: the runtime library has to be present or bundled, and the build links against C code, which complicates fully static or cross-compiled targets.",
  },
  {
    title: "tract: pure Rust",
    body: "tract is a from-scratch inference engine written entirely in Rust. There is no C runtime to ship, the build is plain cargo, and cross-compilation and static linking behave like any other Rust crate, which is a strong fit for embedded and locked-down environments. The tradeoff is coverage and acceleration: operator support is narrower than ONNX Runtime's and there is no first-party GPU execution provider, so it shines on CPU and on models built from common operators.",
  },
  {
    title: "How to choose",
    body: "Pick ort when you need broad operator coverage or GPU acceleration and can accept a native dependency in your build and deploy story. Pick tract when a clean pure-Rust build, easy cross-compilation, or a tiny dependency surface matters more than raw operator breadth, and your model and latency targets fit CPU execution. The choice is a deployment decision as much as a performance one, so make it early.",
  },
]

const executionProviderCards = [
  {
    title: "CPU",
    body: "The default provider runs everywhere and needs no extra setup, which makes it the right baseline and often the right answer for small models or moderate throughput. Both ort and tract run well on CPU. Measure here first; many services never need anything else, and CPU keeps the binary simple to ship.",
  },
  {
    title: "CUDA",
    body: "With ort you can register the CUDA execution provider to offload supported operators to an NVIDIA GPU, which is the usual lever for large models or high request rates. It adds real deployment weight: a matching CUDA toolkit and drivers on the host, larger images, and a fallback path for operators the provider does not cover. It pays off when the model is genuinely GPU-bound, not as a reflex.",
  },
  {
    title: "TensorRT",
    body: "TensorRT goes a step further by compiling and fusing the graph into a heavily optimized engine for a specific GPU, trading longer first-time build cost for the lowest steady-state latency. It is the choice when you are squeezing a hot path on known hardware. The constraints are the same family as CUDA, only stricter: it is the most hardware-specific and the least portable option, so reserve it for the cases that earn it.",
  },
]

const preprocessingCards = [
  {
    title: "Pre-processing owns the input contract",
    body: "Before the session runs, raw data has to become a tensor of the exact shape, dtype, and value range the graph expects: text tokenized to ids, an image resized and normalized, features ordered the way training ordered them. This code owns a contract, and when it drifts from how the model was trained the model still runs and quietly returns nonsense. Keep it in one place, give it owned input data, and test it independently of the session.",
  },
  {
    title: "Post-processing owns the meaning",
    body: "The session returns raw numbers: logits, embeddings, or boxes. Turning those into a class label, a probability, or a domain decision is your job, and it is where argmax, softmax, thresholds, and label maps live. Treat the output tensor as untrusted shape until you have checked its rank and length, then map it to a domain type rather than passing raw floats deeper into the system.",
  },
  {
    title: "Ownership at the boundary",
    body: "Tensors borrow their backing buffers, so a tensor must not outlive the Vec or array it views. The calm pattern is to build owned input buffers, hand the session a tensor that borrows them for the duration of the call, copy or map the outputs into owned domain values, and let the scratch buffers drop. That keeps the unsafe-feeling part, raw buffers crossing into a runtime, contained and checked by the borrow checker.",
  },
]

const deploymentCards = [
  {
    title: "One binary, no Python runtime",
    body: "The headline reason teams move serving to Rust is operational: a compiled binary that embeds or links the runtime, with no interpreter, no virtualenv, and no package resolution at deploy time. The unit you ship is an executable plus, depending on the crate, a model file and maybe a runtime library, which is dramatically simpler to containerize and to reason about than a Python serving stack.",
  },
  {
    title: "Binary size is a real axis",
    body: "The runtime choice shows up directly in artifact size and image weight. tract keeps everything in the Rust binary with no external runtime, which tends to be smaller and self-contained. ort links the ONNX Runtime library, which is heavier and may need to travel alongside the binary, especially once GPU providers are involved. Decide what you are optimizing, startup, size, or operator coverage, before you choose.",
  },
  {
    title: "Embed or load the model",
    body: "The graph itself can be loaded from a path at startup or embedded into the binary with include_bytes!, trading a larger executable for a single self-contained artifact with no file to misplace. Loading from a path keeps the binary small and lets you swap models without rebuilding. Either way, build the session once during startup and treat the loaded model as a long-lived, shared resource.",
  },
]

const productionPatterns = [
  "Build the session once at startup and share it; never construct a session per request.",
  "Pin the input contract explicitly: known names, ranks, shapes, and dtypes, checked rather than assumed.",
  "Keep pre-processing and post-processing in their own tested functions that take and return owned domain types.",
  "Treat output tensors as untrusted shape until rank and length are verified, then map to a domain type.",
  "Choose ort versus tract as a deployment decision early, and record why, since it drives build, image size, and acceleration.",
  "Batch when the workload allows it: one session run over N rows usually beats N runs of one row.",
]

const pitfalls = [
  "Rebuilding the session on every request because construction looked like ordinary setup. It is the expensive step and belongs at startup.",
  "Feeding a tensor with the wrong shape or dtype. The runtime may error, or worse, accept it and return numbers that look plausible.",
  "Letting a tensor borrow a buffer that drops before the run completes, or fighting that with needless clones instead of scoping the buffer correctly.",
  "Assuming GPU is faster by default. A small CPU-bound model can lose to a GPU once host transfer and provider fallback are counted.",
  "Pre/post-processing drifting from how the model was trained, so the model runs cleanly and returns confident nonsense.",
  "Reaching for ort and its native dependency when tract on CPU would have shipped a smaller, simpler, fully-static binary.",
]

const sessionSketchSnippet = `// Real ort usage (not runnable in the browser sandbox):
use ort::{GraphOptimizationLevel, Session};

// Built once at startup, then shared and reused for every request.
let session = Session::builder()?
    .with_optimization_level(GraphOptimizationLevel::Level3)?
    .with_intra_threads(4)?
    .commit_from_file("classifier.onnx")?;

// Inputs and outputs are addressed by the names baked into the graph.
let outputs = session.run(ort::inputs!["input" => input_tensor]?)?;
let logits = outputs["logits"].try_extract_tensor::<f32>()?;`

const summaryPoints = [
  "ONNX is a portable, runtime-agnostic graph format: the handoff point between training in Python and serving in a compiled binary.",
  "Rust offers two runtimes with different tradeoffs: ort binds the native ONNX Runtime for coverage and GPU; tract is pure Rust for clean builds and small artifacts.",
  "A session is the expensive, build-once resource; running it is cheap, so construct it at startup and reuse it.",
  "Tensors are buffer plus shape plus dtype, addressed by name; shape and dtype mismatches are the dominant source of inference bugs.",
  "Execution providers (CPU, CUDA, TensorRT) are a deployment-versus-latency tradeoff, not a free speedup.",
  "You own the edges: pre-processing into the input contract and post-processing into domain meaning, with tensor lifetimes scoped by the borrow checker.",
]

export function PageCh54OnnxRuntimeModelInference() {
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
  const pageIndex = getPageIndexById("ch54-onnx-runtime-model-inference")
  const nextChapterPageIndex = getPageIndexById("ch55-smart-contracts-solana-sei")
  const exercisesPageIndex = getPageIndexById("ch54-onnx-runtime-model-inference-exercises")
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
          Chapter 54 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          A trained model is a frozen graph of arithmetic. This chapter is about running that graph from Rust: loading an
          ONNX file into a session, feeding it correctly shaped tensors, reading the result, and choosing between the
          native-runtime and pure-Rust paths. The math is the easy part; the contract at the edges is where the work is.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A team has trained a classifier in Python and wants to serve it inside an existing Rust service: no separate
            Python process, no model server to operate, just one binary that loads the model at startup and answers
            requests. The model has been exported to ONNX. The job now is to load it once, turn each request into a tensor
            of the exact shape the graph expects, run a forward pass, and turn the output back into a labeled decision.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Choose the runtime first: ort for coverage and GPU, tract for a clean pure-Rust build.</li>
              <li>Build the session once at startup and keep it alive for the life of the process.</li>
              <li>Pin the input contract: exact names, shapes, and dtypes, checked rather than assumed.</li>
              <li>Keep pre- and post-processing in tested functions that move owned data across the boundary.</li>
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
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            The shape worth memorizing is a three-stage pipeline with the session in the middle. Raw input becomes a
            tensor, the session turns that tensor into output tensors, and post-processing turns those into a domain
            decision. The runtime owns only the middle box; the two ends are ordinary Rust code that you write, own, and
            test.
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Raw[Raw input bytes or features] -->|pre-process| T1[Input tensor: shape + dtype]\n  T1 -->|session.run| T2[Output tensors: logits]\n  T2 -->|post-process: argmax| Dec[Domain decision: class + score]\n  subgraph Runtime[ort or tract owns this]\n    T1 --> T2\n  end`}
            caption="The runtime owns only the forward pass. Pre-processing into the input contract and post-processing into a decision are code you own."
          />
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">ONNX as a portable graph format</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {fundamentals.map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{item.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{item.body}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              The file is the contract. A producer trains in any framework and exports to ONNX; a consumer loads that one
              file into whichever runtime fits its deployment. Because operators and tensor declarations are standardized,
              the same graph runs unchanged across runtimes, which is what lets training and serving live in different
              languages without a fragile re-export step in between.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  PT[PyTorch / TensorFlow] -->|export| ONNX[(model.onnx: ops + weights + IO names)]\n  ONNX -->|load| ORT[ort: native ONNX Runtime]\n  ONNX -->|load| TRACT[tract: pure Rust]\n  ORT --> Serve1[Rust service]\n  TRACT --> Serve2[Rust service]`}
              caption="One exported graph, many runtimes. The .onnx file is the stable handoff between training and serving."
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">The ort versus tract tradeoff</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {ortVsTractCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The decision is rarely about raw speed on one model. It is about what your build and deploy story can
                accept: a native runtime dependency and GPU access, or a single pure-Rust binary that cross-compiles
                cleanly. Decide it early, because it shapes everything downstream from image size to which operators your
                model is allowed to use.
              </p>
            </div>
            <MermaidDiagram
              chart={`flowchart TD\n  Q1{Need GPU or broad operator coverage?}\n  Q1 -->|yes| ORT[ort: native ONNX Runtime]\n  Q1 -->|no| Q2{Need static build or easy cross-compile?}\n  Q2 -->|yes| TRACT[tract: pure Rust]\n  Q2 -->|no| Either[Either works; measure on your model]`}
              caption="A starting heuristic. GPU and operator breadth pull toward ort; clean static builds pull toward tract."
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Sessions: build once, run many</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Loading a model is the expensive step. Building a session parses the file, optimizes the graph, selects
              execution providers, and allocates working memory. Running the session afterward is comparatively cheap. The
              operational consequence is the most important habit in this chapter: construct the session at startup, store
              it as a long-lived shared resource, and run it per request. The real ort call below is what that startup step
              looks like; the runnable listing further down stands in for the per-request run.
            </p>
            <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{sessionSketchSnippet}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Input and output tensors with ndarray</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A tensor is a flat buffer plus a shape and a dtype. In Rust the usual way to build one is with the{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">ndarray</code> crate, which plays the
              role NumPy plays in Python: it owns the buffer and tracks the shape so the runtime can interpret the bytes
              correctly. The graph names each input and output and fixes its rank, so the data you build must match{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">{"[batch, features]"}</code> exactly,
              including element type. A buffer that is the right length but the wrong shape is a different tensor as far as
              the model is concerned.
            </p>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                The most common inference bug is not a wrong model. It is a tensor whose shape or dtype does not match the
                graph, which either errors at runtime or, worse, runs and returns confident nonsense.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-foreground">Execution providers: CPU, CUDA, TensorRT</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              An execution provider decides where the operators actually run. With ort you can register providers in
              priority order, and the runtime assigns each operator to the first provider that supports it, falling back to
              CPU for the rest. This is a deployment and latency tradeoff, not a free speedup: each step up the ladder buys
              throughput at the cost of heavier dependencies and tighter hardware assumptions.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {executionProviderCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Pre- and post-processing ownership</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {preprocessingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              Tensors borrow their backing buffers, so the borrow checker is doing real work here: a tensor that views a{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">{"Vec<f32>"}</code> must not outlive
              that buffer. The calm pattern is to build owned inputs, hand the session a tensor that borrows them for the
              run, copy or map the outputs into owned domain values, and let the scratch buffers drop at the end of the
              scope.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Deployment: binary size and no Python runtime</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {deploymentCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
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
            Almost everyone arrives at ONNX inference with a runtime they already know from another ecosystem. The useful
            thing is to see which part of that knowledge transfers cleanly and which part Rust changes. The session and
            named-tensor shape is shared across all of these; what shifts is who owns tensor lifetimes and how the model
            gets deployed.
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
                The runtime makes the math correct. It does nothing to make your shapes, dtypes, and label maps correct.
                Those stay your responsibility, and they are where inference quietly goes wrong.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Examples</h3>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The in-browser runner cannot link ONNX Runtime, so both listings are deterministic pure-Rust forward passes
              over one dense layer: a matmul against a fixed weight matrix, a bias add, then argmax. That is exactly the
              arithmetic a one-layer ONNX model performs, so the shapes, the logits, and the predicted class are the same
              numbers a real session would return for these weights. Read each one as the body of the per-request run that
              would otherwise call <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">session.run</code>.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 1: load-and-run a one-layer classifier</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  One input vector flows through a dense layer and an argmax, mirroring a forward pass through a one-layer
                  ONNX graph and printing the predicted class and its score.
                </p>
              </div>
              {codes.onnx_session_load_run !== DEFAULT_CODES.onnx_session_load_run && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("onnx_session_load_run")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at:{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">forward</code> is the matmul plus
              bias add that a single <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Gemm</code>{" "}
              operator would run inside the graph, and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">argmax</code> is the post-processing you
              own. Trace one input through the diagram below, then read the same path in code: four input features, three
              output logits, and the largest logit chosen as the class.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  In[input: 4 features] -->|matmul WEIGHTS| MM[3 weighted sums]\n  MM -->|+ BIAS| Logits[logits: 3 values]\n  Logits -->|argmax| Class[predicted class + score]`}
              caption="A four-feature input becomes three logits via matmul and bias, and argmax picks the winning class. This is one dense layer of an ONNX graph."
            />
            <RustCodeEditor
              code={codes.onnx_session_load_run}
              onChange={(newCode) => updateCode("onnx_session_load_run", newCode)}
              onRun={() => runCode("onnx_session_load_run")}
              output={outputs.onnx_session_load_run ?? null}
              isRunning={isRunning === "onnx_session_load_run"}
              filename="onnx_session_load_run.rs"
              expectedOutput={
                "input dims = 4\nclasses = 3\nlogits = [-1.5750, 1.0500, 0.9750]\npredicted class = 1\nscore = 1.0500"
              }
              showResultComparison={true}
              originalCode={DEFAULT_CODES.onnx_session_load_run}
              onRevert={() => resetCode("onnx_session_load_run")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Input tensor</div>
                <p className="text-xs text-muted-foreground leading-5">
                  A fixed four-element vector stands in for a named graph input of shape{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">{"[4]"}</code>.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Forward pass</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Matmul plus bias is the arithmetic the runtime would run for one dense layer.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Post-processing</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Argmax turns raw logits into a class, which is code you own, not the model.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: batched tensor IO with per-row argmax</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  A two-row batch is packed into one row-major flat buffer, the same dense layer runs over each row, and
                  the per-row argmax is printed, mirroring an input tensor of shape{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">{"[2, 4]"}</code>.
                </p>
              </div>
              {codes.onnx_tensor_batch_argmax !== DEFAULT_CODES.onnx_tensor_batch_argmax && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("onnx_tensor_batch_argmax")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the batch is one flat{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">{"Vec<f32>"}</code> laid out row-major,
              exactly how a runtime stores a{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">{"[rows, features]"}</code> tensor in
              memory. The loop slices one row at a time with{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">{"r * IN..(r + 1) * IN"}</code> and runs
              the same layer per row, which is why one session run over a batch beats running the model once per row.{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">forward_row</code> takes a slice rather
              than a fixed-size array reference because each row is sliced out of the flat buffer, and the stride
              computation guarantees the slice is always exactly{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">IN</code> elements long. The diagram
              shows the layout; the output is one line per row.
            </p>
            <MermaidDiagram
              chart={`flowchart TB\n  Flat["flat buffer: row0 (4) then row1 (4)"] --> R0["slice 0..4 = row 0"]\n  Flat --> R1["slice 4..8 = row 1"]\n  R0 -->|forward + argmax| O0["row 0: class + score"]\n  R1 -->|forward + argmax| O1["row 1: class + score"]`}
              caption="A row-major flat buffer holds the whole batch; each row is sliced out and run through the same layer to its own argmax."
            />
            <RustCodeEditor
              code={codes.onnx_tensor_batch_argmax}
              onChange={(newCode) => updateCode("onnx_tensor_batch_argmax", newCode)}
              onRun={() => runCode("onnx_tensor_batch_argmax")}
              output={outputs.onnx_tensor_batch_argmax ?? null}
              isRunning={isRunning === "onnx_tensor_batch_argmax"}
              filename="onnx_tensor_batch_argmax.rs"
              expectedOutput={
                "batch rows = 2\nfeatures per row = 4\nrow 0 argmax = 1 score = 1.0500\nrow 1 argmax = 0 score = 1.1500"
              }
              showResultComparison={true}
              originalCode={DEFAULT_CODES.onnx_tensor_batch_argmax}
              onRevert={() => resetCode("onnx_tensor_batch_argmax")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Row-major layout</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The whole batch is one contiguous buffer, the layout a real tensor uses for{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">{"[2, 4]"}</code>.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Per-row slice</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Slicing by stride recovers each row without copying the underlying buffer.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Batching payoff</div>
                <p className="text-xs text-muted-foreground leading-5">
                  One run over N rows amortizes session overhead better than N single-row runs.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to add a softmax to turn logits into probabilities, extend the batch and
            verify per-row argmax, reason about a shape mismatch, and decide between ort and tract for a given deployment
            constraint.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 54 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Boxes className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Next chapter</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-6">
                Inference puts a deterministic, self-contained binary at the edge of a service. Chapter 55 takes
                determinism in a different direction: smart contracts on Solana and Sei, where Rust runs in a constrained
                on-chain environment and every byte of state and compute is paid for and verified. The same instincts,
                explicit ownership and a tight binary, carry straight over.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(nextChapterPageIndex)} className="gap-2 shrink-0">
              Continue to Chapter 55
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
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
