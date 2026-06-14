"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Bug,
  Cpu,
  Shield,
  TriangleAlert,
  Wrench,
} from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "Unsafe narrows the compiler's proof; it does not relax the requirements",
    body: "An `unsafe` block lets you perform operations the compiler cannot prove correct on its own. It does not make those operations correct. The safety obligations still exist; they simply move into human-audited invariants.",
  },
  {
    title: "Undefined behavior lets the optimizer assume the code is impossible, not a guaranteed crash",
    body: "If code reaches UB, the language no longer promises sensible results. You might see a crash, silent corruption, or behavior that changes between optimization levels and platforms. 'It worked in testing' is not a defense.",
  },
  {
    title: "The right target is usually a safe API over a tiny unsafe core",
    body: "Most production Rust code should expose safe functions, structs, and traits while hiding a small `unsafe` implementation detail behind explicit checks, ownership boundaries, and documented invariants.",
  },
]

const ubCards = [
  {
    title: "Invalid pointer access",
    body: "Dereferencing a dangling, null, misaligned, or out-of-bounds raw pointer is UB. Creating a raw pointer is safe; dereferencing it is where the burden begins.",
  },
  {
    title: "Reference aliasing violations",
    body: "References carry promises. `&T` promises shared read access. `&mut T` promises exclusive mutable access. Violating those promises through unsafe code is UB even if the machine seems to tolerate it.",
  },
  {
    title: "Data races",
    body: "In Rust, a data race is UB. Safe Rust prevents it. Unsafe code can recreate it by aliasing mutable access or sharing state across threads without synchronization.",
  },
  {
    title: "Uninitialized or invalid values",
    body: "Reading uninitialized memory as a real `T`, or constructing impossible values for a type, is UB. A reference must be valid. A `bool` must be 0 or 1. Many enums have invalid bit patterns too.",
  },
  {
    title: "FFI contract mismatches",
    body: "Wrong ABI, wrong ownership transfer, bad lifetimes, bad nullability assumptions, or invalid layout expectations across C boundaries can all become UB quickly.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "The familiar part is that UB still exists and aliasing rules still matter. The important difference is cultural and structural: Rust makes `unsafe` an explicit, reviewable boundary rather than the ambient default mode of systems code.",
  },
  {
    title: "C# background",
    body: "Rust's safe subset is stronger than a managed runtime with ordinary unsafe escape hatches, because the default model already encodes ownership, aliasing, and thread-safety constraints. Unsafe Rust is closer to entering a manual proof obligation than simply opting out of bounds checks.",
  },
  {
    title: "Go background",
    body: "Go hides many memory details until they matter. Rust asks you to model them earlier. Safe Rust removes data races from ordinary code; unsafe code can reintroduce them, which is why the boundary must stay narrow and explicit.",
  },
]

const unsafePowers = [
  "Dereference raw pointers such as `*const T` and `*mut T`.",
  "Call `unsafe fn` and `unsafe` methods whose preconditions the compiler cannot verify.",
  "Access union fields.",
  "Read or write mutable statics.",
  "Implement unsafe traits.",
]

const auditChecklist = [
  "State the invariant in concrete terms: bounds, alignment, initialization, aliasing, lifetime, and thread assumptions.",
  "Keep the `unsafe` region as small as possible so reviewers can see exactly what must be justified.",
  "Decide whether the obligation belongs to the caller or the callee. If callers must uphold it, the API should usually be `unsafe fn`.",
  "Check panic and drop behavior. `ptr::write` skips the old value's destructor. Partial initialization needs a cleanup story.",
  "Test the safe boundary, not only the happy path. Add debug assertions, fuzz inputs where useful, and use tools such as Miri or sanitizers when available.",
]

const productionPatterns = [
  "Prefer safe public APIs with local `unsafe` internals only when measurement or representation constraints justify it.",
  "Write a `// SAFETY:` comment for each unsafe block. Treat it as part of the code, not decoration.",
  "Use raw pointers for short, local, representation-sensitive work. Convert back to references only after re-establishing Rust's guarantees.",
  "Reach for `MaybeUninit<T>` when storage is genuinely not initialized yet. Do not fake partial initialization with arbitrary bytes or early `assume_init`.",
  "At FFI boundaries, translate C contracts into Rust types immediately: nullability to `Option`, status codes to `Result`, owned buffers to owning Rust types, and borrowed views to explicit lifetimes.",
]

const pitfalls = [
  "Using `unsafe` as a borrow-checker bypass instead of redesign feedback. That only trades a compiler error for a future incident.",
  "Assuming raw pointers behave like references with less syntax. They do not carry Rust's aliasing or lifetime guarantees.",
  "Calling `assume_init` too early or treating zeroed bytes as a universal default value for any type.",
  "Overwriting initialized values with `ptr::write` for types that own resources, then forgetting that the old value's destructor was skipped.",
  "Exporting a safe API that secretly requires callers to uphold undocumented pointer or lifetime invariants.",
  "Letting FFI layout, ownership, or unwinding assumptions remain implicit in comments or tribal knowledge.",
]

