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
    title: "FFI is a compiler boundary, not a style preference",
    body: "Rust and C++ do not share one stable language ABI. A production interop layer is therefore a contract boundary: calling convention, layout, ownership, lifetime, and unwind policy must all be stated explicitly.",
  },
  {
    title: "The calm default is a narrow C ABI seam",
    body: "Even when the far side is C++, the most stable public seam is usually C ABI plus explicit wrappers. Direct C++ interop can be excellent when both sides are curated together, but raw C++ object layout and exceptions are not a portable ABI story.",
  },
  {
    title: "Ownership must be flattened into buffers, handles, and free functions",
    body: "Rust references, `String`, `Vec<T>`, `Result`, trait objects, and panics are great inside Rust. At the foreign edge, they usually become raw pointers, lengths, status codes, opaque handles, and explicit destruction functions.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You already know RAII, object layout risk, and the pain of ABI drift across compiler settings. Rust helps by making the unsafe boundary explicit, but the calm design is still the same: keep the seam small, flatten ownership, and treat unwinding as radioactive at the boundary.",
  },
  {
    title: "C# background",
    body: "Think less in terms of automatic marshalling and more in terms of explicit contracts. Rust does not assume a managed runtime will rescue lifetime or exception mismatches. The wrapper layer must state them directly.",
  },
  {
    title: "Go background",
    body: "The closest comparison is cgo discipline: the foreign edge wants explicit ownership and clear data movement. Rust goes further by making aliasing and panic rules part of the type and unsafe model.",
  },
]

const ffiFundamentals = [
  "Use `extern \"C\"` to pin the calling convention at the seam.",
  "Use `#[repr(C)]` on shared structs whose layout must be understood by foreign code.",
  "Keep the foreign edge `unsafe` from Rust's point of view, then rebuild a smaller safe wrapper on the Rust side.",
  "Prefer fixed-width integers, raw pointers, lengths, and status codes at the ABI surface.",
]

const cAbiBoundaryRules = [
  "Do not export Rust references like `&T`, `&mut T`, `&str`, or slices directly as a public C ABI contract.",
  "Do not export `String`, `Vec<T>`, `Box<T>`, trait objects, generics, or `Result<T, E>` as foreign-facing ABI surface types.",
  "For the most conservative status boundary, prefer integer status codes over Rust enums unless the exact layout contract is pinned and audited.",
  "When the far side is C++, remember that raw C++ class ABI is not portable across all compilers and standard libraries. A C shim is often the calmer seam.",
]

const ownershipCards = [
  {
    title: "Borrowed input buffers",
    body: "Use `*const T` plus `len` when the caller owns the memory and Rust only needs a temporary read-only view during the call.",
  },
  {
    title: "Caller-allocated output buffers",
    body: "Use `*mut T` plus capacity when the caller owns storage and Rust fills it. Return a status code and, if needed, a written-length out parameter.",
  },
  {
    title: "Callee-owned opaque handles",
    body: "Use `*mut OpaqueType` plus explicit `new` and `free` functions when Rust should own an object across calls. Treat the pointer as an opaque token on the foreign side.",
  },
  {
    title: "Owned strings across the seam",
    body: "If Rust allocates a string for foreign code, pair the returned pointer with one explicit free function. If the foreign side provides a string, accept a C string pointer or explicit bytes plus length and validate at the edge.",
  },
]

const errorHandlingCards = [
  {
    title: "Status codes",
    body: "The most portable pattern is `0 = ok, nonzero = failure` with documented meanings. This is boring, and boring is good at ABI boundaries.",
  },
  {
    title: "Out parameters",
    body: "Return complex success data through caller-provided output pointers or buffers after validating nullability and capacity.",
  },
  {
    title: "Structured error payloads",
    body: "When an integration needs richer diagnostics, return a status plus an error buffer, or expose a separate function to inspect the last error on an opaque handle.",
  },
  {
    title: "No `Result` across FFI",
    body: "Keep `Result<T, E>` inside Rust. Translate it at the seam into a C-facing status contract another compiler can understand.",
  },
]

const unwindRules = [
  "Do not let a Rust panic unwind into C or C++ code.",
  "Do not let a C++ exception enter Rust frames unless you have a deliberately designed specialized boundary and a toolchain contract that supports it.",
  "The conservative production rule is simpler: normalize both sides to no cross-language unwinding at all.",
  "If the Rust side must survive panics, catch at the outer exported function and translate to a status code or abort policy explicitly.",
]

