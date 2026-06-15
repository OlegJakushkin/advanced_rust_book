"use client"

import { useEffect } from "react"
import { ArrowLeft, ArrowRight, BookOpen, Trophy } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { Button } from "@/components/ui/button"
import { simulateRustExecution } from "../rust-simulator"

type ExampleEntry = [key: string, title: string]

type MainPageConfig = {
  intro: string
  exercisePageId?: string
  examples: ExampleEntry[]
}

type ExercisePageConfig = {
  intro: string
  backPageId: string
}

const MAIN_PAGE_CONFIG: Record<string, MainPageConfig> = {
  "ch09-smart-pointers-and-pinning": {
    intro: "Smart pointers encode ownership count, mutation authority, thread sharing, and address stability. This chapter uses Box, Rc, Arc, Weak, interior mutability, and Pin as production design choices.",
    exercisePageId: "ch09-smart-pointers-and-pinning-exercises",
    examples: [
      ["smart_pointers_tree", "Shared ownership with Rc and Weak"],
      ["smart_pointers_pin_poll", "Pinned future polling"],
    ],
  },
  "ch10-arrays-slices-and-vectors": {
    intro: "Contiguous storage choices affect allocation, cache locality, and API flexibility. This chapter defines arrays for fixed shape, slices for borrowed access, and vectors for owned growth.",
    exercisePageId: "ch10-arrays-slices-and-vectors-exercises",
    examples: [
      ["arrays_slices_vectors_slice_api", "Slice-first APIs over arrays and vectors"],
      ["arrays_slices_vectors_capacity", "Capacity planning with Vec"],
    ],
  },
  "ch11-hash-maps-and-sets": {
    intro: "Hash maps and sets sit on critical lookup paths. This chapter covers key ownership, borrowed lookup, entry-based updates, deterministic output, and hashing policy for production data access.",
    exercisePageId: "ch11-hash-maps-and-sets-exercises",
    examples: [
      ["hash_maps_sets_entry_api", "Entry API and owned keys"],
      ["hash_maps_sets_borrowed_lookup_ordered", "Borrowed lookup and ordered views"],
    ],
  },
  "ch14-interfaces-in-rust-traits": {
    intro: "Trait interfaces define capability contracts across library and service boundaries. This chapter covers bounds, associated types, generic dispatch, trait objects, and object safety as reviewable API choices.",
    exercisePageId: "ch14-interfaces-in-rust-traits-exercises",
    examples: [
      ["traits_bounds_associated_types", "Trait bounds and associated types"],
      ["traits_dyn_plugin_pipeline", "dyn Trait plugin pipeline"],
    ],
  },
  "ch13-arena-allocation": {
    intro: "Arena allocation supports workloads that create many related values under one lifecycle. This chapter uses region ownership and stable handles to reduce allocation overhead and simplify teardown.",
    exercisePageId: "ch13-arena-allocation-exercises",
    examples: [
      ["arena_allocation_bump_scratch", "Request-scoped bump scratch buffer"],
      ["arena_allocation_index_ast", "Arena-backed AST with stable IDs"],
    ],
  },
  "ch16-domain-driven-design-in-rust": {
    intro: "Domain-driven Rust encodes business rules in types, constructors, aggregate boundaries, and repository interfaces. This chapter keeps invalid states and persistence concerns out of core domain code.",
    exercisePageId: "ch16-domain-driven-design-in-rust-exercises",
    examples: [
      ["ddd_order_aggregate", "Order aggregate invariants"],
      ["ddd_event_sourced_account", "Event-sourced account rehydration"],
    ],
  },
  "ch18-generics-instead-of-templates": {
    intro: "Generics support reusable Rust APIs without sacrificing concrete contracts. This chapter covers trait bounds, associated types, const generics, and monomorphization costs for production libraries.",
    exercisePageId: "ch18-generics-instead-of-templates-exercises",
    examples: [
      ["generics_batch_bounds", "Generic batch with trait bounds"],
      ["generics_associated_types_const", "Associated types and const generics"],
    ],
  },
  "ch19-serialization-and-data-contracts": {
    intro: "Serialization defines the contract between Rust services, files, queues, and external clients. This chapter covers versioned payloads, schema ownership, compatibility, and explicit transport boundaries.",
    exercisePageId: "ch19-serialization-and-data-contracts-exercises",
    examples: [
      ["serialization_contracts_versioned_event", "Versioned event envelope"],
      ["serialization_contracts_custom_zero_copy", "Custom serialization and borrowed decoding"],
    ],
  },
  "ch22-multithreading-in-rust": {
    intro: "Multithreaded Rust systems need clear ownership transfer, shared-state policy, and shutdown behavior. This chapter covers threads, scoped work, channels, and synchronization as production boundaries.",
    exercisePageId: "ch22-multithreading-in-rust-exercises",
    examples: [
      ["multithreading_owned_jobs_channel", "Owned jobs over a channel"],
      ["multithreading_shared_state_metrics", "Shared-state metrics with Arc<Mutex<_>>"],
      ["multithreading_scoped_threads_sum", "Scoped-thread slice sums"],
    ],
  },
  "ch24-coroutines-futures-and-async-rust": {
    intro: "Async Rust services depend on futures, executors, cancellation, and ownership across await points. This chapter defines the runtime contract behind coroutines and asynchronous state machines.",
    exercisePageId: "ch24-coroutines-futures-and-async-rust-exercises",
    examples: [
      ["async_rust_async_fn_await_block_on", "async fn plus block_on"],
      ["async_rust_manual_future_state_machine", "Manual future state machine"],
    ],
  },
  "ch25-tokio": {
    intro: "Tokio provides the runtime layer for network services, timers, tasks, and blocking work isolation. This chapter covers backpressure, task ownership, shutdown, and runtime configuration.",
    exercisePageId: "ch25-tokio-exercises",
    examples: [
      ["tokio_tasks_backpressure_spawn_blocking", "Backpressure and spawn_blocking"],
      ["tokio_tcp_graceful_shutdown", "Graceful TCP shutdown"],
    ],
  },
  "ch28-cpp-integration": {
    intro: "Native-library integration is a production boundary with ABI, ownership, memory layout, unwind, and error translation requirements. This chapter defines Rust wrapper patterns for that boundary.",
    exercisePageId: "ch28-cpp-integration-exercises",
    examples: [
      ["cpp_integration_calling_c_abi", "Calling a C ABI symbol from Rust"],
      ["cpp_integration_export_rust_c_abi", "Exporting a Rust C ABI wrapper"],
    ],
  },
  "ch29-js-and-cpp-integration-for-wasm": {
    intro: "WebAssembly integration needs explicit host calls, memory ownership, data batching, and ABI rules. This chapter defines the boundary contracts for browser-facing modules and native shims.",
    exercisePageId: "ch29-js-and-cpp-integration-for-wasm-exercises",
    examples: [
      ["wasm_bindgen_string_array_boundary", "wasm-bindgen string and byte boundary"],
      ["wasm_cpp_ffi_boundary", "Wasm plus C ABI boundary"],
    ],
  },
  "ch30-amqp-and-message-brokers": {
    intro: "Message-broker systems need reliable routing, redelivery handling, idempotent consumers, dead-letter policy, and local backpressure. This chapter covers AMQP as an operational contract.",
    exercisePageId: "ch30-amqp-and-message-brokers-exercises",
    examples: [
      ["amqp_direct_exchange_routing", "Direct exchange routing"],
      ["amqp_idempotent_consumer", "Idempotent consumer with retry and DLQ"],
    ],
  },
  "ch33-performance-oriented-rust": {
    intro: "Performance work starts with allocation, data movement, cache behavior, and measurement. This chapter turns Rust optimization into a repeatable review process tied to workload evidence.",
    exercisePageId: "ch33-performance-oriented-rust-exercises",
    examples: [
      ["performance_allocation_borrowed_filter", "Borrowed filter on a hot request path"],
      ["performance_row_major_scan", "Row-major scan and total"],
    ],
  },
  "ch35-performance-profiling": {
    intro: "Performance profiling converts slow paths into verifiable bottlenecks with owners, budgets, and measurements. This chapter covers benchmarks, flame graphs, counters, and regression checks.",
    exercisePageId: "ch35-performance-profiling-exercises",
    examples: [
      ["performance_profiling_hot_stage_summary", "Hottest stage summary"],
      ["performance_profiling_pipeline_bottleneck", "Pipeline bottleneck summary"],
    ],
  },
  "ch37-cuda-and-gpu-acceleration": {
    intro: "GPU acceleration is justified by throughput, transfer cost, memory layout, and launch overhead. This chapter covers Rust-side control of accelerator work without hiding those costs.",
    exercisePageId: "ch37-cuda-and-gpu-acceleration-exercises",
    examples: [
      ["cuda_gpu_kernel_launch_wrapper", "Safe kernel launch wrapper"],
      ["cuda_gpu_transfer_budget", "Transfer budget and arithmetic intensity"],
    ],
  },
  "ch40-matrix-optimization-games": {
    intro: "Matrix optimization depends on layout, tiling, sparsity, SIMD, thread budgets, and accelerator boundaries. This chapter turns those factors into measurable Rust implementation choices.",
    exercisePageId: "ch40-matrix-optimization-games-exercises",
    examples: [
      ["matrix_games_tiled_matmul", "Tiled matrix multiplication"],
      ["matrix_games_sparse_frontier", "Sparse frontier advance"],
    ],
  },
  "ch41-error-handling-in-large-systems": {
    intro: "Large systems need error contracts that separate domain failures, infrastructure failures, retry policy, and operator context. This chapter covers Rust error handling as a production interface.",
    exercisePageId: "ch41-error-handling-in-large-systems-exercises",
    examples: [
      ["error_handling_typed_contracts", "Typed error contracts"],
      ["error_handling_async_context", "Async context propagation"],
    ],
  },
  "ch46-fastapi-style-web-apps-swagger-openapi-codegen": {
    intro: "Web API delivery needs typed handlers, documented contracts, generated transport code, and domain services isolated from HTTP concerns. This chapter builds that production boundary in Rust.",
    exercisePageId: "ch46-fastapi-style-web-apps-swagger-openapi-codegen-exercises",
    examples: [
      ["fastapi_style_handler_service_boundary", "Handler to service boundary"],
      ["fastapi_style_openapi_codegen_scaffold", "OpenAPI scaffold and codegen plan"],
    ],
  },
  "ch52-zokrates-workflows-ethereum-verifiers": {
    intro: "Proof workflows need controlled source programs, setup material, witness custody, generated verifiers, and deployment tracking. This chapter covers ZoKrates and Ethereum verification as staged production artifacts.",
    exercisePageId: "ch52-zokrates-workflows-ethereum-verifiers-exercises",
    examples: [
      ["zokrates_workflow_command_plan", "ZoKrates command plan"],
      ["zokrates_ethereum_verifier_boundary", "Ethereum verifier boundary"],
    ],
  },
  "ch56-no-std-rust-constrained-runtime-derivatives": {
    intro: "Constrained targets need explicit runtime surfaces for allocation, panic handling, IO, startup, and host calls. This chapter covers no_std Rust as a portability and assurance strategy.",
    exercisePageId: "ch56-no-std-rust-constrained-runtime-derivatives-exercises",
    examples: [
      ["no_std_portable_surface", "Portable core/alloc/std surface split"],
      ["no_std_fixed_capacity_dma", "Fixed-capacity DMA-style pool"],
    ],
  },
}

