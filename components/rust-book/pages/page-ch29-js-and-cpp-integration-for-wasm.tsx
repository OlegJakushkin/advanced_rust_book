"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Bug,
  Cpu,
  Gauge,
  Globe,
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
    title: "The boundary is a copy, not a shared pointer",
    body: "A WebAssembly module and the JavaScript host do not share a heap the way two functions in one process do. The module owns one flat linear memory; JavaScript owns its own object heap. Anything richer than a number that crosses between them is encoded, copied into the other side's memory, and decoded there. Once you internalize that every string, array, or struct on the boundary is a serialize-and-copy step, the cost model and the ownership rules stop being surprising.",
  },
  {
    title: "Only numbers are truly native on the wire",
    body: "The raw WebAssembly call interface speaks integers and floats. There is no native concept of a string, an array, or an object on a function signature. wasm-bindgen makes those feel native by generating glue that lays bytes into linear memory, passes a pointer and a length as plain integers, and reconstructs the value on the far side. The convenience is real, but the contract underneath is always pointer plus length plus an agreement about encoding and ownership.",
  },
  {
    title: "Two layers of foreign function interface stack here",
    body: "When a C or C++ shim is compiled into the same module, you are crossing two boundaries that look similar but are not. The Rust-to-JavaScript edge is managed by wasm-bindgen glue; the Rust-to-C edge is the same C ABI you would use natively, with pointers, lengths, and manual safety invariants. Keeping these two layers separate in your head is what stops a memory bug at one seam from being misdiagnosed at the other.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Emscripten taught you to think of the module's linear memory as a flat C heap you can hand pointers around freely. With Rust and wasm-bindgen the same flat memory exists, but ownership of bytes that cross to JavaScript is decided by generated glue, not by you. The shift is that 'pass a pointer to the host' becomes 'copy bytes into the host and let it own a separate value,' so lifetime questions move from your discipline into the boundary contract.",
  },
  {
    title: "C# background",
    body: "Blazor and P/Invoke trained you to expect a marshaller that hides copying and reference handles behind attributes. Rust pushes that marshalling into the open: you decide whether a value crosses as a borrowed slice, an owned String, or a serialized blob, and that decision is visible in the signature. There is no ambient runtime keeping a JavaScript object alive for you, so a handle that outlives its scope is a bug you must design against, not one the runtime papers over.",
  },
  {
    title: "Go background",
    body: "Go's syscall/js gives you a single dynamic Value type and a garbage collector that follows the bytes around. Rust trades that uniformity for explicit typed boundaries and no shared collector across the seam. The mental shift is that the host heap and the module heap are two separate worlds, and you name exactly what shape each value takes as it crosses, rather than reaching through one js.Value handle for everything.",
  },
  {
    title: "Python background",
    body: "Pyodide and ctypes let you treat the boundary as 'just call the function and the bridge sorts out the types.' Rust makes you state the encoding and the ownership up front, which is more code but removes a class of silent, expensive copies you could not see in the dynamic bridge. The payoff is that batching, byte slices, and zero-copy reads become deliberate choices you can read in the source instead of behaviors hidden in a runtime.",
  },
]

const fundamentals = [
  {
    title: "Linear memory is the shared substrate",
    body: "A WebAssembly module has one contiguous, growable byte array called linear memory. The module's stack, heap, and globals all live inside it, and it is the only memory the host can read or write directly. Every boundary technique is ultimately a story about who writes which bytes into this array, who reads them, and who is responsible for freeing the region afterwards. Understanding the boundary starts with understanding that there is exactly one of these per module.",
  },
  {
    title: "The native call interface is numeric",
    body: "Exported and imported WebAssembly functions can only pass i32, i64, f32, and f64 directly. A string parameter does not exist at this level; it is represented as an i32 pointer into linear memory plus an i32 length. Higher-level tooling hides this, but the hidden representation is exactly what determines whether a call is cheap, whether it copies, and who must deallocate afterwards.",
  },
  {
    title: "wasm-bindgen generates the glue both ways",
    body: "wasm-bindgen reads your annotated Rust, then emits matching JavaScript and Rust shims so that a Rust String can be called as a JavaScript string and a JavaScript Uint8Array can be received as a Rust slice. It is doing on your behalf the byte-laying, pointer passing, and lifetime bookkeeping that the raw interface would force you to write by hand. Treat it as a code generator for a stable contract, not as magic that erases the copy.",
  },
]

