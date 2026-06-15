"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Network, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "The boundary is a binary contract the compiler does not check for you",
    body: "Inside one Rust crate the compiler verifies ownership, lifetimes, layout, and that every path either returns or unwinds correctly. None of that survives a call across the language boundary. Rust and C++ do not share one stable language-level ABI, so the moment a symbol is called from foreign code the only things both sides agree on are the bytes in registers and on the stack. Calling convention, struct layout, who frees what, how long a pointer stays valid, and what happens on failure all become a contract you write down by hand and that nothing automatically enforces. Treat the seam the way you would treat a published wire format, not an internal function call.",
  },
  {
    title: "A narrow C ABI seam is the calm default, even when the far side is C++",
    body: "C++ has no portable object ABI: name mangling, vtable layout, exception tables, and standard-library types differ across compilers, versions, and even build flags. The C ABI, by contrast, is the one calling convention every toolchain on a platform already agrees on. So the most durable public seam is almost always a small set of plain C functions, with the C++ richness kept on the far side of that shim. Direct C++ interop through a tool like cxx is genuinely good when you control and build both sides together, but reaching for raw C++ layout and exceptions as your stable contract is how integrations break on the next compiler upgrade.",
  },
  {
    title: "Rust's expressive types stop at the edge and become pointers, lengths, and handles",
    body: "References, String, Vec, Result, trait objects, generics, and panics are the vocabulary you use inside Rust, and you should keep using them right up to the wrapper. At the foreign edge they do not translate: a slice becomes a raw pointer plus a length, an owned string becomes a pointer paired with an explicit free function, an owned object becomes an opaque handle, and a Result becomes an integer status code. The skill is not avoiding the rich types; it is flattening them into address-shaped tokens exactly at the seam and rebuilding the rich model the instant control crosses back into safe Rust.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You already live with ABI drift across compiler flags, fragile vtable layouts, and the rule that exceptions must not cross a C boundary, so most of this chapter will feel familiar. The shift is that Rust makes the boundary itself a visible language feature: the unsafe blocks, the repr(C) annotations, and the extern declarations are where the contract is, and the compiler holds the safe Rust behind them honest. The calm design is the one you already know from your most disciplined C interfaces, just enforced rather than reviewed: small seam, flattened ownership, no unwinding across the line.",
  },
  {
    title: "C# background",
    body: "P/Invoke trained you to expect the runtime to marshal strings, pin buffers, and translate exceptions for you. Rust has no managed runtime standing by, so none of that marshalling is implicit. You decide explicitly when bytes are copied, who owns a buffer for how long, and how a failure becomes a status code, and the type system makes those decisions appear as ordinary parameters and return values rather than attributes on a DllImport. More ceremony up front, but the lifetime and exception assumptions are written down instead of trusted.",
  },
  {
    title: "Go background",
    body: "The nearest reference point is cgo discipline: the foreign edge wants explicit ownership, clear data movement, and a hard stop on Go- isms leaking across. Rust pushes the same idea further by making aliasing and panic policy part of the type system and the unsafe model, not a convention you remember to follow. There is no garbage collector to keep a pointer alive across the boundary, so a value handed to foreign code must have its lifetime modelled deliberately as a handle or a copied buffer.",
  },
  {
    title: "Python background",
    body: "ctypes and cffi let you describe a C function in a few lines and call it from a dynamic, garbage-collected world, and the binding layer hides most of the lifetime and error mechanics. Rust removes that cushion: there is no interpreter owning object lifetime, so you state ownership and validity at the seam yourself. The upside is that the same explicitness which feels heavier than a cffi declaration is exactly what lets the Rust wrapper be a safe, ordinary library to the rest of your code instead of a thin layer of raw pointers you must remember to handle carefully.",
  },
]

const ffiFundamentals = [
  {
    title: "Pin the calling convention with extern \"C\"",
    body: "Rust's default ABI is unspecified and free to change between compiler versions; foreign code cannot call into it reliably. Marking a function extern \"C\" pins it to the platform's stable C calling convention so another toolchain knows exactly how to pass arguments and read the return value. The same keyword on a declaration block tells Rust how to call out to a foreign symbol.",
  },
  {
    title: "Pin layout with repr(C) on shared structs",
    body: "Rust reserves the right to reorder, pad, and pack struct fields however it likes, which is fine until that struct's bytes have to be understood by C or C++. Annotating it #[repr(C)] forces the predictable C field order and padding so both sides agree on offsets. Without it, a struct that compiles cleanly on both sides can still disagree about where each field lives.",
  },
  {
    title: "Keep the unsafe edge thin, then wrap it",
    body: "Every foreign call and every raw-pointer dereference is unsafe from Rust's point of view, because the compiler can no longer prove the invariants. The discipline is to confine that unsafety to one small layer that states its assumptions, then expose a normal safe Rust API on top. The rest of the codebase should never touch the raw symbols directly.",
  },
  {
    title: "Speak in plain machine types at the surface",
    body: "The ABI surface should use fixed-width integers, raw pointers, explicit lengths, and integer status codes rather than clever language-level types. These have an unambiguous representation that any compiler agrees on, which is exactly what a contract between two languages needs. Save the expressive types for the safe layer just behind the seam.",
  },
]