const EXERCISE_PAGE_CONFIG: Record<string, ExercisePageConfig> = {
  "ch09-smart-pointers-and-pinning-exercises": {
    intro: "Practice choosing Box, Rc, Arc, Weak, and Pin from real ownership and runtime constraints.",
    backPageId: "ch09-smart-pointers-and-pinning",
  },
  "ch10-arrays-slices-and-vectors-exercises": {
    intro: "Drill slice-first APIs, capacity planning, and when a Vec should stay contiguous rather than turn into a looser shape.",
    backPageId: "ch10-arrays-slices-and-vectors",
  },
  "ch13-arena-allocation-exercises": {
    intro: "Use this page to think in region lifetimes, stable handles, and arena ownership instead of raw pointer convenience.",
    backPageId: "ch13-arena-allocation",
  },
  "ch14-interfaces-in-rust-traits-exercises": {
    intro: "Practice choosing trait bounds, dyn Trait, and object-safe surfaces from the real runtime boundary.",
    backPageId: "ch14-interfaces-in-rust-traits",
  },
  "ch16-domain-driven-design-in-rust-exercises": {
    intro: "Focus on aggregates, value objects, invariants, and repository seams that stay honest under refactoring.",
    backPageId: "ch16-domain-driven-design-in-rust",
  },
  "ch18-generics-instead-of-templates-exercises": {
    intro: "Practice explicit capability bounds, associated types, and const generics without recreating template sprawl.",
    backPageId: "ch18-generics-instead-of-templates",
  },
  "ch19-serialization-and-data-contracts-exercises": {
    intro: "Design transport DTOs, schema evolution, and zero-copy boundaries deliberately instead of letting serialization leak inward.",
    backPageId: "ch19-serialization-and-data-contracts",
  },
  "ch24-coroutines-futures-and-async-rust-exercises": {
    intro: "Trace futures, Send bounds, cancellation, and cleanup by following the actual state machine boundary.",
    backPageId: "ch24-coroutines-futures-and-async-rust",
  },
  "ch25-tokio-exercises": {
    intro: "Use these drills to reason about runtime ownership, spawn_blocking, bounded queues, and graceful shutdown together.",
    backPageId: "ch25-tokio",
  },
  "ch28-cpp-integration-exercises": {
    intro: "Keep ABI, ownership, and error translation boring and explicit at the FFI seam.",
    backPageId: "ch28-cpp-integration",
  },
  "ch29-js-and-cpp-integration-for-wasm-exercises": {
    intro: "Practice choosing Wasm boundary shapes, batching calls, and keeping JS, Rust, and C++ ownership rules explicit.",
    backPageId: "ch29-js-and-cpp-integration-for-wasm",
  },
  "ch30-amqp-and-message-brokers-exercises": {
    intro: "Focus on routing, idempotency, retries, and dead-letter policy the way production incidents will force you to later.",
    backPageId: "ch30-amqp-and-message-brokers",
  },
  "ch35-performance-profiling-exercises": {
    intro: "Use the profiling drills to separate CPU hotspots from queueing, locking, IO, or serialization before optimizing the wrong thing.",
    backPageId: "ch35-performance-profiling",
  },
  "ch40-matrix-optimization-games-exercises": {
    intro: "Practice choosing dense or sparse layouts, tiling strategy, and fair benchmark boundaries before claiming a matrix win.",
    backPageId: "ch40-matrix-optimization-games",
  },
  "ch46-fastapi-style-web-apps-swagger-openapi-codegen-exercises": {
    intro: "Keep HTTP DTOs, service commands, generated docs, and codegen drift under explicit review.",
    backPageId: "ch46-fastapi-style-web-apps-swagger-openapi-codegen",
  },
  "ch52-zokrates-workflows-ethereum-verifiers-exercises": {
    intro: "Review artifact custody, verifier inputs, rollout policy, and toolchain drift before a proof workflow becomes a production dependency.",
    backPageId: "ch52-zokrates-workflows-ethereum-verifiers",
  },
  "ch56-no-std-rust-constrained-runtime-derivatives-exercises": {
    intro: "Practice designing core/alloc/std boundaries, fixed-capacity data paths, and constrained-runtime audits without losing testability.",
    backPageId: "ch56-no-std-rust-constrained-runtime-derivatives",
  },
}