const boundaryDataCards = [
  {
    title: "Numbers cross for free",
    body: "An integer or float argument maps directly onto a native WebAssembly value. There is no allocation, no copy, and no encoding step. When a boundary is hot, the cheapest possible design keeps the per-call payload to plain numbers and leaves the bulk data resident on one side.",
  },
  {
    title: "Strings and byte arrays are copied",
    body: "A &str or &[u8] received from JavaScript is laid into linear memory and read by Rust; a returned String is laid into linear memory and read back by JavaScript. Each direction is a copy proportional to the length. This is correct and safe, but it is the line item that dominates a chatty boundary, so it is the first thing to measure.",
  },
  {
    title: "Structs become serialized blobs",
    body: "A rich Rust struct has no native shape JavaScript can hold. To cross, it is turned into something flat: a JSON string, a binary encoding, or a typed-array layout the host agrees to read. The choice of encoding is a real engineering decision with throughput and compatibility consequences, not a formatting detail.",
  },
  {
    title: "Handles keep state on one side",
    body: "Instead of copying a large object across on every call, you can keep it owned inside the module and hand JavaScript an opaque handle. Subsequent calls pass the handle plus small numeric arguments, and the bulk data never crosses again. This is the standard escape from a copy-heavy boundary, at the cost of explicit lifetime management for the handle.",
  },
]

const cppShimCards = [
  {
    title: "The C ABI is the lingua franca",
    body: "C and C++ code reaches Rust through the same stable C ABI used in native FFI: extern \"C\" functions, raw pointers, and explicit lengths. Inside a WebAssembly module this does not change. The shim exports plain functions that take a pointer and a length, and Rust calls them through an unsafe extern block exactly as it would on a desktop target.",
  },
  {
    title: "Safety invariants are yours to state",
    body: "At the C seam there is no borrow checker watching the pointer. You must guarantee that the pointer is valid for the stated length, that the bytes are only read for the duration of the call, and that nobody frees the region underneath the callee. The disciplined pattern is a narrow unsafe block with a written SAFETY comment naming each invariant, so the contract is auditable rather than assumed.",
  },
  {
    title: "Keep the unsafe surface small",
    body: "The native shim should be a thin translation layer: receive pointer and length, reconstruct a slice, do the work, return a number. Everything above it stays safe Rust. A small, well-labelled unsafe region is reviewable; an unsafe call scattered through business logic is a latent corruption bug waiting for a refactor.",
  },
]

const wasiCards = [
  {
    title: "The browser sandbox has no ambient OS",
    body: "A WebAssembly module in a browser cannot open a file, read a clock without permission, or make a raw socket. Capabilities arrive only through imported functions the host chooses to provide. Code that assumed an ambient operating system has to be rewritten so that every effect is an explicit import.",
  },
  {
    title: "WASI standardizes host capabilities",
    body: "The WebAssembly System Interface defines a portable set of host calls for files, clocks, randomness, and more, so the same module can run under different hosts. It is the answer to 'how does a module do I/O without an OS,' but it is still capability-based: the host grants what the module may touch.",
  },
  {
    title: "Browser and WASI are different targets",
    body: "Targeting the browser through wasm-bindgen and targeting a WASI runtime are different deployment shapes with different available capabilities. Decide early which one you are building for, because the import surface, the toolchain, and the testable behavior differ.",
  },
]

const performanceCards = [
  {
    title: "Boundary crossings have fixed and variable cost",
    body: "Each call across the JavaScript-to-WebAssembly seam has a small fixed overhead plus a variable cost proportional to the bytes copied. A loop that crosses the boundary per element pays the fixed cost thousands of times; the same work batched into one call pays it once.",
  },
  {
    title: "Batch instead of chatting",
    body: "The single most effective optimization is to move data in bulk and compute in bulk. Pass one array, run the loop inside the module, and return one result, rather than calling a tiny exported function once per item from JavaScript.",
  },
  {
    title: "Keep bulk state resident",
    body: "When the same large buffer is used across many operations, keep it owned inside the module and operate on it in place. Returning a handle and mutating module-side state turns repeated copies into repeated cheap numeric calls.",
  },
]