export function PageCh08UndefinedBehaviorAndUnsafeRust() {
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
  const pageIndex = getPageIndexById("ch08-undefined-behavior-and-unsafe-rust")
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
          Chapter 08 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Unsafe Rust is justified only when a small boundary must enforce invariants the compiler cannot verify. This
          chapter defines the audit obligations for raw pointers, initialization, aliasing, FFI, and safe wrappers.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 04 through 07</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Ownership, borrowing, struct layout, vector invalidation, and move versus clone decisions all lead here.
                Unsafe Rust is not a separate language. It is the place where those earlier rules stop being compiler
                guarantees and start becoming explicit human obligations.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(6)}>
                Chapter 04
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(8)}>
                Chapter 05
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(10)}>
                Chapter 06
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(12)}>
                Chapter 07
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A packet-processing service validates fixed headers, calls a native library, and reuses buffers on a measured
            hot path. The business requirement is a narrow unsafe boundary with written invariants for pointer validity,
            initialization, aliasing, thread safety, and safe wrapper behavior.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A useful rule before writing unsafe code</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Write the safe version first if the shape is still unclear.</li>
              <li>State the exact reason unsafe is needed: FFI, layout, partial initialization, or a measured hot path.</li>
              <li>Write down the invariant before the block, not after the bug report.</li>
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
            <Wrench className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">What Rust considers undefined behavior</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Treat the list below as the operational map, not as a claim of complete exhaustiveness.
              The key idea is that UB is exactly where the optimizer is allowed to assume the
              impossible states cannot occur, so reasoning based on what the hardware happens to do no longer holds.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {ubCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Safe Rust vs unsafe Rust</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">Safe Rust</div>
                <p className="text-sm text-muted-foreground leading-6">
                  Safe Rust rules out use-after-free, double-free, and data races in ordinary code. References,
                  ownership transfer, `Send`, `Sync`, and borrowing rules do most of the structural work long before a
                  test suite runs.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">Unsafe Rust</div>
                <p className="text-sm text-muted-foreground leading-6">
                  Unsafe Rust keeps the same language around you, but it permits operations the compiler cannot fully
                  verify. The rest of the code still obeys ordinary Rust rules. The unsafe block is the proof boundary,
                  not a local switch to “anything goes.”
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">The role of unsafe blocks</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              `unsafe` grants specific capabilities. It does not disable ownership, type checking, or syntax rules, and
              it does not make UB acceptable. It simply says: the compiler cannot prove this, so a human must.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {unsafePowers.map((power) => (
                <li key={power}>{power}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The practical consequence is simple: a tiny unsafe block with a precise `// SAFETY:` comment is usually a
                better design than a large region whose real invariants are only understood after several meetings.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Raw pointers and aliasing rules</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">Raw pointers</div>
                <p className="text-sm text-muted-foreground leading-6">
                  `*const T` and `*mut T` may be null, dangling, misaligned, or aliased. That is why creating them is
                  safe but dereferencing them is not. Raw pointers are representation tools, not evidence that a memory
                  access is valid.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">Aliasing rules</div>
                <p className="text-sm text-muted-foreground leading-6">
                  References are stronger than raw pointers because they promise something to the optimizer. Turning a raw
                  pointer back into `&T` or `&mut T` means you are reintroducing those promises. If exclusive mutation is
                  not actually exclusive, the resulting reference is invalid even if the machine instruction succeeds.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Data races and UB</h4>
            <p className="text-sm text-muted-foreground leading-6">
              In Rust, a data race is not merely a bug; it is undefined behavior. Safe Rust prevents it by construction
              through ownership transfer, borrowing rules, and `Send`/`Sync` requirements at thread boundaries. Unsafe
              code can still create conflicting unsynchronized accesses. That is why shared mutability, raw pointers,
              and concurrency belong in the same audit conversation, not in separate review queues.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Uninitialized memory and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">MaybeUninit&lt;T&gt;</code>
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">What goes wrong</div>
                <p className="text-sm text-muted-foreground leading-6">
                  Uninitialized memory is not a valid value of any type. Reading it as a real `T` is UB. The
                  same is true for constructing invalid bit patterns for types that have invariants, such as references,
                  many enums, and `bool`.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">What to use instead</div>
                <p className="text-sm text-muted-foreground leading-6">
                  <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">MaybeUninit&lt;T&gt;</code> is the
                  sanctioned way to represent storage that does not yet contain a valid `T`. Write every required field
                  or element first. Only then call{" "}
                  <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">assume_init</code>. The type exists
                  so the invalid state is modeled explicitly rather than hidden behind fake values.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">FFI-related UB</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                <li>Match the ABI exactly.</li>
                <li>Document who owns the pointer and who frees it.</li>
                <li>Convert nullability into `Option` or explicit error handling at the boundary.</li>
                <li>Validate string assumptions: encoding, lifetime, and termination.</li>
              </ul>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                <li>Do not invent references from raw FFI pointers unless the lifetime story is real.</li>
                <li>Be explicit about layout expectations and `repr(C)` where required.</li>
                <li>Do not let unwinding expectations stay fuzzy across the boundary.</li>
                <li>Keep the unsafe part in one wrapper layer so the rest of the code can stay ordinary Rust.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Auditing unsafe code</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {auditChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Writing safe abstractions over unsafe internals</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">Keep the API safe when you can enforce the invariant</div>
                <p className="text-sm text-muted-foreground leading-6">
                  If the callee can check bounds, maintain ownership, and prevent aliasing mistakes, keep the public API
                  safe and isolate the raw operation internally. This is the common pattern for slices, small buffer
                  wrappers, parsers, and data-structure internals.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">Use `unsafe fn` when the caller must uphold the contract</div>
                <p className="text-sm text-muted-foreground leading-6">
                  If correctness depends on facts the callee cannot validate, such as a pointer being valid for a chosen
                  lifetime or a caller-controlled aliasing guarantee, make that obligation explicit with `unsafe fn` and
                  document the preconditions precisely.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">How prior instincts translate</h4>
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
                Unsafe Rust is a cost, not a shortcut. Use it where the representation win is real,
                document the invariant where reviewers can see it, and keep the surface area small enough that future
                maintainers can still re-derive the proof.
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
                <h4 className="font-semibold text-foreground">Example 1: a safe slice API over raw-pointer writes</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The caller gets a safe function. Bounds and exclusivity are enforced before the raw-pointer write loop
                  begins.
                </p>
              </div>
              {codes.unsafe_rust_fill_window !== DEFAULT_CODES.unsafe_rust_fill_window && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("unsafe_rust_fill_window")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.unsafe_rust_fill_window}
              onChange={(newCode) => updateCode("unsafe_rust_fill_window", newCode)}
              onRun={() => runCode("unsafe_rust_fill_window")}
              output={outputs.unsafe_rust_fill_window ?? null}
              isRunning={isRunning === "unsafe_rust_fill_window"}
              filename="fill_window_with_raw_pointers.rs"
              expectedOutput="header:9999"
              showResultComparison={true}
              originalCode={DEFAULT_CODES.unsafe_rust_fill_window}
              onRevert={() => resetCode("unsafe_rust_fill_window")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Safety boundary</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The public function is safe because it can check bounds and it borrows the slice as{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&amp;mut [u8]</code>, which
                  already gives exclusive access.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Unsafe operation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The only unsafe step is pointer arithmetic plus write. Everything around it exists to make that one
                  step justified.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Audit note</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Overwriting with the raw-pointer write method (<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.write()</code>){" "}
                  is fine here because the element type is <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">u8</code>. For
                  a drop-carrying type such as <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">String</code>, skipping the old destructor would matter.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: build initialized bytes with `MaybeUninit`</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The storage starts explicitly uninitialized, each byte is written once, and `assume_init` appears only
                  after the invariant is fully true.
                </p>
              </div>
              {codes.unsafe_rust_maybe_uninit !== DEFAULT_CODES.unsafe_rust_maybe_uninit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("unsafe_rust_maybe_uninit")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.unsafe_rust_maybe_uninit}
              onChange={(newCode) => updateCode("unsafe_rust_maybe_uninit", newCode)}
              onRun={() => runCode("unsafe_rust_maybe_uninit")}
              output={outputs.unsafe_rust_maybe_uninit ?? null}
              isRunning={isRunning === "unsafe_rust_maybe_uninit"}
              filename="maybe_uninit_header.rs"
              expectedOutput="[7, 10, 13, 255]"
              showResultComparison={true}
              originalCode={DEFAULT_CODES.unsafe_rust_maybe_uninit}
              onRevert={() => resetCode("unsafe_rust_maybe_uninit")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Initialization invariant</div>
                <p className="text-xs text-muted-foreground leading-5">
                  All four elements must be written before the array becomes a real{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">[u8; 4]</code>.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Why `MaybeUninit`</div>
                <p className="text-xs text-muted-foreground leading-5">
                  It models the not-yet-valid state explicitly, which is far better than treating arbitrary bytes as if
                  they already represent a valid value.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Audit note</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The critical review question is simple: can any path read the value before every element is initialized?
                  If yes, the abstraction is wrong.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The exercise page asks you to audit a raw-pointer abstraction, identify UB risks, repair `MaybeUninit`
            misuse, and design a Rust wrapper that keeps unsafe obligations at the correct boundary.
          </p>
          <Button onClick={() => setCurrentPage(15)} className="gap-2">
            Open Chapter 08 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>
              Unsafe Rust allows operations the compiler cannot prove safe; it does not weaken the actual safety requirements.
            </li>
            <li>
              Undefined behavior includes invalid pointer dereferences, reference aliasing violations, data races, invalid values, and many bad FFI contracts.
            </li>
            <li>
              Raw pointers are representation tools. References are promises. Turning one into the other is where invariants matter most.
            </li>
            <li>
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">MaybeUninit&lt;T&gt;</code> is the right model for genuinely uninitialized storage. <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">assume_init</code> belongs at the end of a proven initialization path.
            </li>
            <li>The best production pattern is usually a safe API with a tiny, documented, auditable unsafe core.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