const cAbiBoundaryRules = [
  "Do not export Rust references such as &T, &mut T, &str, or slices as a public C ABI contract. They encode aliasing and lifetime promises that have no C representation; flatten them to a raw pointer plus a length instead.",
  "Do not export String, Vec, Box, trait objects, generics, or Result as foreign-facing types. Their layout is a Rust implementation detail, not a stable contract, and a fat pointer or an enum discriminant means nothing to another compiler.",
  "Prefer integer status codes over Rust enums at the most conservative boundaries. An enum can cross the seam only if its repr and discriminant values are pinned and audited; an integer convention needs no such ceremony.",
  "Remember that the raw C++ class ABI is not portable across compilers and standard libraries. Even when the far side is C++, a small C shim usually gives you a smaller, more stable contract than exposing C++ types directly.",
]

const ownershipCards = [
  {
    title: "Borrowed input buffers",
    body: "Pass a const pointer plus a length when the caller owns the memory and Rust only needs a temporary read-only view for the duration of the call. Nothing is allocated or freed across the seam; Rust reconstructs a slice, reads it, and forgets the pointer when the call returns.",
  },
  {
    title: "Caller-allocated output buffers",
    body: "Pass a mutable pointer plus a capacity when the caller owns the storage and Rust fills it. Return a status code, and where the amount written can vary, a written-length out parameter so the caller knows how much of its buffer is valid.",
  },
  {
    title: "Callee-owned opaque handles",
    body: "Hand back a pointer to an opaque type paired with explicit new and free functions when Rust should own an object across several calls. The foreign side treats the pointer as a token it passes back in and never dereferences, which lets you change the internals freely.",
  },
  {
    title: "Owned strings across the seam",
    body: "If Rust allocates a string for foreign code, return the pointer together with exactly one free function so the same allocator releases it. If the foreign side supplies a string, accept a C string pointer or explicit bytes plus length and validate it at the edge before trusting it.",
  },
]

const errorHandlingCards = [
  {
    title: "Status codes",
    body: "The most portable pattern is zero for success and a distinct nonzero value per failure mode, each with a documented meaning. It is boring, and boring is exactly what you want for a contract two compilers have to agree on for years.",
  },
  {
    title: "Out parameters",
    body: "Deliver the successful payload through caller-provided output pointers or buffers, written only after you have validated nullability and capacity. The return value stays reserved for the status, and the data travels through storage the caller already owns.",
  },
  {
    title: "Structured error payloads",
    body: "When an integration needs richer diagnostics than a single integer, return a status plus an error buffer the caller can read, or expose a separate function that reports the last error recorded on an opaque handle.",
  },
  {
    title: "No Result across the seam",
    body: "Keep Result inside Rust, where it is checked and ergonomic. At the boundary, collapse it into the C-facing status contract, and reconstruct a Result on the other side the moment a foreign status is read back into safe Rust.",
  },
]

const unwindRules = [
  "Never let a Rust panic unwind into C or C++ frames. Unwinding past a frame the other language does not know how to clean up is undefined behavior, and the crash will usually surface far from the line that caused it.",
  "Do not let a C++ exception propagate into Rust frames either, unless you have a deliberately designed specialized boundary and a toolchain contract that supports it. A foreign exception tearing through Rust stack frames has the same undefined character in reverse.",
  "The conservative production rule is the simplest one to operate: allow no cross-language unwinding at all. Each side absorbs its own failures and the boundary only ever carries values, never an in-flight unwind.",
  "If the Rust side can panic, catch it at the outer exported function with catch_unwind and translate the result into a status code or a deliberate abort. A panic policy that lives only in a comment is not a policy.",
]