const debuggingCards = [
  {
    title: "Panics need a hook to be legible",
    body: "An unhandled Rust panic inside WebAssembly aborts with an opaque trap unless you install a panic hook that forwards the message to the host console. Wire console error reporting in early; debugging a silent trap is far harder than reading a panic line.",
  },
  {
    title: "Source maps connect trap to source",
    body: "With debug info and source maps, a browser can map a fault back to the Rust line that caused it. Without them you are reading raw offsets into linear memory, which tells you where but rarely why.",
  },
  {
    title: "Memory bugs hide at the seams",
    body: "The hardest faults live where pointers and lengths cross: a length that does not match the buffer, a handle used after it was freed, a slice read after the source went away. Logging the pointer, length, and handle identity at the boundary turns a mysterious corruption into a traceable contract violation.",
  },
]

const productionPatterns = [
  "Treat the JavaScript-to-WebAssembly edge as a wire contract: name the encoding, the ownership, and the deallocation for every value that crosses, not just its type.",
  "Default to numbers on hot paths and copy strings or byte arrays only when the data genuinely has to cross.",
  "Batch bulk work into one call that loops inside the module instead of crossing the boundary per element.",
  "Keep large buffers resident on one side and pass opaque handles plus small numeric arguments for repeated operations.",
  "Confine the C or C++ seam to a thin unsafe shim with a written SAFETY comment for every pointer and length invariant.",
  "Install a panic hook and ship source maps so a fault maps back to a Rust line instead of an opaque trap.",
]

const pitfalls = [
  "Assuming a string argument is free because the Rust signature looks like an ordinary call. Every string and byte array on the boundary is a copy proportional to its length.",
  "Calling a small exported function once per element from JavaScript and paying the fixed boundary cost thousands of times instead of batching.",
  "Letting wasm-bindgen types or raw js_sys handles leak deep into domain code, so the copy and lifetime concerns spread everywhere instead of staying at the edge.",
  "Treating the C shim's pointer as if the borrow checker still guarded it. The validity and lifetime of those bytes are now your written invariant, not a compiler guarantee.",
  "Expecting ambient file, clock, or network access in the browser sandbox. Every capability is an explicit import the host must grant.",
  "Shipping without a panic hook or source maps, then trying to diagnose a production trap from raw linear-memory offsets.",
]

const cargoTomlSnippet = `# Cargo.toml for a browser-facing module
[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"

# Build for the web target, then generate JS glue:
#   cargo build --target wasm32-unknown-unknown --release
#   wasm-bindgen target/.../module.wasm --out-dir pkg --target web`

const summaryPoints = [
  "A WebAssembly module and its JavaScript host do not share a heap. Every non-numeric value that crosses the boundary is encoded and copied.",
  "The native call interface is numeric; strings, arrays, and structs exist on the boundary only as pointer-plus-length contracts that wasm-bindgen glues together.",
  "Boundary data choices, copy versus handle versus serialized blob, are the dominant performance decision, so batch bulk work and keep large state resident.",
  "A C or C++ shim crosses through the same C ABI as native FFI, with pointer and length invariants you must state and confine to a thin unsafe layer.",
  "The browser sandbox has no ambient OS; capabilities arrive as imports, and WASI standardizes that host surface for non-browser runtimes.",
  "Panic hooks, source maps, and logging at the seam are what turn an opaque WebAssembly trap into a debuggable contract violation.",
]

