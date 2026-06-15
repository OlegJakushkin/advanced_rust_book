"use client"

import { useEffect } from "react"
import { ArrowLeft, BookOpen, ListChecks } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { RUNTIME_PROFILE_ROWS } from "../runtime-profiles"
import { CHAPTERS, PAGES, chapterRuntimeProfile } from "../types"
import { Button } from "@/components/ui/button"

type LinkSpec = {
  label: string
  pageId: string
}

type TableSpec = {
  headers: string[]
  rows: string[][]
}

type SectionSpec = {
  title: string
  paragraphs?: string[]
  bullets?: string[]
  table?: TableSpec
  links?: LinkSpec[]
}

type AppendixPageSpec = {
  badge: string
  intro: string
  jumpLinks?: LinkSpec[]
  sections: SectionSpec[]
}

const READING_PATHS = {
  cpp: [
    "ch01-why-rust-feels-different",
    "ch02-the-rust-mental-model",
    "ch04-ownership-borrowing-and-lifetimes",
    "ch08-undefined-behavior-and-unsafe-rust",
    "ch09-smart-pointers-and-pinning",
    "ch13-arena-allocation",
    "ch18-generics-instead-of-templates",
    "ch22-multithreading-in-rust",
    "ch23-synchronization-primitives",
    "ch28-cpp-integration",
    "ch32-mpi-and-high-performance-computing",
    "ch33-performance-oriented-rust",
    "ch56-no-std-rust-constrained-runtime-derivatives",
  ],
  csharp: [
    "ch01-why-rust-feels-different",
    "ch02-the-rust-mental-model",
    "ch14-interfaces-in-rust-traits",
    "ch15-oop-models-in-rust",
    "ch16-domain-driven-design-in-rust",
    "ch17-refactoring-toward-idiomatic-rust",
    "ch24-coroutines-futures-and-async-rust",
    "ch25-tokio",
    "ch41-error-handling-in-large-systems",
    "ch43-observability",
    "ch46-fastapi-style-web-apps-swagger-openapi-codegen",
    "ch47-grpc-services-with-protobuf-and-service-api-codegen",
  ],
  go: [
    "ch01-why-rust-feels-different",
    "ch02-the-rust-mental-model",
    "ch04-ownership-borrowing-and-lifetimes",
    "ch07-copying-data-vs-cloning-data",
    "ch14-interfaces-in-rust-traits",
    "ch24-coroutines-futures-and-async-rust",
    "ch25-tokio",
    "ch26-task-libraries-and-parallel-execution",
    "ch30-amqp-and-message-brokers",
    "ch31-distributed-task-execution",
    "ch43-observability",
    "ch48-websockets-long-lived-connections",
    "ch49-https-tls-secure-service-boundaries",
    "ch50-libp2p-peer-to-peer-rust-systems",
  ],
}