const ecosystemCards = [
  {
    title: "bindgen",
    body: "Reach for bindgen when headers already exist and the job is to generate Rust declarations from a C or C-like surface. It reads the header and emits the raw extern declarations; you then wrap that raw layer in narrower, safe Rust APIs rather than exposing it as your library's interface.",
  },
  {
    title: "cxx",
    body: "Reach for cxx when you control both sides and want a curated Rust/C++ bridge rather than a raw header dump. You declare a shared bridge module listing exactly the types and functions that cross, and cxx generates matching glue for both languages with a supported, checked set of types.",
  },
  {
    title: "autocxx",
    body: "Reach for autocxx when the C++ surface is large enough that hand-writing a cxx bridge is impractical and you want more automation on top of generated bindings. The automation helps, but generated surface area is still surface area you have promised to keep working, so the auditing discipline does not go away.",
  },
]

const abiStabilityRules = [
  "Rust's native ABI is not the thing you publish. What callers depend on is the C ABI you deliberately expose, so the stability conversation is about that surface, not about Rust's internal representation choices.",
  "Pin layout with #[repr(C)] everywhere a shared struct crosses the seam, and treat any change to field order, type, or size as a breaking change to a binary contract.",
  "Prefer fixed-width integer types and explicit pointer-plus-length contracts over clever language-level types, because the boring representation is the one that stays valid across compilers and versions.",
  "Version functions, structs, or envelopes when the contract evolves. Add a new symbol or a versioned struct rather than redefining a field in place and hoping mixed-version deployments stay kind.",
  "Hide internal Rust data structures behind opaque handles when you want freedom to change internals later. If callers only ever hold an address-shaped token, you can rewrite everything behind it without touching the ABI.",
]

const testingChecklist = [
  "Unit test the safe Rust wrapper separately from the raw ABI layer, so most of your logic is covered by ordinary fast tests that never touch a pointer.",
  "Add at least one direct foreign-caller integration test or harness in CI for the exported symbols. The only proof that the C contract works is calling it the way a C caller will.",
  "Exercise the hostile inputs the contract must survive: null pointers, zero lengths, oversized lengths, and double-free or use-after-free defenses where the ownership rules require them.",
  "Run native sanitizers on the boundary where you can. AddressSanitizer, UndefinedBehaviorSanitizer, and ThreadSanitizer catch memory and data-race bugs that no amount of Rust-side review will surface.",
  "Use Miri to check the Rust-side wrapper logic for undefined behavior, while remembering that arbitrary foreign code runs outside Miri's world and is not covered.",
  "Fuzz the boundary whenever the seam parses attacker-controlled bytes or strings, because a parser at a trust boundary is exactly where a malformed input turns into memory corruption.",
]

const productionPatterns = [
  "Keep one tiny extern \"C\" surface over a larger safe Rust core. The more logic lives behind the raw ABI edge rather than on it, the easier the boundary is to review, test, and evolve.",
  "Model ownership with handles, pointer-plus-length pairs, and explicit free functions rather than with wishful comments about who probably owns the memory. The contract should be readable from the signatures alone.",
  "Translate foreign-facing status codes back into ordinary Rust Result values the instant control re-enters safe Rust, so the rest of the codebase never reasons about integer error conventions.",
  "Choose a C shim or a cxx bridge deliberately, and write down which one you picked and why. Do not let raw C++ ABI assumptions leak into the public contract by accident.",
  "Log and test the unwind policy explicitly. Whether the boundary catches panics or aborts on them is a real decision, and it should be visible in code and exercised in tests, not held in tribal memory.",
]