export function PageCh29JsAndCppIntegrationForWasm() {
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
  const pageIndex = getPageIndexById("ch29-js-and-cpp-integration-for-wasm")
  const chapter19PageIndex = getPageIndexById("ch19-serialization-and-data-contracts")
  const chapter28PageIndex = getPageIndexById("ch28-cpp-integration")
  const chapter30PageIndex = getPageIndexById("ch30-amqp-and-message-brokers")
  const exercisesPageIndex = getPageIndexById("ch29-js-and-cpp-integration-for-wasm-exercises")
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
          Chapter 29 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          WebAssembly integration needs explicit host calls, memory ownership, data batching, and ABI rules. The module
          and its JavaScript host keep separate heaps, so every value richer than a number is encoded and copied across a
          boundary you design. This chapter defines the boundary contracts for browser-facing modules and the native
          shims they call.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 19 and 28</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 19 covered wire data contracts and versioned encodings; the WebAssembly boundary is one more wire,
                with the same evolution and encoding concerns. Chapter 28 covered the C ABI and Rust FFI; the C and C++
                shim in this chapter is that same seam, now compiled into a browser-shaped module instead of a native
                binary.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter19PageIndex)}>
                Chapter 19
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter28PageIndex)}>
                Chapter 28
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A web product is moving its hot client-side work, image processing, parsing, and a routing-score calculation,
            from JavaScript into a Rust WebAssembly module, and part of the routing logic already exists as a small C++
            function the team wants to reuse rather than rewrite. The requirement is concrete: expose a clean
            JavaScript-callable surface, keep the per-call cost honest by choosing the right boundary representation, and
            wire the existing C++ code through a thin, auditable shim, all without leaking copy and lifetime concerns into
            the rest of the application.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Decide what actually has to cross the boundary, and how often.</li>
              <li>Pick the representation per value: a number, a copied slice, a serialized blob, or a resident handle.</li>
              <li>Batch hot loops into one call that runs inside the module.</li>
              <li>Confine any C or C++ seam to a thin unsafe shim with stated invariants.</li>
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
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The shape worth memorizing is two separate heaps with one shared byte array between them. JavaScript holds
              its own objects; the module holds its own stack and heap inside a single linear memory. The only thing both
              sides can touch is that linear memory, so every string, array, or struct that crosses is written into it as
              bytes by one side and read out by the other. Trace one string across the diagram below: it leaves the
              JavaScript heap, lands as bytes in linear memory, and is reconstructed as a Rust value, with a copy at the
              crossing.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph Host[JavaScript host]\n    JS[JS object heap]\n  end\n  subgraph Module[Wasm module]\n    LM[(linear memory)]\n    RH[Rust heap and stack]\n  end\n  JS -->|encode and copy| LM\n  LM -->|decode| RH\n  RH -->|encode and copy| LM\n  LM -->|decode| JS`}
              caption="Two heaps, one shared byte array. Every non-numeric value is copied into linear memory at the crossing and reconstructed on the far side."
            />
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">From Rust to WebAssembly</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {fundamentals.map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{item.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6 mb-3">
                A browser-facing crate is built as a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">cdylib</code>
                so the linker produces a single <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">.wasm</code>
                artifact, then <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">wasm-bindgen</code>
                post-processes it to emit the JavaScript glue that knows how to lay out and read back each annotated value.
              </p>
              <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{cargoTomlSnippet}</code>
              </pre>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-foreground">JavaScript interop and boundary data choices</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The interop surface is where the design lives. wasm-bindgen will happily generate glue for a string, an
              array, or a serialized struct, but the four representations below have very different costs. Choosing among
              them deliberately, rather than reaching for the most convenient type, is what keeps a boundary fast and
              auditable.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {boundaryDataCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              The decision is essentially a cost ladder. A number rides the native interface for free. A string or byte
              array costs one copy per crossing. A struct costs an encode plus a copy plus a decode. A resident handle
              costs almost nothing per call but adds a lifetime you must manage. Reading these as a ladder makes the right
              representation obvious for any given call frequency and payload size.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  V[Value to cross] --> Q1{Is it a number?}\n  Q1 -->|yes| N[Pass directly, no copy]\n  Q1 -->|no| Cont[Not a number, continues below]`}
              caption="Step one of the ladder: a number rides the native interface for free. Anything else falls through to the next question."
            />
            <p className="text-sm text-muted-foreground leading-6 mt-3">
              For everything that is not a number, the remaining questions decide how it crosses:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Cont[Not a number] --> Q2{Crosses often with big payload?}\n  Q2 -->|yes| H[Keep resident, pass a handle]\n  Q2 -->|no| Q3{Flat bytes or string?}\n  Q3 -->|yes| C[Copy slice or string]\n  Q3 -->|rich struct| S[Serialize then copy]`}
              caption="Steps two and three: a frequently crossed big payload stays resident behind a handle, flat bytes cost one copy, and a rich struct costs an encode plus a copy."
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Boxes className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-foreground">Calling C and C++ from a WebAssembly module</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Reusing existing C or C++ code inside the module means crossing a second, lower boundary: the C ABI. This is
              the same FFI seam covered in Chapter 28, and it behaves the same way under WebAssembly. The shim exports
              plain functions, Rust calls them through an unsafe extern block, and the safety of the whole thing rests on
              invariants you state rather than the compiler checks.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {cppShimCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
                <p className="text-sm text-muted-foreground leading-6 flex-1">
                  The two boundaries stack but stay distinct. The outer edge, Rust to JavaScript, is managed by generated
                  glue. The inner edge, Rust to the C shim, is raw pointers and lengths with manual invariants. Keep them
                  conceptually separate so a fault at one seam is not misdiagnosed at the other.
                </p>
                <Button variant="outline" onClick={() => setCurrentPage(chapter28PageIndex)} className="shrink-0">
                  Revisit Chapter 28
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-foreground">WASI and host capabilities</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A module has no ambient operating system. In the browser it can compute freely but can only reach the
              outside world through functions the host imports into it. WASI is the standardized way a non-browser host
              grants files, clocks, and randomness, but the underlying rule is the same in both worlds: capabilities are
              imports, not assumptions.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {wasiCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Performance limits and serialization at the boundary</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              WebAssembly computes at near-native speed inside the module, so the performance conversation is almost
              never about the arithmetic. It is about the boundary. A design that crosses the seam per element, or copies
              a large buffer on every call, will be slower than the JavaScript it replaced no matter how fast the inner
              loop is. The fixes are structural: batch bulk work into a single call, and keep large state resident so it
              crosses once instead of repeatedly.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {performanceCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                Serialization is the other half of this. A rich struct that crosses as JSON pays an encode and a parse on
                top of the copy; the same struct crossing as a compact binary layout the host reads as a typed array can
                be dramatically cheaper. As in Chapter 19, the encoding is a contract: pick one that both sides can read,
                evolve it additively, and measure it rather than guessing.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Bug className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-foreground">Debugging WebAssembly</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A fault inside a module is harder to read than a native crash because, by default, you see a trap and an
              offset into linear memory rather than a Rust line. The good news is that a small amount of setup recovers
              most of the familiar debugging experience: a panic hook surfaces messages to the console, source maps map
              traps back to source, and logging at the seam exposes the pointer and length values where the hard bugs
              actually live.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {debuggingCards.map((card) => (
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
            Most engineers reach WebAssembly with a marshalling model from somewhere else, and the useful question is
            which part of that model still holds. The shift is rarely about API names. It is about accepting that the host
            and the module keep separate heaps, that every non-numeric value is copied across the seam, and that you now
            name the representation and ownership of each value instead of trusting a bridge to do it invisibly.
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
                WebAssembly does not make the boundary disappear; it makes it explicit. The cost you used to pay invisibly
                in a marshaller is now a copy you can see, measure, and design around.
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
                <h4 className="font-semibold text-foreground">Example 1: wasm-bindgen string and byte boundary</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Two exported functions show the two common non-numeric crossings: a string in and out, and a byte slice
                  in with a number out.
                </p>
              </div>
              {codes.wasm_bindgen_string_array_boundary !== DEFAULT_CODES.wasm_bindgen_string_array_boundary && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("wasm_bindgen_string_array_boundary")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">#[wasm_bindgen]</code>
              attribute is what makes each function callable from JavaScript, and the parameter types decide how the data
              crosses.
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">build_label</code>
              takes two borrowed <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">&amp;str</code>
              values, each copied into linear memory, and returns an owned
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">String</code>
              copied back out;
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">sum_bytes</code>
              receives a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">&amp;[u8]</code>
              slice and returns a plain number, so only the bytes in are copied and nothing comes back but an integer.
              Follow each value across the diagram, then read the same crossings in code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph JS[JavaScript]\n    A[strings and bytes]\n  end\n  subgraph W[Wasm module]\n    B[build_label borrows str]\n    C[sum_bytes borrows slice]\n  end\n  A -->|copy in| B\n  A -->|copy in| C\n  B -->|copy String out| R1[label]\n  C -->|number out| R2[sum]`}
              caption="Strings and the byte slice are copied into the module; the label String is copied back out, while the sum returns as a plain number with no copy."
            />
            <RustCodeEditor
              code={codes.wasm_bindgen_string_array_boundary}
              onChange={(newCode) => updateCode("wasm_bindgen_string_array_boundary", newCode)}
              onRun={() => runCode("wasm_bindgen_string_array_boundary")}
              output={outputs.wasm_bindgen_string_array_boundary ?? null}
              isRunning={isRunning === "wasm_bindgen_string_array_boundary"}
              filename="wasm_bindgen_boundary.rs"
              expectedOutput={"label = billing::/ready\nsum = 10"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.wasm_bindgen_string_array_boundary}
              onRevert={() => resetCode("wasm_bindgen_string_array_boundary")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Borrowed in</div>
                <p className="text-xs text-muted-foreground leading-5">
                  A <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&amp;str</code> or
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]"> &amp;[u8]</code> is copied into
                  linear memory for the call and not owned by the module afterwards.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Owned out</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The returned <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">String</code> is copied
                  back into the host, which then owns its own separate value.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Numbers are free</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The summed <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">u32</code> rides the
                  native interface with no allocation and no copy.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: Wasm plus C ABI boundary</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  A safe Rust function hands a string's bytes to a C-ABI shim as a pointer and a length, mirroring how a
                  reused C or C++ routine is called inside the module.
                </p>
              </div>
              {codes.wasm_cpp_ffi_boundary !== DEFAULT_CODES.wasm_cpp_ffi_boundary && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("wasm_cpp_ffi_boundary")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the safe wrapper
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">route_score</code>
              is the only place that touches raw pointers, and it does so inside a narrow
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">unsafe</code>
              block with a written SAFETY comment naming each invariant. It passes
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">route.as_ptr()</code>
              and <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">route.len()</code>
              to the shim, which reconstructs a slice for the duration of the call and computes a score from its length.
              The contract is pointer plus length plus a promise the bytes stay valid and are only read while the call
              runs. Trace that single crossing in the diagram, then read it in code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  S[route as str] -->|as_ptr, len| W[route_score wrapper]\n  W -->|ptr, len in unsafe| Shim[cpp_route_score C ABI]\n  Shim -->|from_raw_parts, read only| Slice[reconstructed slice]\n  Slice -->|len times 10| Score[u32 score]\n  Score --> W`}
              caption="One crossing: the wrapper passes pointer and length into the C-ABI shim, which rebuilds a read-only slice for the call and returns a number. Validity of the bytes is a stated invariant, not a compiler check."
            />
            <RustCodeEditor
              code={codes.wasm_cpp_ffi_boundary}
              onChange={(newCode) => updateCode("wasm_cpp_ffi_boundary", newCode)}
              onRun={() => runCode("wasm_cpp_ffi_boundary")}
              output={outputs.wasm_cpp_ffi_boundary ?? null}
              isRunning={isRunning === "wasm_cpp_ffi_boundary"}
              filename="wasm_cpp_ffi_boundary.rs"
              expectedOutput={"route = /orders\nscore = 70"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.wasm_cpp_ffi_boundary}
              onRevert={() => resetCode("wasm_cpp_ffi_boundary")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Pointer plus length</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The C ABI has no slice type, so the borrowed bytes cross as a raw pointer and an explicit length.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Stated invariants</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The SAFETY comment names what must hold: valid pointer, correct length, read-only for the call's
                  duration.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Thin unsafe layer</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Only the wrapper and the shim are unsafe; the rest of the program stays in safe Rust.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              Both examples run here as ordinary Rust so the boundary logic is testable without a browser or a WebAssembly
              runtime. In a real build, the first compiles to a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">cdylib</code>
              processed by wasm-bindgen, and the second links the C or C++ shim into the same module, but the crossing
              contracts, copy in, copy out, and pointer plus length, are exactly what you see above.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to export Rust to JavaScript with wasm-bindgen, choose serialization and
            memory boundaries for a given workload, reason about the copying cost of crossing the seam, and decide when to
            batch or keep state resident instead of copying per call.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 29 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Next chapter</h3>
              <p className="text-sm text-muted-foreground leading-6">
                This chapter handed values across a boundary inside one machine. Chapter 30 widens that boundary to a
                message broker between services, where the wire contract, copy semantics, and explicit ownership habits
                from this chapter reappear as durable messages, acknowledgments, and idempotent consumers.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(chapter30PageIndex)} className="gap-2 shrink-0">
              Continue to Chapter 30
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