const APPENDIX_SPECS: Record<string, AppendixPageSpec> = {
  "appendix-a-rust-syntax-for-cpp-developers": {
    badge: "Appendix A",
    intro:
      "A compact translation guide for senior C++ engineers. Use it to map familiar syntax into Rust's actual ownership, trait, and error contracts instead of forcing a one-to-one language illusion.",
    jumpLinks: [
      { label: "Ownership", pageId: "ch04-ownership-borrowing-and-lifetimes" },
      { label: "Unsafe", pageId: "ch08-undefined-behavior-and-unsafe-rust" },
      { label: "Generics", pageId: "ch18-generics-instead-of-templates" },
    ],
    sections: [
      {
        title: "Fast translation table",
        table: {
          headers: ["C++ idea", "Rust shape", "Why it matters"],
          rows: [
            ["RAII + destructors", "Ownership + Drop", "Lifetime is explicit in values, not hidden behind scopes only."],
            ["`const T&`", "`&T`", "Shared borrow, read-only access."],
            ["`T&`", "`&mut T`", "Exclusive mutable borrow, one writer at a time."],
            ["`std::move(x)`", "Move by default for non-Copy values", "Ownership transfer is ordinary, not opt-in."],
            ["Templates", "Generics + trait bounds", "Required capabilities are named explicitly."],
            ["Virtual dispatch", "`dyn Trait`", "Type erasure is explicit and object safety matters."],
            ["`std::unique_ptr<T>`", "`Box<T>`", "Single-owner heap allocation."],
            ["`std::shared_ptr<T>`", "`Rc<T>` / `Arc<T>`", "Shared ownership is explicit and often avoidable."],
            ["Tagged unions / variants", "Enums", "Closed polymorphism is a first-class design tool."],
            ["Exceptions", "`Result<T, E>`", "Recoverable failure is part of the signature."],
          ],
        },
      },
      {
        title: "Common corrections",
        bullets: [
          "Rust traits are not base classes with fields. Use structs and enums for state, traits for behavior.",
          "Borrowing is a design constraint, not a pointer flavor. Ask who owns the data first.",
          "Many APIs that would be virtual in C++ are calmer as generics in Rust.",
          "Unsafe Rust is not an escape from the model. It is a promise that you are upholding the missing invariants manually.",
        ],
      },
      {
        title: "What usually feels best first",
        bullets: [
          "Port small value-oriented utilities first.",
          "Replace pointer webs with one owner plus stable handles where possible.",
          "Keep FFI seams narrow and C ABI-friendly before attempting deeper C++ interop.",
        ],
      },
    ],
  },
  "appendix-b-rust-syntax-for-csharp-developers": {
    badge: "Appendix B",
    intro:
      "A compact translation guide for C# engineers. The goal is to preserve clarity and typed APIs while dropping assumptions about GC, ambient reflection, and framework-shaped exception flow.",
    jumpLinks: [
      { label: "Traits", pageId: "ch14-interfaces-in-rust-traits" },
      { label: "DDD", pageId: "ch16-domain-driven-design-in-rust" },
      { label: "Async", pageId: "ch24-coroutines-futures-and-async-rust" },
    ],
    sections: [
      {
        title: "Fast translation table",
        table: {
          headers: ["C# idea", "Rust shape", "Why it matters"],
          rows: [
            ["Class with fields", "Struct or enum", "Data layout and ownership stay explicit."],
            ["Interface", "Trait", "Behavior contract; can be generic or dynamic."],
            ["Reference type everywhere", "Owned value + borrow when needed", "No default GC safety net."],
            ["Nullable reference / optional", "`Option<T>`", "Absence is typed explicitly."],
            ["Exceptions", "`Result<T, E>` + panic for invariants", "Recoverable vs unrecoverable is clearer."],
            ["`Task<T>`", "`Future<Output = T>`", "Async is a state machine; executors matter."],
            ["LINQ chain", "Iterator chain", "Often zero-cost, but measure on hot paths."],
            ["Properties", "Methods / direct fields", "Fewer ambient accessor conventions."],
            ["Reflection-heavy framework wiring", "Typed extractors, traits, macros, metadata", "Much less runtime magic."],
          ],
        },
      },
      {
        title: "Common corrections",
        bullets: [
          "Rust does not assume heap allocation or GC for ordinary objects.",
          "Async boundaries still need ownership, cancellation, and Send or Sync discipline.",
          "Framework DTOs should stop at the transport boundary instead of becoming the domain model.",
          "Use `thiserror` or typed enums where a caller still needs to branch on failure.",
        ],
      },
      {
        title: "Good first wins",
        bullets: [
          "Model domain rules with structs, enums, and typed constructors.",
          "Replace exception-shaped validation with small Result-returning APIs.",
          "Keep web, gRPC, or queue transport types out of core business logic.",
        ],
      },
    ],
  },
  "appendix-c-rust-syntax-for-go-developers": {
    badge: "Appendix C",
    intro:
      "A compact translation guide for Go engineers. Rust overlaps with Go on explicit error values, but differs sharply in ownership, trait-based abstraction, and runtime assumptions.",
    jumpLinks: [
      { label: "Copy vs Clone", pageId: "ch07-copying-data-vs-cloning-data" },
      { label: "Tokio", pageId: "ch25-tokio" },
      { label: "Task Systems", pageId: "ch26-task-libraries-and-parallel-execution" },
    ],
    sections: [
      {
        title: "Fast translation table",
        table: {
          headers: ["Go idea", "Rust shape", "Why it matters"],
          rows: [
            ["Slice", "`&[T]` or `Vec<T>`", "Borrowed view vs owned buffer is explicit."],
            ["Map", "`HashMap<K, V>`", "Ownership of keys and values is part of the API."],
            ["Interface", "Trait / `dyn Trait`", "Dynamic dispatch is explicit, not ambient."],
            ["`error` return", "`Result<T, E>`", "Typed error classification is common."],
            ["Goroutine", "Tokio task / thread / Rayon job", "Choose from workload shape, not one runtime default."],
            ["Channel", "`mpsc`, broadcast, watch, crossbeam", "Several queue shapes exist; each has tradeoffs."],
            ["`defer`", "RAII + Drop", "Cleanup follows ownership rather than stack callbacks."],
            ["Embedded structs / composition", "Struct composition + traits", "No inheritance expectations."],
            ["Context propagation", "Owned request / task context fields", "Explicit transport and tracing boundaries."],
          ],
        },
      },
      {
        title: "Common corrections",
        bullets: [
          "Do not map every concurrency problem to Tokio tasks. CPU-bound work often wants Rayon or threads.",
          "Borrowing is stricter than Go's pointer story and often removes accidental copies.",
          "A broker queue is not the same thing as an in-process channel.",
          "Rust's `String` and `Vec<T>` ownership is explicit, so cloning costs are easier to spot and review.",
        ],
      },
      {
        title: "Good first wins",
        bullets: [
          "Write slice-first APIs for pure computation.",
          "Keep request, task, and queue envelopes owned at concurrency boundaries.",
          "Use Result-returning adapters instead of hiding failure in log lines plus zero values.",
        ],
      },
    ],
  },
  "appendix-d-ownership-error-cheat-sheet": {
    badge: "Appendix D",
    intro:
      "A repair-focused quick reference for the ownership and borrowing errors senior engineers hit most often when the design boundary is still in transition.",
    jumpLinks: [
      { label: "Ownership chapter", pageId: "ch04-ownership-borrowing-and-lifetimes" },
      { label: "Struct ownership", pageId: "ch05-ownership-inside-structs" },
      { label: "Async borrowing", pageId: "appendix-g-async-rust-troubleshooting-guide" },
    ],
    sections: [
      {
        title: "Error to first repair",
        table: {
          headers: ["Typical compiler complaint", "Likely cause", "First repair to try"],
          rows: [
            ["use of moved value", "Ownership transferred earlier", "Borrow instead, clone once at the boundary, or reorder the code."],
            ["cannot borrow as mutable because also borrowed as immutable", "Read and write lifetimes overlap", "Shorten the read borrow, compute first, mutate later."],
            ["borrowed value does not live long enough", "Returned or stored borrow outlives owner", "Return an owned value or move the owner outward."],
            ["cannot return reference to local data", "Reference points into a dropped local", "Return an owned String / Vec / struct instead."],
            ["future is not Send", "Captured value is not Send across task boundary", "Move owned Send data into the task or keep the work local."],
            ["cannot move out while borrowed", "Later borrow still needs the value", "Extract only what is needed, clone deliberately, or move after the borrow ends."],
          ],
        },
      },
      {
        title: "Short diagnostic loop",
        bullets: [
          "Find the true owner first.",
          "Ask whether the boundary wants a borrow, an owned clone, or a stable handle.",
          "Shorten temporary borrows aggressively before adding lifetimes.",
          "At async, thread, and queue boundaries, prefer owned data over clever borrow gymnastics.",
        ],
      },
    ],
  },
  "appendix-e-unsafe-rust-audit-checklist": {
    badge: "Appendix E",
    intro:
      "Use this checklist whenever a small unsafe region exists for performance, FFI, MMIO, allocators, or low-level concurrency.",
    jumpLinks: [
      { label: "Unsafe chapter", pageId: "ch08-undefined-behavior-and-unsafe-rust" },
      { label: "FFI checklist", pageId: "appendix-h-ffi-checklist" },
      { label: "no_std audit", pageId: "appendix-o-no-std-rust-portability-and-audit-checklist" },
    ],
    sections: [
      {
        title: "Pre-merge audit questions",
        bullets: [
          "Is the safety invariant written directly above the unsafe block or function?",
          "Can input validation happen entirely outside the unsafe region?",
          "Are aliasing, initialization, bounds, and lifetime assumptions explicit?",
          "Is panic or unwinding behavior across FFI or callback boundaries defined?",
          "Is the unsafe surface as small and local as possible?",
          "Does a safe wrapper expose the operation to the rest of the codebase?",
        ],
      },
      {
        title: "Validation and tooling",
        bullets: [
          "Add unit tests for boundary conditions and malformed inputs.",
          "Use Miri when pure-Rust UB questions are relevant.",
          "Use sanitizers or native harnesses when FFI, raw allocation, or external memory is involved.",
          "Document what a future maintainer must preserve before refactoring the safe wrapper.",
        ],
      },
    ],
  },
  "appendix-f-trait-object-and-generics-decision-guide": {
    badge: "Appendix F",
    intro:
      "A compact decision guide for choosing concrete types, generics, enums, or trait objects from the real runtime boundary.",
    jumpLinks: [
      { label: "Traits", pageId: "ch14-interfaces-in-rust-traits" },
      { label: "Generics", pageId: "ch18-generics-instead-of-templates" },
      { label: "Refactoring", pageId: "ch17-refactoring-toward-idiomatic-rust" },
    ],
    sections: [
      {
        title: "Decision table",
        table: {
          headers: ["Question", "Prefer", "Reason"],
          rows: [
            ["Caller knows the concrete type and hot-path inlining matters", "Generics", "Static dispatch and smaller runtime surface."],
            ["Need one heterogeneous collection of implementations", "`dyn Trait`", "Runtime type erasure is the real requirement."],
            ["Closed set of variants and exhaustive handling matters", "Enum", "Pattern matching beats open polymorphism here."],
            ["Only one implementation exists and likely stays that way", "Concrete type", "Do not abstract speculatively."],
            ["Need constructors or methods returning Self on the main surface", "Generics or split traits", "Trait objects may fail object safety."],
          ],
        },
      },
      {
        title: "Short rules",
        bullets: [
          "Start concrete, generalize only when several implementations are semantically real.",
          "Use `dyn Trait` when runtime heterogeneity is the point, not because 'interface' sounds familiar.",
          "Use associated types when each implementation has one canonical related type.",
          "Measure binary size and compile time if generic instantiations become wide.",
        ],
      },
    ],
  },
  "appendix-g-async-rust-troubleshooting-guide": {
    badge: "Appendix G",
    intro:
      "A symptom-first guide for common async Rust failures in Tokio-style systems and futures-based code.",
    jumpLinks: [
      { label: "Async basics", pageId: "ch24-coroutines-futures-and-async-rust" },
      { label: "Tokio", pageId: "ch25-tokio" },
      { label: "Task profiling", pageId: "ch36-distributed-tasks-profiling" },
    ],
    sections: [
      {
        title: "Common symptoms and first repairs",
        table: {
          headers: ["Symptom", "Likely cause", "First repair"],
          rows: [
            ["future is not Send", "Captured value is not Send", "Move owned Send data, keep non-Send work local, or use a local task set."],
            ["Borrowed data escapes task", "Task may outlive caller scope", "Move owned data into the task or redesign the boundary."],
            ["Runtime stalls under CPU work", "Blocking or CPU-heavy code on runtime workers", "Use `spawn_blocking`, Rayon, or a dedicated worker pool."],
            ["Memory grows with queue depth", "Unbounded channels or too many tasks", "Bound queues, cap concurrency, shrink payloads."],
            ["Mutex deadlocks or long latency", "Holding a guard across `.await`", "Shorten guard scope or switch to message passing."],
            ["Cancelled work still burns resources", "No shutdown or deadline checks", "Add explicit cancellation or deadline boundaries."],
          ],
        },
      },
      {
        title: "Always check",
        bullets: [
          "What is queue wait versus handler run time?",
          "Which values became owned at task boundaries?",
          "Which tasks are detached and therefore easy to lose or leak?",
          "Whether the system needs graceful shutdown sequencing rather than abrupt task drop.",
        ],
      },
    ],
  },
  "appendix-h-ffi-checklist": {
    badge: "Appendix H",
    intro:
      "A compact release gate for Rust <-> C, C++, or host ABI work.",
    jumpLinks: [
      { label: "C++ integration", pageId: "ch28-cpp-integration" },
      { label: "WASM interop", pageId: "ch29-js-and-cpp-integration-for-wasm" },
      { label: "Unsafe audit", pageId: "appendix-e-unsafe-rust-audit-checklist" },
    ],
    sections: [
      {
        title: "Boundary checklist",
        bullets: [
          "Use a stable ABI such as `extern \"C\"` unless a different ABI is explicitly required.",
          "Keep foreign-facing types to raw pointers, lengths, integers, status codes, and `#[repr(C)]` structs where needed.",
          "Document nullability and readable or writable memory promises for every pointer.",
          "Make create/free ownership pairs explicit for every owned resource kind.",
          "Do not let panics or exceptions cross the boundary implicitly.",
          "Test the final boundary with a native harness, not only with Rust unit tests.",
        ],
      },
      {
        title: "Good default patterns",
        bullets: [
          "status code + out parameter for recoverable failure",
          "opaque handle APIs for long-lived state",
          "pointer + length for borrowed byte or numeric buffers",
          "tiny safe wrapper in Rust around raw-pointer reconstruction",
        ],
      },
    ],
  },
  "appendix-i-performance-checklist": {
    badge: "Appendix I",
    intro:
      "A short production checklist for performance work so the team measures the right thing before changing the wrong boundary.",
    jumpLinks: [
      { label: "Performance model", pageId: "ch33-performance-oriented-rust" },
      { label: "Profiling", pageId: "ch35-performance-profiling" },
      { label: "Distributed profiling", pageId: "ch36-distributed-tasks-profiling" },
    ],
    sections: [
      {
        title: "Before refactoring",
        bullets: [
          "State the workload, input size, and success metric.",
          "Run in release mode.",
          "Choose benchmark, profile, trace, or live telemetry deliberately.",
          "Count allocations, clones, queue wait, lock wait, and bytes moved separately.",
        ],
      },
      {
        title: "After refactoring",
        bullets: [
          "Re-run the same workload and keep correctness checks identical.",
          "Confirm the improvement in the live system if the path is production-critical.",
          "Record binary size or compile-time regressions when generic or inlining changes are involved.",
          "Keep before-and-after numbers in the review notes so the next engineer can revisit them honestly.",
        ],
      },
    ],
  },
  "appendix-j-recommended-crates-by-topic": {
    badge: "Appendix J",
    intro:
      "Common crate starting points to evaluate, not a mandate. Favor crates with good docs, active maintenance, and a clean fit for your actual boundary.",
    jumpLinks: [
      { label: "Async", pageId: "ch25-tokio" },
      { label: "Web APIs", pageId: "ch46-fastapi-style-web-apps-swagger-openapi-codegen" },
      { label: "gRPC", pageId: "ch47-grpc-services-with-protobuf-and-service-api-codegen" },
    ],
    sections: [
      {
        title: "Common starting points",
        table: {
          headers: ["Topic", "Often-evaluated crates", "Why they show up"],
          rows: [
            ["Serialization", "serde, serde_json, postcard", "DTOs, config, wire formats, compact binary formats."],
            ["Errors", "thiserror, anyhow", "Typed errors below, rich context at app edges."],
            ["Async runtime", "tokio", "Tasks, networking, timers, channels, structured shutdown."],
            ["Parallel CPU", "rayon, crossbeam", "Data-parallel work and bounded cross-thread coordination."],
            ["HTTP server", "axum, actix-web, tower-http", "Typed transport layers and middleware ecosystems."],
            ["gRPC / protobuf", "tonic, prost", "Schema-driven RPC and generated transport types."],
            ["Tracing / telemetry", "tracing, tracing-subscriber, opentelemetry", "Structured spans, exporter integration, incident correlation."],
            ["CLI", "clap", "Typed argument parsing and help generation."],
            ["Testing", "proptest, insta, criterion, tokio-test, loom", "Property tests, snapshots, benchmarks, async helpers, concurrency checks."],
            ["TLS / cert tools", "rustls, rcgen", "Rust-native TLS and local test certificates."],
            ["P2P", "libp2p", "Composable peer networking behaviours and transports."],
            ["no_std helpers", "heapless, spin", "Fixed-capacity data structures and tiny synchronization primitives."],
          ],
        },
      },
      {
        title: "Selection rules",
        bullets: [
          "Choose the smallest crate surface that matches the job.",
          "Prefer crates already accepted by your portability or security policy.",
          "For high-risk boundaries, review maintenance health and release discipline before convenience.",
          "Hide crate-specific details behind your own thin boundary when you expect the dependency might change later.",
        ],
      },
    ],
  },
  "appendix-k-glossary-of-rust-terms": {
    badge: "Appendix K",
    intro:
      "A compact glossary for the terms used repeatedly across the book.",
    jumpLinks: [
      { label: "Reading paths", pageId: "appendix-l-suggested-reading-path-by-background" },
      { label: "Exercise index", pageId: "exercise-index" },
    ],
    sections: [
      {
        title: "Glossary",
        table: {
          headers: ["Term", "Meaning"],
          rows: [
            ["Ownership", "The rule that each value has one controlling owner responsible for its lifetime."],
            ["Borrow", "Temporary access to a value without taking ownership."],
            ["`&T`", "Shared immutable borrow."],
            ["`&mut T`", "Exclusive mutable borrow."],
            ["Move", "Ownership transfer of a value."],
            ["Copy", "Bitwise copy semantics for small trivially copyable types."],
            ["Clone", "Explicit duplication, often including heap allocation."],
            ["RAII", "Resource acquisition is initialization; cleanup follows value lifetime."],
            ["Trait", "Rust's primary interface and capability abstraction."],
            ["Trait object", "Runtime type-erased value behind `dyn Trait`."],
            ["Object safety", "The restrictions a trait must satisfy to be used as a trait object."],
            ["Monomorphization", "Compile-time specialization of generic code for concrete types."],
            ["Enum", "Closed sum type with variants."],
            ["Pin", "A guarantee that a value will not be moved after being pinned."],
            ["Future", "An async state machine that can be polled for progress."],
            ["Executor", "Runtime that polls futures and schedules async work."],
            ["Send", "Type can be transferred safely to another thread."],
            ["Sync", "Shared references to the type can be used safely from multiple threads."],
            ["Backpressure", "A policy that limits in-flight work instead of buffering forever."],
            ["Idempotency", "Running the same logical work twice does not duplicate the durable effect."],
            ["FFI", "Foreign Function Interface boundary to non-Rust code."],
            ["`no_std`", "Crate avoids assuming the full Rust standard library exists."],
            ["`alloc`", "Heap-backed types made available when an allocator exists."],
            ["Merkle root", "Digest committing to a whole set of leaves through a hash tree."],
            ["Statement", "Public claim a verifier checks in a proof system."],
            ["Witness", "Private data proving the statement is true."],
          ],
        },
      },
    ],
  },
  "appendix-l-suggested-reading-path-by-background": {
    badge: "Appendix L",
    intro:
      "Use these paths when you want the shortest useful route from your previous language background into the parts of Rust that will matter most for your current work.",
    jumpLinks: [
      { label: "C++ syntax map", pageId: "appendix-a-rust-syntax-for-cpp-developers" },
      { label: "C# syntax map", pageId: "appendix-b-rust-syntax-for-csharp-developers" },
      { label: "Go syntax map", pageId: "appendix-c-rust-syntax-for-go-developers" },
    ],
    sections: [
      {
        title: "C++ reading path",
        paragraphs: [
          "Start here if you already think in RAII, layout, FFI, and performance, but want to internalize Rust's borrow rules and trait-based abstraction.",
        ],
        links: READING_PATHS.cpp.map((pageId) => ({
          label: PAGES[getPageIndexById(pageId)].title,
          pageId,
        })),
      },
      {
        title: "C# reading path",
        paragraphs: [
          "Start here if interface design, domain modeling, async services, and application architecture are your main migration path into Rust.",
        ],
        links: READING_PATHS.csharp.map((pageId) => ({
          label: PAGES[getPageIndexById(pageId)].title,
          pageId,
        })),
      },
      {
        title: "Go reading path",
        paragraphs: [
          "Start here if concurrency, service boundaries, messaging, and operational simplicity are your main transition points.",
        ],
        links: READING_PATHS.go.map((pageId) => ({
          label: PAGES[getPageIndexById(pageId)].title,
          pageId,
        })),
      },
      {
        title: "How to use the paths",
        bullets: [
          "Read the core chapters in order, then jump into the service, distributed, or constrained-runtime track you need.",
          "Use the syntax appendices as quick translation aids, not as substitutes for the ownership chapters.",
          "Open the exercise index when you want drills by skill instead of by chapter order.",
        ],
        links: [{ label: "Open Exercise Index", pageId: "exercise-index" }],
      },
    ],
  },
  "appendix-m-rust-web-services-and-api-contract-checklist": {
    badge: "Appendix M",
    intro:
      "A concise checklist for web and service APIs so the edge contract stays reviewable across HTTP, gRPC, queues, auth, and rollout.",
    jumpLinks: [
      { label: "Web APIs", pageId: "ch46-fastapi-style-web-apps-swagger-openapi-codegen" },
      { label: "gRPC", pageId: "ch47-grpc-services-with-protobuf-and-service-api-codegen" },
      { label: "HTTPS/TLS", pageId: "ch49-https-tls-secure-service-boundaries" },
    ],
    sections: [
      {
        title: "Contract checklist",
        bullets: [
          "Transport DTOs are separate from application commands and domain entities.",
          "Versioning rules are explicit: path, header, or envelope.",
          "Idempotency keys exist for create or charge-like side effects.",
          "Pagination, filtering, and size limits are validated at the transport edge.",
          "Auth, tenant identity, trace ID, and request ID are available before business logic runs.",
          "OpenAPI or protobuf artifacts have drift checks in CI.",
          "Graceful shutdown stops admission before it drops in-flight side effects.",
          "Queue handoff, downstream publish, and storage latency are observable as separate spans or metrics.",
        ],
      },
      {
        title: "When a review should stop",
        bullets: [
          "If the service method still depends on framework request types directly.",
          "If generated docs or generated clients are not rebuilt or diffed in CI.",
          "If retry policy is inferred from status text instead of typed classification.",
        ],
      },
    ],
  },
  "appendix-n-zkp-zokrates-and-zkml-production-caveats": {
    badge: "Appendix N",
    intro:
      "A production-caveat appendix for proof-backed systems, especially where ZoKrates and ZKML workflows are involved.",
    jumpLinks: [
      { label: "ZKP foundations", pageId: "ch51-zero-knowledge-proofs-rust-engineers" },
      { label: "ZoKrates", pageId: "ch52-zokrates-workflows-ethereum-verifiers" },
      { label: "ZKML", pageId: "ch53-ezkl-verifiable-llm-inference-gpu-zkml" },
    ],
    sections: [
      {
        title: "Do not overclaim",
        bullets: [
          "A proof can verify a computation claim without verifying model quality, fairness, safety, or factuality.",
          "Zero knowledge does not automatically hide metadata, request timing, or public inputs.",
          "A correct proof over a wrong circuit is still a wrong product result.",
        ],
      },
      {
        title: "Artifact and protocol drift risks",
        bullets: [
          "Circuit ID, transcript domain, public input ordering, tokenizer policy, quantization config, and key version must stay attributable.",
          "Generated verifier contracts are deployment artifacts and need ordinary release discipline.",
          "Witness material should usually stay ephemeral and proving-side only.",
        ],
      },
      {
        title: "Operational caveats",
        bullets: [
          "Proving lanes need queue budgets, storage budgets, and heavy-worker observability.",
          "GPU-backed proving should be treated as workload-dependent, not automatically superior.",
          "Mixed-version rollout is the normal upgrade problem once several services or consumers depend on verifier output.",
        ],
      },
    ],
  },
  "appendix-o-no-std-rust-portability-and-audit-checklist": {
    badge: "Appendix O",
    intro:
      "A final portability and audit checklist for `no_std`, freestanding, embedded, WASM guest, and constrained-runtime Rust.",
    jumpLinks: [
      { label: "no_std chapter", pageId: "ch56-no-std-rust-constrained-runtime-derivatives" },
      { label: "Unsafe audit", pageId: "appendix-e-unsafe-rust-audit-checklist" },
      { label: "FFI checklist", pageId: "appendix-h-ffi-checklist" },
    ],
    sections: [
      {
        title: "Portability checklist",
        bullets: [
          "State clearly whether the crate is core-only, alloc-gated, optional-std, or std-required.",
          "Audit transitive dependencies for accidental std requirements.",
          "Version panic mode, target triples, linker scripts, allocators, and startup objects in CI.",
          "Keep host-only logging, file IO, and transport adapters outside the portable core.",
        ],
      },
      {
        title: "Constrained-runtime audit checklist",
        bullets: [
          "Unsafe MMIO, DMA, FFI, and allocator surfaces have written invariants.",
          "Interrupt or host-callback concurrency assumptions are explicit and tested.",
          "Fixed-capacity or fallible-memory paths exist where the budget is real.",
          "Host-side tests still cover the portable logic even when target-side debugging is limited.",
        ],
      },
      {
        title: "Release checklist",
        bullets: [
          "Cross-target smoke tests run in CI.",
          "Feature combinations such as `default-features = false` or `alloc`-only are exercised intentionally.",
          "Observability for constrained targets has an explicit fallback path: counters, serial output, ring buffers, or host ABI calls.",
        ],
      },
    ],
  },
}