const ecosystemCards = [
  {
    title: "bindgen",
    body: "Use `bindgen` when headers already exist and the primary job is to generate Rust declarations from a C or C-like surface. Then wrap the raw layer in narrower Rust APIs.",
  },
  {
    title: "cxx",
    body: "Use `cxx` when you control both sides and want a more curated Rust/C++ bridge with supported types and an explicit shared bridge module instead of a raw universal header dump.",
  },
  {
    title: "autocxx",
    body: "Use `autocxx` when the C++ surface is larger and you want more automation on top of generated bindings. Keep auditing discipline; generated surface area is still surface area.",
  },
]

const abiStabilityRules = [
  "Rust's native ABI is not the thing you publish to C or C++ callers.",
  "Pin layout with `#[repr(C)]` where shared structs cross the seam.",
  "Prefer fixed-width integer types and explicit pointer-plus-length contracts over clever language-level types.",
  "Version functions, structs, or envelopes when the contract evolves. Do not redefine field meaning in place and hope mixed deployments stay kind.",
  "Hide internal Rust data structures behind opaque handles when you want freedom to change internals later.",
]

const testingChecklist = [
  "Unit test the safe Rust wrapper separately from the raw ABI layer.",
  "Add at least one direct foreign-caller integration test or harness in CI for exported symbols.",
  "Test null pointers, zero lengths, oversized lengths, and free-after-free or double-free defenses where the contract requires them.",
  "Run sanitizers on the native boundary where possible: AddressSanitizer, UndefinedBehaviorSanitizer, and ThreadSanitizer are often worth the setup cost.",
  "Use Miri for Rust-side undefined-behavior checks inside the wrapper logic, with the understanding that arbitrary foreign code is outside Miri's world.",
  "Fuzz the boundary if the seam parses attacker-controlled bytes or strings.",
]

const productionPatterns = [
  "Keep one tiny `extern \"C\"` surface over a larger safe Rust core. The more code lives outside the raw ABI edge, the easier it is to review and evolve.",
  "Model ownership with handles, pointer-plus-length pairs, and explicit `free` functions rather than with wishful comments about who probably owns the memory.",
  "Translate foreign-facing status codes into ordinary Rust `Result` values as soon as control re-enters safe Rust.",
  "Choose a C shim or `cxx` bridge deliberately. Do not let raw C++ ABI assumptions leak all the way into the public contract by accident.",
  "Log and test unwind policy explicitly. A panic or exception policy that lives only in tribal memory is not a policy.",
]

const pitfalls = [
  "Exporting `String`, `Vec<T>`, or references directly because they looked convenient in Rust. They are not a portable foreign contract.",
  "Treating a raw pointer as proof of ownership or lifetime. A raw pointer is only an address-shaped token until the wrapper proves more.",
  "Forgetting that a duplicated OS handle or opaque pointer changes semantics. It is not the same thing as borrowing.",
  "Letting Rust panics or C++ exceptions cross the boundary because the happy path seemed fine in testing.",
  "Publishing a wide generated binding surface as the real API instead of wrapping it in a narrower, stable interop layer.",
]