const MAIN_REVIEW_POINTS = [
  "Run the examples and change the inputs until the transport, ownership, or performance boundary becomes obvious.",
  "Keep the default code as a working baseline while you test one idea at a time.",
  "Use the companion exercise page to turn the chapter model into a repeatable review habit.",
]

const EXERCISE_REVIEW_POINTS = [
  "State the boundary or invariant first, then choose the Rust feature or refactor that matches it.",
  "Keep the answer concrete enough that another engineer could review the same design quickly.",
  "Prefer explicit ownership, pacing, and versioning rules over convenience hidden in one framework surface.",
]

function GenericMainPage({ pageId }: { pageId: string }) {
  const config = MAIN_PAGE_CONFIG[pageId]
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

  const pageIndex = getPageIndexById(pageId)
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  const runCode = (key: string) => {
    setIsRunning(key)
    setTimeout(() => {
      const source = codes[key] ?? DEFAULT_CODES[key] ?? ""
      setOutput(key, simulateRustExecution(source, key))
      setIsRunning(null)
    }, 400)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <BookOpen className="h-4 w-4" />
          Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">{config.intro}</p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Review focus</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {MAIN_REVIEW_POINTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {config.examples.map(([key, title]) => (
          <section key={key} className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
            <RustCodeEditor
              code={codes[key] ?? DEFAULT_CODES[key] ?? ""}
              onChange={(nextCode) => updateCode(key, nextCode)}
              onRun={() => runCode(key)}
              output={outputs[key] ?? null}
              isRunning={isRunning === key}
              filename={`${key}.rs`}
              originalCode={DEFAULT_CODES[key] ?? ""}
              onRevert={() => resetCode(key)}
            />
          </section>
        ))}

        {config.exercisePageId ? (
          <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Use the chapter exercises to turn the model into explicit design, review, and debugging practice.
            </p>
            <Button onClick={() => setCurrentPage(getPageIndexById(config.exercisePageId!))} className="gap-2">
              Open Exercises
              <ArrowRight className="h-4 w-4" />
            </Button>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function GenericExercisePage({ pageId }: { pageId: string }) {
  const config = EXERCISE_PAGE_CONFIG[pageId]
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById(pageId)
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">{config.intro}</p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">How to use this page</h3>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                {EXERCISE_REVIEW_POINTS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(getPageIndexById(config.backPageId))}
              className="gap-2 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Suggested practice</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Rewrite one boundary in your own words before you change code.</li>
            <li>Identify what the caller or operator can still do after a failure or replay event.</li>
            <li>Keep one small deterministic example that proves your chosen design rule.</li>
            <li>Prefer one measured, reviewable repair over several speculative edits.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

const makeMainPage =
  (pageId: string) =>
  function GeneratedMainPage() {
    return <GenericMainPage pageId={pageId} />
  }

const makeExercisePage =
  (pageId: string) =>
  function GeneratedExercisePage() {
    return <GenericExercisePage pageId={pageId} />
  }

export const PageCh09SmartPointersAndPinning = makeMainPage("ch09-smart-pointers-and-pinning")
export const PageCh09SmartPointersAndPinningExercises = makeExercisePage("ch09-smart-pointers-and-pinning-exercises")
export const PageCh10ArraysSlicesAndVectors = makeMainPage("ch10-arrays-slices-and-vectors")
export const PageCh10ArraysSlicesAndVectorsExercises = makeExercisePage("ch10-arrays-slices-and-vectors-exercises")
export const PageCh11HashMapsAndSets = makeMainPage("ch11-hash-maps-and-sets")
export const PageCh13ArenaAllocation = makeMainPage("ch13-arena-allocation")
export const PageCh13ArenaAllocationExercises = makeExercisePage("ch13-arena-allocation-exercises")
export const PageCh14InterfacesInRustTraits = makeMainPage("ch14-interfaces-in-rust-traits")
export const PageCh14InterfacesInRustTraitsExercises = makeExercisePage("ch14-interfaces-in-rust-traits-exercises")
export const PageCh16DomainDrivenDesignInRust = makeMainPage("ch16-domain-driven-design-in-rust")
export const PageCh16DomainDrivenDesignInRustExercises = makeExercisePage("ch16-domain-driven-design-in-rust-exercises")
export const PageCh18GenericsInsteadOfTemplates = makeMainPage("ch18-generics-instead-of-templates")
export const PageCh18GenericsInsteadOfTemplatesExercises = makeExercisePage("ch18-generics-instead-of-templates-exercises")
export const PageCh19SerializationAndDataContracts = makeMainPage("ch19-serialization-and-data-contracts")
export const PageCh19SerializationAndDataContractsExercises = makeExercisePage("ch19-serialization-and-data-contracts-exercises")
export const PageCh22MultithreadingInRust = makeMainPage("ch22-multithreading-in-rust")
export const PageCh24CoroutinesFuturesAndAsyncRust = makeMainPage("ch24-coroutines-futures-and-async-rust")
export const PageCh24CoroutinesFuturesAndAsyncRustExercises = makeExercisePage("ch24-coroutines-futures-and-async-rust-exercises")
export const PageCh25Tokio = makeMainPage("ch25-tokio")
export const PageCh25TokioExercises = makeExercisePage("ch25-tokio-exercises")
export const PageCh28CppIntegration = makeMainPage("ch28-cpp-integration")
export const PageCh28CppIntegrationExercises = makeExercisePage("ch28-cpp-integration-exercises")
export const PageCh29JsAndCppIntegrationForWasm = makeMainPage("ch29-js-and-cpp-integration-for-wasm")
export const PageCh29JsAndCppIntegrationForWasmExercises = makeExercisePage("ch29-js-and-cpp-integration-for-wasm-exercises")
export const PageCh30AmqpAndMessageBrokers = makeMainPage("ch30-amqp-and-message-brokers")
export const PageCh30AmqpAndMessageBrokersExercises = makeExercisePage("ch30-amqp-and-message-brokers-exercises")
export const PageCh33PerformanceOrientedRust = makeMainPage("ch33-performance-oriented-rust")
export const PageCh35PerformanceProfiling = makeMainPage("ch35-performance-profiling")
export const PageCh35PerformanceProfilingExercises = makeExercisePage("ch35-performance-profiling-exercises")
export const PageCh37CudaAndGpuAcceleration = makeMainPage("ch37-cuda-and-gpu-acceleration")
export const PageCh40MatrixOptimizationGames = makeMainPage("ch40-matrix-optimization-games")
export const PageCh40MatrixOptimizationGamesExercises = makeExercisePage("ch40-matrix-optimization-games-exercises")
export const PageCh41ErrorHandlingInLargeSystems = makeMainPage("ch41-error-handling-in-large-systems")
export const PageCh46FastApiStyleWebAppsSwaggerOpenapiCodegen = makeMainPage(
  "ch46-fastapi-style-web-apps-swagger-openapi-codegen"
)
export const PageCh46FastApiStyleWebAppsSwaggerOpenapiCodegenExercises = makeExercisePage(
  "ch46-fastapi-style-web-apps-swagger-openapi-codegen-exercises"
)
export const PageCh52ZoKratesWorkflowsAndEthereumVerifiers = makeMainPage(
  "ch52-zokrates-workflows-ethereum-verifiers"
)
export const PageCh52ZoKratesWorkflowsAndEthereumVerifiersExercises = makeExercisePage(
  "ch52-zokrates-workflows-ethereum-verifiers-exercises"
)
export const PageCh56NoStdRustConstrainedRuntimeDerivativesExercises = makeExercisePage(
  "ch56-no-std-rust-constrained-runtime-derivatives-exercises"
)
export const PageCh56NoStdRustConstrainedRuntimeDerivatives = makeMainPage(
  "ch56-no-std-rust-constrained-runtime-derivatives"
)