function renderLinks(links: LinkSpec[] | undefined, setCurrentPage: (page: number) => void) {
  if (!links?.length) return null

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {links.map((link) => (
        <Button
          key={`${link.pageId}:${link.label}`}
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(getPageIndexById(link.pageId))}
        >
          {link.label}
        </Button>
      ))}
    </div>
  )
}

function renderTable(table: TableSpec) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {table.headers.map((header) => (
              <th key={header} className="py-2 pr-4 font-semibold text-foreground">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={`${row[0]}:${index}`} className="border-b border-border/60 align-top">
              {row.map((cell, cellIndex) => (
                <td key={`${cellIndex}:${cell.slice(0, 24)}`} className="py-3 pr-4 text-muted-foreground leading-6">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AppendixReferencePage({ pageId }: { pageId: string }) {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById(pageId)
  const page = PAGES[pageIndex]
  const spec = APPENDIX_SPECS[pageId]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  if (!spec) {
    return (
      <div className="h-full flex flex-col">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <BookOpen className="h-4 w-4" />
            Reference page
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
          <p className="text-muted-foreground">Reference content unavailable.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <BookOpen className="h-4 w-4" />
          {spec.badge} · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">{spec.intro}</p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this appendix</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat this page as a compact reference, not as a replacement for the chapter material. Use it when you need
                a quick design reminder, review checklist, or language translation aid while implementing or refactoring.
              </p>
              {renderLinks(spec.jumpLinks, setCurrentPage)}
            </div>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(getPageIndexById("exercise-index"))}
              className="gap-2 shrink-0"
            >
              <ListChecks className="h-4 w-4" />
              Exercise Index
            </Button>
          </div>
        </section>

        {spec.sections.map((section) => (
          <section key={section.title} className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">{section.title}</h3>

            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="text-sm text-muted-foreground leading-6 mb-3 last:mb-0">
                {paragraph}
              </p>
            ))}

            {section.bullets?.length ? (
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}

            {section.table ? <div className="mt-4">{renderTable(section.table)}</div> : null}

            {renderLinks(section.links, setCurrentPage)}
          </section>
        ))}
      </div>
    </div>
  )
}

function deriveSkills(description: string): string[] {
  return description
    .replace(/\band\b/gi, ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
}

function chapterNumberLabel(index: number) {
  return String(index + 1).padStart(2, "0")
}

export function PageExerciseIndex() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("exercise-index")
  const page = PAGES[pageIndex]
  const numberedChapters = CHAPTERS.filter((chapter) => /^ch\d\d-/.test(chapter.id))

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <ListChecks className="h-4 w-4" />
          Reference Index · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          A fast index for every numbered chapter exercise page, with the main skills each set of drills reinforces.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this index</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Use this page when you want to pick drills by skill rather than strictly by reading order. The chapter links
                open the main lesson. The exercise links jump directly to the drill page.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(getPageIndexById("appendix-l-suggested-reading-path-by-background"))}>
                  Reading Paths
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(getPageIndexById("appendix-k-glossary-of-rust-terms"))}>
                  Glossary
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(getPageIndexById("ch56-no-std-rust-constrained-runtime-derivatives"))}
              className="gap-2 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 56
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Browser runtime profiles (c2w)</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            Homework that uses the in-browser Cargo editor should load one prebuilt offline image per profile (each must stay
            under roughly 1 GiB). Use <code className="text-foreground">?runtime=base|async|web|wasm|cpp</code> when embedding
            the editor. Chapter 32 (MPI) uses the base profile plus the in-browser simulator until a dedicated MPI image fits
            the size budget.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-semibold text-foreground">Profile</th>
                  <th className="py-2 pr-4 font-semibold text-foreground">Chapters</th>
                  <th className="py-2 pr-4 font-semibold text-foreground">Image</th>
                  <th className="py-2 font-semibold text-foreground">Notes</th>
                </tr>
              </thead>
              <tbody>
                {RUNTIME_PROFILE_ROWS.map((row) => (
                  <tr key={row.profile} className="border-b border-border/60 align-top">
                    <td className="py-3 pr-4 font-medium text-foreground">{row.profile}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{row.chapters}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{row.image}</td>
                    <td className="py-3 text-muted-foreground leading-6">{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Chapter-to-exercise map</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-semibold text-foreground">Ch.</th>
                  <th className="py-2 pr-4 font-semibold text-foreground">Topic</th>
                  <th className="py-2 pr-4 font-semibold text-foreground">Runtime</th>
                  <th className="py-2 pr-4 font-semibold text-foreground">Primary skills</th>
                  <th className="py-2 font-semibold text-foreground">Jump</th>
                </tr>
              </thead>
              <tbody>
                {numberedChapters.map((chapter, index) => {
                  const lessonPage = chapter.pages[0]
                  const exercisePage = chapter.pages.find((candidate) => candidate.id.endsWith("-exercises"))
                  const skills = deriveSkills(lessonPage.description)

                  return (
                    <tr key={chapter.id} className="border-b border-border/60 align-top">
                      <td className="py-3 pr-4 text-foreground font-medium">{chapterNumberLabel(index)}</td>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-foreground">{lessonPage.title}</div>
                        <div className="text-xs text-muted-foreground">{exercisePage ? exercisePage.title : "Exercise page missing"}</div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                        {chapterRuntimeProfile(chapter)}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground leading-6">
                        {skills.join(" · ")}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(getPageIndexById(lessonPage.id))}
                          >
                            Chapter
                          </Button>
                          {exercisePage ? (
                            <Button
                              size="sm"
                              onClick={() => setCurrentPage(getPageIndexById(exercisePage.id))}
                            >
                              Exercises
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Suggested use</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>When stuck on ownership, revisit Chapters 04 through 09 and their exercise pages as a small block.</li>
            <li>For service and async work, Chapters 24 through 31 plus 41 through 49 form the most practical cluster.</li>
            <li>For performance and systems tuning, Chapters 32 through 40 plus 54 are the main review route.</li>
            <li>For proof and verifiability topics, Chapters 38 and 51 through 53 are the primary path.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

export const PageAppendixARustSyntaxForCppDevelopers = () => (
  <AppendixReferencePage pageId="appendix-a-rust-syntax-for-cpp-developers" />
)

export const PageAppendixBRustSyntaxForCSharpDevelopers = () => (
  <AppendixReferencePage pageId="appendix-b-rust-syntax-for-csharp-developers" />
)

export const PageAppendixCRustSyntaxForGoDevelopers = () => (
  <AppendixReferencePage pageId="appendix-c-rust-syntax-for-go-developers" />
)

export const PageAppendixDOwnershipErrorCheatSheet = () => (
  <AppendixReferencePage pageId="appendix-d-ownership-error-cheat-sheet" />
)

export const PageAppendixEUnsafeRustAuditChecklist = () => (
  <AppendixReferencePage pageId="appendix-e-unsafe-rust-audit-checklist" />
)

export const PageAppendixFTraitObjectAndGenericsDecisionGuide = () => (
  <AppendixReferencePage pageId="appendix-f-trait-object-and-generics-decision-guide" />
)

export const PageAppendixGAsyncRustTroubleshootingGuide = () => (
  <AppendixReferencePage pageId="appendix-g-async-rust-troubleshooting-guide" />
)

export const PageAppendixHFFIChecklist = () => (
  <AppendixReferencePage pageId="appendix-h-ffi-checklist" />
)

export const PageAppendixIPerformanceChecklist = () => (
  <AppendixReferencePage pageId="appendix-i-performance-checklist" />
)

export const PageAppendixJRecommendedCratesByTopic = () => (
  <AppendixReferencePage pageId="appendix-j-recommended-crates-by-topic" />
)

export const PageAppendixKGlossaryOfRustTerms = () => (
  <AppendixReferencePage pageId="appendix-k-glossary-of-rust-terms" />
)

export const PageAppendixLSuggestedReadingPathByBackground = () => (
  <AppendixReferencePage pageId="appendix-l-suggested-reading-path-by-background" />
)

export const PageAppendixMRustWebServicesAndApiContractChecklist = () => (
  <AppendixReferencePage pageId="appendix-m-rust-web-services-and-api-contract-checklist" />
)

export const PageAppendixNZkpZoKratesAndZkmlProductionCaveats = () => (
  <AppendixReferencePage pageId="appendix-n-zkp-zokrates-and-zkml-production-caveats" />
)

export const PageAppendixONoStdRustPortabilityAndAuditChecklist = () => (
  <AppendixReferencePage pageId="appendix-o-no-std-rust-portability-and-audit-checklist" />
)