export function PageCh28CppIntegration() {
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
  const pageIndex = 54
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
          Chapter 28 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Native-library integration is a production boundary with ABI, ownership, memory layout, unwind, and error
          translation requirements. This chapter defines Rust wrapper patterns for that boundary.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 08, 09, and 17</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 08 established unsafe Rust and explicit invariants. Chapter 09 covered raw-pointer-adjacent
                ownership tools such as <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Box</code>,{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Arc</code>, and pinning. Chapter 17
                showed how to refactor toward honest boundaries. C++ integration is where all three become operational.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(14)}>
                Chapter 08
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(16)}>
                Chapter 09
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(32)}>
                Chapter 17
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A product is replacing one hot native subsystem with Rust while keeping an existing host process, plugin
            loader, and native test harness. The business requirement is a narrow ABI contract with explicit layout,
            pointer validity, memory ownership, status-code errors, and no cross-language unwinding.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A reliable decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Flatten the seam to a C ABI contract unless you have a strong reason for a richer direct C++ bridge.</li>
              <li>State ownership in raw terms: pointer plus length, caller-allocated buffer, or opaque handle.</li>
              <li>Translate errors to status codes or explicit error payloads.</li>
              <li>Ban cross-language unwinding and test the wrapper as a first-class subsystem.</li>
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
            <h4 className="font-semibold text-foreground mb-3">Rust FFI fundamentals</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              {ffiFundamentals.map((item) => (
                <div key={item} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">C ABI boundaries</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              {cAbiBoundaryRules.map((rule) => (
                <div key={rule} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{rule}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A useful correction for C++ teams is this: “C++ integration” often still means “a deliberate C ABI seam
                around C++ code.” That seam buys you a smaller contract surface and fewer compiler- and standard-library
                assumptions.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Calling C from Rust</h4>
            <p className="text-sm text-muted-foreground leading-6">
              The Rust side declares foreign symbols with <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">extern "C"</code>,
              then wraps the unsafe call in a smaller safe function if the contract is simple enough to justify that move.
              In a real Cargo build, the native library is linked through build-system configuration. In this chapter's
              runnable demo, the symbol is defined in Rust with the C ABI so the example stays self-contained.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Calling Rust from C and C++</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Export a deliberately tiny surface: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">extern "C"</code>{" "}
              functions, C-friendly layout for shared structs, raw buffers or opaque handles for ownership, and explicit
              destroy functions for anything Rust allocates and foreign code later frees. The library artifact is usually
              built as a C-facing static or dynamic library rather than as a Rust ABI artifact.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Ownership across FFI</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {ownershipCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                Rust references make aliasing and lifetime promises the C or C++ side usually cannot honor directly. That
                is why a senior FFI surface tends to flatten everything into raw pointers, lengths, handles, and explicit
                ownership functions.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Error handling across FFI</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {errorHandlingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Exceptions and panics</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {unwindRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                The conservative rule is also the most operable one: no cross-language unwinding. Translate failure to an
                integer status or explicit error object before control crosses the boundary.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">cxx, bindgen, and autocxx</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {ecosystemCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">ABI stability</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              {abiStabilityRules.map((rule) => (
                <div key={rule} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{rule}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Testing and sanitizing FFI layers</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              {testingChecklist.map((item) => (
                <div key={item} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{item}</p>
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
                The most expensive FFI bug is rarely a missing semicolon in the header. It is a boundary that looked
                simple, but never actually said who owns the memory, who catches the panic, or which compiler contract is
                supposed to stay stable over time.
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
                <h4 className="font-semibold text-foreground">Example 1: call a C ABI symbol from Rust through a safe wrapper</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The demo keeps the symbol self-contained by defining it in Rust with the C ABI, then calling it through
                  an <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">extern "C"</code> declaration as
                  if it came from native code. Even a trivial exported function needs a panic policy at the boundary: the
                  body uses <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">wrapping_abs</code> so an
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]"> i32::MIN</code> input cannot panic
                  across the C ABI seam.
                </p>
              </div>
              {codes.cpp_integration_calling_c_abi !== DEFAULT_CODES.cpp_integration_calling_c_abi && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("cpp_integration_calling_c_abi")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.cpp_integration_calling_c_abi}
              onChange={(newCode) => updateCode("cpp_integration_calling_c_abi", newCode)}
              onRun={() => runCode("cpp_integration_calling_c_abi")}
              output={outputs.cpp_integration_calling_c_abi ?? null}
              isRunning={isRunning === "cpp_integration_calling_c_abi"}
              filename="calling_c_from_rust.rs"
              expectedOutput={"abs(-7) = 7\nabs(11) = 11"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.cpp_integration_calling_c_abi}
              onRevert={() => resetCode("cpp_integration_calling_c_abi")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Unsafe boundary</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The raw call stays in one small wrapper instead of leaking through the rest of the codebase.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">ABI surface</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The seam is plain <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">i32 -&gt; i32</code>,
                  so no ownership transfer is required.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Real translation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  In production, the same wrapper pattern works when the symbol really comes from a C or C++ library.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: export a Rust function with a C ABI-safe wrapper</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The exported entry point uses raw pointers, length, an out parameter, integer status codes, and explicit
                  null checks. The richer Rust model can stay behind this seam.
                </p>
              </div>
              {codes.cpp_integration_export_rust_c_abi !== DEFAULT_CODES.cpp_integration_export_rust_c_abi && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("cpp_integration_export_rust_c_abi")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.cpp_integration_export_rust_c_abi}
              onChange={(newCode) => updateCode("cpp_integration_export_rust_c_abi", newCode)}
              onRun={() => runCode("cpp_integration_export_rust_c_abi")}
              output={outputs.cpp_integration_export_rust_c_abi ?? null}
              isRunning={isRunning === "cpp_integration_export_rust_c_abi"}
              filename="exporting_rust_c_abi.rs"
              expectedOutput={"status = 0\ntotal = 12"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.cpp_integration_export_rust_c_abi}
              onRevert={() => resetCode("cpp_integration_export_rust_c_abi")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Pointers</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The foreign edge speaks in raw addresses and sizes, not Rust references.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Ownership</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The caller owns the input array and the output storage. Rust only borrows both for the duration of the call.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Errors</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Status integers make the contract portable without leaking Rust&apos;s `Result` shape.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Extensibility</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The same pattern extends naturally to opaque handles, caller buffers, and explicit free functions.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">examples/ch28_cpp_integration/</code>.
              That directory includes a small opaque-handle example alongside the two editor labs so the ownership patterns
              can be reviewed outside the browser.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to flatten higher-level Rust types into a C ABI-safe surface, map ownership
            across the seam, build a wrapper around a Rust function, and choose between a C shim, generated bindings, and a
            curated Rust/C++ bridge for a legacy codebase.
          </p>
          <Button onClick={() => setCurrentPage(55)} className="gap-2">
            Open Chapter 28 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>FFI is a contract boundary. ABI, layout, ownership, and unwind policy must all be explicit.</li>
            <li>A narrow C ABI seam is usually the most stable integration layer even when the far side is C++.</li>
            <li>Rust references, `String`, `Vec<T>`, `Result`, and panics normally stop at the Rust side of the wrapper.</li>
            <li>`bindgen`, `cxx`, and `autocxx` are ecosystem options, not excuses to skip wrapper design.</li>
            <li>Testing the interop layer means more than “it linked once.” Include null, length, ownership, sanitizer, and harness coverage.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
````

### File: `components/rust-book/pages/page-ch28-cpp-integration-exercises.tsx`
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
    title: "Flatten a rich API into a C ABI surface deliberately",
    objective: "Practice turning Rust- or C++-friendly types into a boundary another compiler can actually trust.",
    starterPrompt:
      "A C++ caller wants to invoke Rust logic that currently looks like `fn classify(input: &str) -> Result<String, DomainError>`.",
    prompts: [
      "Which input shape is calmer at the ABI edge: C string, bytes plus length, or caller-owned output buffer?",
      "How would you represent success and failure without exposing `Result`?",
      "If Rust allocates an output string, which extra function must exist?",
    ],
    acceptanceCriteria: [
      "You remove Rust references and `Result` from the foreign-facing surface.",
      "You choose an explicit input and output ownership model.",
      "You name at least one free or destroy function if the callee allocates returned data.",
    ],
    hints: [
      "The question is not what is ergonomic in Rust. The question is what is explicit across the ABI seam.",
      "Status code plus out parameter is often the calmest first answer.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Spot the non-ABI-safe types in one exported function",
    objective: "Read an exported signature and explain exactly why it is not a production-grade foreign contract yet.",
    starterPrompt:
      "Review `pub extern \"C\" fn parse_order(input: &str) -> Result<String, ParseError>` and write a short review note.",
    prompts: [
      "Why is `&str` the wrong foreign contract here?",
      "Why is `Result<String, ParseError>` the wrong foreign contract here?",
      "Which concrete replacement types would you propose?",
    ],
    acceptanceCriteria: [
      "You explain that Rust references and `Result` are Rust-side abstractions, not portable ABI surface types.",
      "You propose a replacement such as pointer plus length, status code, out parameter, or opaque handle.",
      "You describe the repair in ownership terms, not only in syntax terms.",
    ],
    hints: [
      "If the far side is not Rust, act as if the type must survive a compiler translation audit.",
      "The best review note names both the wrong type and the replacement contract.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Design a C ABI-safe wrapper around Rust code",
    objective: "Implement a small exported function that translates a raw pointer contract into a safe Rust slice and a status code.",
    starterPrompt:
      "Implement `sum_i32s(ptr, len, out_total) -> i32` so null checks happen first, the slice is rebuilt once, and the total is written through the out parameter.",
    prompts: [
      "Use `*const i32`, `usize`, and `*mut i64` at the edge.",
      "Return `0` on success and nonzero status codes for invalid pointers.",
      "Keep the unsafe region small and auditable.",
    ],
    acceptanceCriteria: [
      "The wrapper checks nullability before dereferencing raw pointers.",
      "The wrapper rebuilds a slice only after the safety preconditions are true.",
      "The wrapper writes the result through the out parameter and returns an explicit status code.",
      "The runnable lab prints the expected status and total.",
    ],
    hints: [
      "This is the core exported-function shape many FFI wrappers use.",
      "The slice rebuild is the unsafe step; the contract checks should already be finished by then.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Map ownership across an opaque-handle API",
    objective: "Repair a boundary where both sides believe they own the same allocation or returned string.",
    starterPrompt:
      "You inherit a handle API where Rust returns an owned parser handle and later returns an owned string pointer from `parser_format`, but the free path is missing or ambiguous.",
    prompts: [
      "Which side owns the parser after `parser_new` returns?",
      "Which side owns the returned string after `parser_format` returns?",
      "Which explicit destroy functions must exist, and what happens on null input?",
    ],
    acceptanceCriteria: [
      "You describe ownership for both the handle and the returned string precisely.",
      "You add or specify one destroy function per owned foreign-returned resource.",
      "You explain what null means on each relevant path instead of leaving it implicit.",
    ],
    hints: [
      "Opaque handles are great, but only when creation and destruction are equally explicit.",
      "Two separate owned resource kinds often want two separate free functions.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Create an FFI safety checklist for one sample function",
    objective: "Write the review checklist another engineer would use before approving the boundary.",
    starterPrompt:
      "Create a checklist for `sum_i32s(ptr: *const i32, len: usize, out_total: *mut i64) -> i32`.",
    prompts: [
      "What must be true about `ptr` before calling `from_raw_parts`, even when `len == 0`?",
      "What must be true about `out_total` before writing?",
      "What unwind rule should the wrapper follow?",
      "What tests or sanitizer runs should exist?",
    ],
    acceptanceCriteria: [
      "Your checklist covers nullability, readable and writable memory, length contract, and unwind policy.",
      "Your checklist includes at least one testing item and one sanitizer item.",
      "Your checklist is specific enough to review one real function, not only FFI in the abstract.",
    ],
    hints: [
      "A good checklist sounds like a release gate, not like a slogan list.",
      "The point is to make review mechanical where possible.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose C shim, bindgen, cxx, or autocxx for a legacy codebase",
    objective: "Map one realistic C++ integration problem to the right interop strategy and testing plan.",
    starterPrompt:
      "You must integrate a large legacy C++ library with templates, exceptions, custom allocators, and a small stable subset of functions the Rust side actually needs.",
    prompts: [
      "Where would a narrow handwritten C shim be calmer than binding the whole C++ surface directly?",
      "When would `bindgen` be enough, and when would `cxx` be a better fit?",
      "When might `autocxx` save time, and what risk would still need audit coverage?",
      "What harness, sanitizer, and compatibility tests would you require before rollout?",
    ],
    acceptanceCriteria: [
      "You choose one primary interop strategy and justify it with surface shape and change risk.",
      "You name at least one case where a narrower C ABI seam is calmer than wide direct C++ exposure.",
      "You mention at least one testing layer and one sanitizer or native harness requirement.",
      "You keep exception and ownership policy explicit in the design.",
    ],
    hints: [
      "A big existing header surface is not automatically a good public surface for Rust.",
      "The best answer narrows the contract to what the Rust side truly needs.",
    ],
  },
]

const reviewQuestions = [
  "Why is a narrow C ABI seam often calmer than a direct raw C++ ABI contract?",
  "What is the practical difference between a borrowed input buffer and a returned opaque handle?",
  "Why should `Result<T, E>` usually stop at the Rust side of the wrapper?",
  "What rule should exported functions follow for panics and C++ exceptions?",
  "When is generated binding surface still too wide to be your real API?",
]

const workingLoop = [
  "Flatten the boundary into raw data, sizes, status codes, and explicit ownership.",
  "Write the safety invariant before the unsafe block.",
  "Keep one clear create/free path for each owned resource kind.",
  "Ban cross-language unwinding and make that choice visible in code review.",
  "Test nulls, lengths, free paths, and native harness behavior before rollout.",
]

const ffiChecklist = [
  "Calling convention pinned with `extern \"C\"`.",
  "Layout pinned with `#[repr(C)]` only where shared structs truly cross the seam.",
  "Nullability rules documented for every pointer parameter.",
  "Readable and writable memory promises stated for every pointer plus length pair.",
  "Panic and exception policy explicit: no cross-language unwinding.",
  "Destroy functions present for every foreign-observable owned resource.",
]

export function PageCh28CppIntegrationExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = 55
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 28 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice C++ integration the way it survives production review: narrow ABI seams, explicit ownership, structured
          error paths, and safety checklists that another engineer can actually use.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as an interop review. The best answer does not say only “use FFI.” It says which ABI
                surface is exposed, who owns memory on each side, how failure is represented, and which invariants must be
                true before raw pointers become meaningful.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(54)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 28
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

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">FFI wrapper checklist</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {ffiChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
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
                  FFI design drill
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
          title="Runnable lab · C ABI-safe sum wrapper"
          description={
            <>
              Repair the starter so the exported wrapper checks pointer contracts, rebuilds a slice safely, and writes the
              computed total through the out parameter. The checker expects a successful status code and a total of{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">21</code>.
            </>
          }
          filename="ffi_sum_wrapper_lab.rs"
          runKey="ch28_ex_ffi_sum_wrapper"
          expectedOutput={"status = 0\ntotal = 21"}
          helperText={
            <>
              Tip: check <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">out_total</code> first, reject
              a null <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">ptr</code> unconditionally because{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">from_raw_parts</code> needs a non-null
              pointer even for a zero-length slice, then rebuild the slice once and keep the unsafe region small.
            </>
          }
          initialCode={`#[unsafe(no_mangle)]\npub extern "C" fn sum_i32s(ptr: *const i32, len: usize, out_total: *mut i64) -> i32 {\n    unsafe {\n        *out_total = 0;\n    }\n\n    0\n}\n\nfn main() {\n    let values = [4_i32, 7, 10];\n    let mut total = -1_i64;\n\n    let status = sum_i32s(values.as_ptr(), values.len(), &mut total);\n\n    println!(\"status = {}\", status);\n    println!(\"total = {}\", total);\n}`}
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
            By the end of this page, you should be able to design a narrow C ABI-safe wrapper around Rust code, map
            ownership across a Rust/C++ seam without hand-waving, write a practical FFI review checklist, and choose a
            direct bridge or a C shim from the real change surface and failure model rather than from ecosystem fashion.
          </p>
        </section>
      </div>
    </div>
  )
}
````

### File: `examples/ch28_cpp_integration/calling_c_from_rust.rs`
````
mod c_shim {
    #[unsafe(no_mangle)]
    pub extern "C" fn ffi_demo_abs(input: i32) -> i32 {
        input.wrapping_abs()
    }
}

unsafe extern "C" {
    fn ffi_demo_abs(input: i32) -> i32;
}

fn safe_abs(input: i32) -> i32 {
    unsafe {
        // SAFETY:
        // - ffi_demo_abs uses the C ABI.
        // - the function takes and returns plain integers.
        // - this call has no cross-language ownership or lifetime transfer.
        ffi_demo_abs(input)
    }
}

fn main() {
    let left = -7_i32;
    let right = 11_i32;

    println!("abs({}) = {}", left, safe_abs(left));
    println!("abs({}) = {}", right, safe_abs(right));
}
````

### File: `examples/ch28_cpp_integration/exporting_rust_c_abi.rs`
````
#[unsafe(no_mangle)]
pub extern "C" fn sum_i32s(ptr: *const i32, len: usize, out_total: *mut i64) -> i32 {
    if out_total.is_null() {
        return 1;
    }

    if ptr.is_null() {
        return 2;
    }

    let slice = unsafe {
        // SAFETY:
        // - ptr is non-null and the caller promises it is valid for len i32 values.
        // - the caller retains ownership of the input buffer.
        // - from_raw_parts requires a non-null, aligned pointer even when len == 0.
        std::slice::from_raw_parts(ptr, len)
    };

    let total = slice.iter().map(|&value| value as i64).sum::<i64>();

    unsafe {
        // SAFETY:
        // - out_total was checked for null above.
        // - the caller promises this points to writable i64 storage.
        *out_total = total;
    }

    0
}

fn main() {
    let values = [3_i32, 4, 5];
    let mut total = -1_i64;

    let status = sum_i32s(values.as_ptr(), values.len(), &mut total);

    println!("status = {}", status);
    println!("total = {}", total);
}
````

### File: `examples/ch28_cpp_integration/opaque_handle_api.rs`
````
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::ptr;

struct Formatter {
    prefix: String,
}

#[unsafe(no_mangle)]
pub extern "C" fn formatter_new(prefix: *const c_char) -> *mut Formatter {
    if prefix.is_null() {
        return ptr::null_mut();
    }

    let prefix = unsafe {
        // SAFETY:
        // - prefix was checked for null above.
        // - the caller promises a valid NUL-terminated string.
        CStr::from_ptr(prefix)
    };

    let Ok(prefix_text) = prefix.to_str() else {
        return ptr::null_mut();
    };

    Box::into_raw(Box::new(Formatter {
        prefix: prefix_text.to_string(),
    }))
}

#[unsafe(no_mangle)]
pub extern "C" fn formatter_format(
    formatter: *const Formatter,
    value: *const c_char,
) -> *mut c_char {
    if formatter.is_null() || value.is_null() {
        return ptr::null_mut();
    }

    let formatter = unsafe {
        // SAFETY:
        // - formatter was checked for null above.
        // - the caller promises it points to a live Formatter from formatter_new.
        &*formatter
    };

    let value = unsafe {
        // SAFETY:
        // - value was checked for null above.
        // - the caller promises a valid NUL-terminated string.
        CStr::from_ptr(value)
    };

    let Ok(value_text) = value.to_str() else {
        return ptr::null_mut();
    };

    let rendered = format!("{}::{}", formatter.prefix, value_text);
    match CString::new(rendered) {
        Ok(text) => text.into_raw(),
        Err(_) => ptr::null_mut(),
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn formatter_string_free(text: *mut c_char) {
    if text.is_null() {
        return;
    }

    unsafe {
        // SAFETY:
        // - text must come from CString::into_raw in formatter_format.
        drop(CString::from_raw(text));
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn formatter_free(formatter: *mut Formatter) {
    if formatter.is_null() {
        return;
    }

    unsafe {
        // SAFETY:
        // - formatter must come from Box::into_raw in formatter_new.
        drop(Box::from_raw(formatter));
    }
}

fn main() {
    let prefix = CString::new("svc").unwrap();
    let value = CString::new("orders").unwrap();

    let formatter = formatter_new(prefix.as_ptr());
    let rendered = formatter_format(formatter, value.as_ptr());

    let text = unsafe { CStr::from_ptr(rendered) }.to_str().unwrap();
    println!("label = {}", text);

    formatter_string_free(rendered);
    formatter_free(formatter);
}
````

### File: `components/rust-book/pages/index.ts`
````diff
--- components/rust-book/pages/index.ts
+++ components/rust-book/pages/index.ts
@@ -52,3 +52,5 @@ export { PageCh25TokioExercises } from "./page-ch25-tokio-exercises"
 export { PageCh26TaskLibrariesAndParallelExecution } from "./page-ch26-task-libraries-and-parallel-execution"
 export { PageCh26TaskLibrariesAndParallelExecutionExercises } from "./page-ch26-task-libraries-and-parallel-execution-exercises"
 export { PageCh27IoTricksAndSystemsProgrammingPatterns } from "./page-ch27-io-tricks-and-systems-programming-patterns"
 export { PageCh27IoTricksAndSystemsProgrammingPatternsExercises } from "./page-ch27-io-tricks-and-systems-programming-patterns-exercises"
+export { PageCh28CppIntegration } from "./page-ch28-cpp-integration"
+export { PageCh28CppIntegrationExercises } from "./page-ch28-cpp-integration-exercises"
````

### File: `components/rust-book/index.tsx`
````diff
--- components/rust-book/index.tsx
+++ components/rust-book/index.tsx
@@ -63,6 +63,8 @@ import {
   PageCh25TokioExercises,
   PageCh26TaskLibrariesAndParallelExecution,
   PageCh26TaskLibrariesAndParallelExecutionExercises,
   PageCh27IoTricksAndSystemsProgrammingPatterns,
   PageCh27IoTricksAndSystemsProgrammingPatternsExercises,
+  PageCh28CppIntegration,
+  PageCh28CppIntegrationExercises,
 } from "./pages"
 
 const PAGE_COMPONENTS = [
@@ -120,6 +122,8 @@ const PAGE_COMPONENTS = [
   PageCh25TokioExercises,
   PageCh26TaskLibrariesAndParallelExecution,
   PageCh26TaskLibrariesAndParallelExecutionExercises,
   PageCh27IoTricksAndSystemsProgrammingPatterns,
   PageCh27IoTricksAndSystemsProgrammingPatternsExercises,
+  PageCh28CppIntegration,
+  PageCh28CppIntegrationExercises,
 ]
 
 function BookContent() {
````

### File: `components/rust-book/rust-simulator.ts`
````diff
--- components/rust-book/rust-simulator.ts
+++ components/rust-book/rust-simulator.ts
@@ -1,3 +1,4 @@
+import { simulateCh28Output } from "./rust-simulator-ch28"
 import { simulateCh27Output } from "./rust-simulator-ch27"
 import { simulateCh26Output } from "./rust-simulator-ch26"
 import { simulateCh25Output } from "./rust-simulator-ch25"
@@ -1005,6 +1006,9 @@ function findCompilationError(code: string, filename: string): string | null {
 export function simulateRustExecution(code: string, key?: string, filename = "main.rs"): string {
   const compilationError = findCompilationError(code, filename)
   if (compilationError) return compilationError
+
+  const ch28Output = simulateCh28Output(code, key)
+  if (ch28Output !== null) return ch28Output
 
   const ch27Output = simulateCh27Output(code, key)
   if (ch27Output !== null) return ch27Output
@@ -1422,5 +1426,18 @@ export function simulateRustExecution(code: string, key?: string, filename = "ma
 
     return "short = Ok(())\nvalue = Ok(())\nbuf = RST!"
   }
 
+  if (key === "ch28_ex_ffi_sum_wrapper") {
+    const values = Array.from(code.matchAll(/let\s+values\s*=\s*\[([^\]]+)\]/g), (match) => match[1])[0]
+      ?.split(",")
+      .map((part) => Number(part.trim().replace(/_/g, "").replace(/(?:i|u)(?:8|16|32|64|128|size)$/i, "")))
+      .filter((value) => !Number.isNaN(value)) ?? [4, 7, 10]
+    const safeWrapper =
+      /out_total\.is_null\(\)/.test(code) &&
+      /ptr\.is_null\(\)\s*&&\s*len\s*!=\s*0/.test(code) &&
+      /from_raw_parts\(\s*ptr\s*,\s*len\s*\)/.test(code) &&
+      /sum::<i64>\(\)/.test(code) &&
+      /\*\s*out_total\s*=\s*total/.test(code)
+    return `status = ${safeWrapper ? 0 : 1}\ntotal = ${safeWrapper ? values.reduce((acc, value) => acc + value, 0) : -1}`
+  }
+
   const printlnRegex = /println!\s*\(\s*"([^"]*)"(?:\s*,\s*([^)]+))?\s*\)/g
   const outputs: string[] = []
````

### File: `components/rust-book/types.ts`
````diff
--- components/rust-book/types.ts
+++ components/rust-book/types.ts
@@ -17,6 +17,7 @@ import { DEFAULT_CODES_CH24 } from "./default-codes-ch24"
 import { DEFAULT_CODES_CH25 } from "./default-codes-ch25"
 import { DEFAULT_CODES_CH26 } from "./default-codes-ch26"
 import { DEFAULT_CODES_CH27 } from "./default-codes-ch27"
+import { DEFAULT_CODES_CH28 } from "./default-codes-ch28"
 
 export interface PageConfig {
   id: string
@@ -684,6 +685,29 @@ export const CHAPTERS: ChapterConfig[] = [
         description:
           "Compare buffered and unbuffered reads, design a backpressure-aware IO pipeline, and reason clearly about descriptor ownership",
         icon: "trophy",
+      },
+    ],
+  },
+  {
+    id: "ch28-cpp-integration",
+    title: "Chapter 28 · C++ Integration",
+    icon: "book",
+    pages: [
+      {
+        id: "ch28-cpp-integration",
+        title: "C++ Integration",
+        shortTitle: "C++ Integration",
+        description:
+          "Rust FFI fundamentals, C ABI seams, calling C from Rust, exporting Rust to C and C++, ownership, error handling, unwind policy, ABI stability, and FFI testing",
+        icon: "book",
+        codeKeys: ["cpp_integration_calling_c_abi", "cpp_integration_export_rust_c_abi"],
+      },
+      {
+        id: "ch28-cpp-integration-exercises",
+        title: "Chapter 28 Exercises",
+        shortTitle: "Exercises",
+        description:
+          "Design a C ABI-safe wrapper, map ownership across the seam, create an FFI safety checklist, and choose the right interop strategy",
+        icon: "trophy",
       },
     ],
   },
@@ -1128,5 +1152,6 @@ export const DEFAULT_CODES: Record<string, string> = {
   ...DEFAULT_CODES_CH25,
   ...DEFAULT_CODES_CH26,
   ...DEFAULT_CODES_CH27,
+  ...DEFAULT_CODES_CH28,
 }
 
 export interface BookState {
````