const pitfalls = [
  "Exporting String, Vec, or references directly because they looked convenient in Rust. Their layout is an implementation detail, so what compiles today is a contract that breaks on the next change.",
  "Treating a raw pointer as proof of ownership or lifetime. A raw pointer is only an address-shaped token; it carries no promise about validity, aliasing, or who is responsible for freeing it until the wrapper states one.",
  "Forgetting that a duplicated OS handle or opaque pointer changes ownership semantics. Handing out a copy is not the same as lending a borrow, and the two have very different cleanup rules.",
  "Letting Rust panics or C++ exceptions cross the boundary because the happy path seemed fine in testing. The undefined behavior only shows up on the failure path, which is the path you tested least.",
  "Publishing a wide generated binding surface as the real API instead of wrapping it in a narrower, stable interop layer. Generated surface area is still surface area you have to keep working.",
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
          Linking Rust to a C or C++ library is not a syntax detail; it is a binary contract the compiler cannot check
          for you. Calling convention, memory layout, who frees what, how long a pointer stays valid, and what happens on
          failure all become things you state by hand. This chapter treats that boundary as a small, deliberate seam to
          design rather than a library to call.
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
            <h4 className="font-semibold text-foreground mb-3">The four FFI fundamentals</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Almost every Rust interop layer is built from the same four primitives. They are small, but together they
              are what turns an internal Rust function into a symbol another language can call without guessing about
              representation. The diagram shows how a single call splits into a thin unsafe edge over a larger safe core;
              the cards below name each piece.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Foreign[C or C plus plus caller] -->|C calling convention| Edge[extern C symbol]\n  Edge -->|raw ptr len status| Unsafe[Thin unsafe wrapper]\n  Unsafe -->|owned Rust types| Safe[Safe Rust core]\n  Safe -->|Result| Unsafe\n  Unsafe -->|status code| Edge`}
              caption="One narrow unsafe edge sits between the foreign caller and a large safe Rust core. Raw types live only on the edge; rich types live behind it."
            />
            <div className="grid gap-3 lg:grid-cols-2 mt-4">
              {ffiFundamentals.map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{item.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">What may and may not cross a C ABI boundary</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The single most useful filter when designing an interop layer is to sort every type into one of two
              buckets: representations with a stable, agreed-upon shape that may cross the seam, and Rust-specific types
              whose layout is an implementation detail that must stay behind it. The rules below are that filter spelled
              out.
            </p>
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
              When Rust is the caller, you describe the foreign function in an{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">extern "C"</code> declaration block,
              which tells the compiler the symbol exists elsewhere and must be called with the C calling convention. The
              call itself is unsafe, because Rust cannot verify that the foreign code honors the signature, so the
              practice is to wrap that one call in a small safe function whose body documents why the call is sound. In a
              real Cargo build the native library is linked through build-system configuration, typically a{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">build.rs</code> that points the linker
              at the artifact. In this chapter&apos;s runnable demo the symbol is defined in Rust with the C ABI so the
              example stays self-contained while exercising the exact same declaration-and-wrap pattern.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Calling Rust from C and C++</h4>
            <p className="text-sm text-muted-foreground leading-6">
              When Rust is the callee, the goal is to expose a deliberately tiny surface that another language can rely
              on:{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">extern "C"</code> functions marked so
              their names are not mangled, C-friendly layout for any shared struct, raw buffers or opaque handles instead
              of Rust ownership types, and an explicit destroy function for anything Rust allocates and foreign code later
              frees. The crate is built as a C-facing static or dynamic library rather than as a Rust ABI artifact, and
              the public header that describes these symbols becomes the real contract. Keeping that header small is the
              whole discipline: every symbol on it is something you have promised to keep stable.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Modelling ownership across the seam</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Ownership is the part of the contract that has no syntax in C, so you express it by choosing which of a few
              fixed shapes each parameter takes. The decision is always the same question asked precisely: who allocated
              this memory, who is allowed to read or write it, and who is responsible for freeing it. The diagram sorts
              the four common answers; the cards below give the signature pattern for each.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Q{Who owns the memory?} -->|Caller, read only| In[const ptr plus len]\n  Q -->|Caller, Rust writes| Out[mut ptr plus capacity]`}
              caption="Caller-owned memory: a const pointer plus length for read-only views, or a mutable pointer plus capacity for buffers Rust fills."
            />
            <p className="text-sm text-muted-foreground leading-6 mt-3">
              When Rust owns the memory instead of the caller, the same question routes to the other two shapes:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Q{Who owns the memory?} -->|Rust owns across calls| Handle[opaque handle plus new and free]\n  Q -->|Rust allocates a string| Str[returned ptr plus one free fn]`}
              caption="Rust-owned memory: an opaque handle with explicit new and free functions, or a returned pointer paired with exactly one free function."
            />
            <div className="grid gap-4 lg:grid-cols-2 mt-4">
              {ownershipCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A Rust reference encodes aliasing and lifetime promises the C or C++ side cannot honor, which is why a
                mature FFI surface flattens everything into these four shapes. The payoff is that ownership becomes
                readable from the function signature instead of relying on a comment everyone has to remember.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Returning errors across the seam</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A Rust{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Result&lt;T, E&gt;</code> has no C
              representation, so failure has to be re-expressed in terms the foreign side can read. The conventional
              answer is an integer status as the return value, with any successful payload delivered through caller-owned
              out parameters. The richness of your error type stays inside Rust; only its outcome crosses the line.
            </p>
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
            <h4 className="font-semibold text-foreground mb-3">Keeping unwinding inside its own language</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The most dangerous thing that can cross an FFI boundary is not a bad value but an in-flight unwind. A Rust
              panic or a C++ exception unwinding through frames the other language does not know how to clean up is
              undefined behavior, and it tends to crash far from the cause. The operable policy is to stop every unwind at
              the boundary: catch it, convert it to a status code, and let only ordinary return values cross. The diagram
              shows that gate; the rules below state it precisely.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Body[Exported fn body] --> Catch{catch_unwind}\n  Catch -->|Ok value| Status[return status code]\n  Catch -->|panic caught| Err[return error status]\n  Status --> Foreign[Foreign caller]\n  Err --> Foreign\n  Body -.->|never| Leak[unwind into foreign frames]\n  Leak -.-> UB[undefined behavior]`}
              caption="An exported function catches its own panic and returns a status. The dashed path, an unwind leaking into foreign frames, is the one you must make impossible."
            />
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside mt-4">
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
            <h4 className="font-semibold text-foreground mb-3">Choosing a binding tool: bindgen, cxx, or autocxx</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              These tools do not change the contract you owe; they change how much of the boilerplate is written for you.
              The choice mostly follows two questions: do you control both sides of the boundary, and how large is the C++
              surface you need to reach. The decision tree below routes those questions to a default; the cards explain
              what each tool is actually for.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Start{Headers exist, C-like surface?} -->|Yes, generate from C| Bindgen[bindgen]\n  Start -->|No, control both sides| Both{How big is the C plus plus surface?}\n  Both -->|Small, curated| Cxx[cxx bridge]\n  Both -->|Large, want automation| Autocxx[autocxx]\n  Bindgen --> Wrap[Wrap raw output in narrow safe API]\n  Cxx --> Wrap\n  Autocxx --> Wrap`}
              caption="The tool depends on whether headers already exist and how much C++ you must reach. Whatever the tool, the generated surface still gets wrapped in a narrow safe API."
            />
            <div className="grid gap-4 lg:grid-cols-3 mt-4">
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

        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How this lands by background</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            Most engineers reaching for FFI already carry a model from another ecosystem, and the useful question is which
            part of that model transfers and which part will quietly mislead you. The shift is almost never about which
            functions to call. It is about who is now responsible for ownership, lifetime, and failure once a boundary the
            compiler cannot see sits between your code and the other language.
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: there are three layers, and only the middle one is unsafe. The foreign symbol on the left
              is reached through an{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">extern "C"</code> declaration; the
              one-line unsafe wrapper{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">safe_abs</code> performs the actual call
              and documents why it is sound; and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">main</code> only ever sees a normal safe
              function. Trace that one call left to right in the diagram, then read the same three layers in code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Main[main calls safe_abs] --> Wrap[safe_abs safe wrapper]\n  Wrap -->|unsafe block| Decl[extern C declaration]\n  Decl --> Sym[ffi_demo_abs C ABI symbol]\n  Sym -->|i32| Wrap\n  Wrap -->|i32| Main`}
              caption="safe_abs is the only place the unsafe call lives; main and the rest of the program see a plain safe function."
            />
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the function is a guard sequence before any real work happens. It validates the out
              pointer, then the input pointer, returning a distinct nonzero status for each failure; only once both are
              known non-null does it build a slice from{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">ptr</code> and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">len</code>, compute the sum, write it
              through the out parameter, and return{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">0</code>. The caller owns both buffers;
              Rust only borrows them for the call. Follow the branches in the diagram, then read them top to bottom in
              code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Enter[sum_i32s entry] --> NullOut{out_total null?}\n  NullOut -->|yes| R1[return 1]\n  NullOut -->|no| NullPtr{ptr null?}\n  NullPtr -->|yes| R2[return 2]\n  NullPtr -->|no| Build[build slice from ptr and len]\n  Build --> Sum[sum into i64]\n  Sum --> Write[write through out_total]\n  Write --> Ok[return 0]`}
              caption="Validate the out pointer, then the input pointer, each with its own status code, before any memory is read or written. Success returns 0."
            />
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
                  Status integers make the contract portable without leaking Rust&apos;s{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Result</code> shape.
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
            <li>FFI is a binary contract the compiler cannot check for you. ABI, layout, ownership, and unwind policy must all be stated explicitly.</li>
            <li>A narrow C ABI seam is usually the most stable integration layer even when the far side is C++, because C is the one calling convention every toolchain agrees on.</li>
            <li>
              Rust references,{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">String</code>,{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec&lt;T&gt;</code>,{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Result</code>, and panics normally stop
              at the Rust side of the wrapper and are rebuilt the moment control returns to safe Rust.
            </li>
            <li>
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">bindgen</code>,{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">cxx</code>, and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">autocxx</code> reduce boilerplate but do
              not remove the obligation to wrap their output in a narrow, stable interop layer.
            </li>
            <li>Testing the interop layer means more than “it linked once.” Include null, length, ownership, sanitizer, and foreign-caller harness coverage.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
