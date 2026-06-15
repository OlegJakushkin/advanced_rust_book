"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Bug,
  Cpu,
  GitBranch,
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
    title: "Ownership is the primary contract",
    body: "Rust starts with ownership, not references. First identify who owns the value and therefore who controls cleanup, movement, and long-lived storage. Borrowing is layered on top of that owner.",
  },
  {
    title: "Borrowing is temporary access, not shared ownership",
    body: "A reference gives a view, not a second owner. Shared references allow read access. A mutable reference requires temporary exclusivity so mutation cannot happen while another alias to the same data exists.",
  },
  {
    title: "Lifetimes describe reference validity relationships",
    body: "A lifetime annotation does not keep anything alive. It says that one reference must not outlive the data behind it, and sometimes that one returned reference is tied to one or more input references.",
  },
]

const comparisons = [
  {
    title: "C++ background",
    body: "RAII and move semantics transfer almost directly, but the aliasing rule that lived in your head and your code review now lives in the type system. A returned reference is not a pointer you promise to keep valid; it is a relationship the compiler will refuse to let you violate.",
  },
  {
    title: "C# background",
    body: "Object lifetime is runtime-managed by the GC, so you rarely think about who outlives whom. In Rust that question moves to compile time: if a function hands back borrowed data, the caller's owner must provably outlive the result. When the proof gets awkward, returning an owned value is the cleaner API, not a fallback.",
  },
  {
    title: "Go background",
    body: "Slices and strings feel free to pass around because the runtime tracks the backing array, and a leaked reference into a reused buffer is a silent bug you find in production. Rust makes that boundary a compile error instead, and asks you up front to choose: does this stage observe the data, or must it own it?",
  },
  {
    title: "Python background",
    body: "Reference semantics and reference counting mean two names can quietly point at the same mutable object, and shared mutation is normal. Rust forbids exactly that aliasing-plus-mutation pattern at compile time: many readers or one writer, never both. The shift is treating a mutable reference as a proof of exclusive access rather than just another handle.",
  },
]

const borrowingRules = [
  "At any point, you may have any number of shared references (`&T`) or exactly one mutable reference (`&mut T`).",
  "A reference must never outlive the owner it points into.",
  "The compiler reasons about when a borrow is last used, not only where the lexical block ends.",
  "If mutation and aliasing are both required, the design usually needs a narrower scope, a split data structure, interior mutability with explicit tradeoffs, or a different ownership boundary.",
]

const elisionRules = [
  "Each elided input lifetime becomes its own lifetime parameter.",
  "If there is exactly one input lifetime, Rust assigns that lifetime to an elided output lifetime.",
  "If the function is a method and one input is `&self` or `&mut self`, Rust assigns the receiver lifetime to an elided output lifetime.",
]

const lifetimeTraps = [
  "Returning a reference to a local `String`, `Vec<T>`, or temporary value. The owner dies at function exit, so the reference cannot survive.",
  "Designing long-lived structs with borrowed fields by default. That can be correct for parsers and views, but it often makes the whole type harder to move and store than an owned design would be.",
  "Holding a shared borrow longer than necessary, then trying to take a mutable borrow. The repair is usually scope narrowing or computing the borrowed result earlier, not cloning first.",
  "Trying to send borrowed data across thread, task, or queue boundaries. Those boundaries usually want owned values unless the owner is provably longer-lived and deliberately shared.",
]

const ownershipDesignRules = [
  "Accept borrowed input for read-only work when the caller already owns the data: `&str`, `&[u8]`, `&Path`, and focused borrowed structs.",
  "Return owned values when the result should survive independently of the input or cross a subsystem boundary.",
  "Keep mutable borrows short. A helper function often shortens the exclusive borrow enough to unblock the rest of the flow.",
  "Use cloning deliberately when duplication is semantically real or operationally cheap enough. Do not treat cloning as the default way to get past a borrow-checker error.",
]

const productionPatterns = [
  "Borrow within parsing, validation, and formatting hot paths when the owner is nearby and the borrowed view stays local.",
  "Convert to owned domain values before worker queues, caches, retries, or background tasks. Those are ownership boundaries, not convenient places to carry references deeper.",
  "Prefer APIs that accept borrowed data but return owned results for normalized strings, cache keys, error messages, and protocol envelopes.",
  "Store owned data in long-lived structs unless the type is intentionally a view. Borrow from stored data later; do not make the entire object graph lifetime-heavy without a real payoff.",
]

const pitfalls = [
  "Adding lifetime annotations before deciding who should own the data. Most lifetime trouble is ownership trouble with references on top.",
  "Returning `&str` because it feels cheaper than `String`, even when the result is assembled inside the function. If you build the result there, you own it there; return `String`.",
  "Cloning request buffers, headers, or keys everywhere instead of choosing one clear ownership transfer point.",
  "Treating `&mut T` as an inconvenience instead of what it is: a proof of exclusive access. That proof is one reason safe Rust can rule out data races and many aliasing bugs.",
]

export function PageCh04OwnershipBorrowingAndLifetimes() {
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
  const pageIndex = getPageIndexById("ch04-ownership-borrowing-and-lifetimes")
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
          Chapter 04 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Ownership, borrowing, and lifetimes define who may read, mutate, retain, or transfer data at every API boundary.
          This chapter applies those rules to production interfaces and resource management.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 02 and 03</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 02 established values, moves, drops, and lifetimes as reference constraints. Chapter 03 showed
                that repository boundaries are also ownership boundaries. This chapter connects those models into the
                day-to-day rules you will feel in function signatures, method design, worker handoff, and API shape.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(2)}>
                Revisit Chapter 02
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(4)}>
                Revisit Chapter 03
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            An ingress service parses HTTP data, derives routing keys, emits audit labels, and queues work for downstream
            processors. The business requirement is explicit data ownership at each layer: request bytes stay borrowed only
            while local, and derived outputs become owned when they cross queues, caches, or worker boundaries.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A reliable order for asking the questions</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Who owns this value right now?</li>
              <li>Can the next operation borrow it, or must it take ownership?</li>
              <li>If a reference is returned, which input owner keeps that data alive?</li>
              <li>If the answer is awkward, should this API return owned data instead?</li>
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
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6 mb-2">
              The three ideas stack in one direction. Ownership is the foundation; a borrow is a temporary permission
              granted by an owner; a lifetime is just the compiler&apos;s name for the span during which that borrow stays
              valid. Read the diagram top to bottom and notice that nothing below the owner can outlive it.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  O[Owner: holds the value, runs cleanup] --> S[Shared borrow &T: read-only view]\n  O --> M[Mutable borrow &mut T: exclusive access]\n  S --> L[Lifetime: borrow valid only while owner lives]\n  M --> L\n  L --> D[Owner dropped: all borrows must already be gone]`}
              caption="Ownership sits underneath; borrows are permissions the owner grants; the lifetime is the window in which a borrow is usable. The owner cannot be dropped while any borrow is still live."
            />
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Ownership as Rust&apos;s central abstraction</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Ownership is the reason moves, drops, borrows, thread handoff, and many API decisions line up into one
                  model. The owner is the place where cleanup responsibility lives. Once that is clear, borrowing becomes
                  a temporary permission story instead of a second memory-management model.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  This is why Rust often feels strict at subsystem edges. Queues, async tasks, caches, and stored structs
                  are all ownership decisions. They force you to state whether the next stage only observes data or must
                  outlive the current owner.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Borrowing rules</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              The whole borrow checker reduces to one exclusivity rule, and it is easier to hold as a small state machine
              than as a paragraph. At any moment a value is in exactly one of three states: nobody is borrowing it, several
              readers are, or one writer is. The forbidden combination is the one the diagram never lets you reach.
            </p>
            <MermaidDiagram
              chart={`stateDiagram-v2\n  [*] --> Free\n  Free --> Shared: take &T\n  Shared --> Shared: take another &T\n  Shared --> Free: last reader ends\n  Free --> Exclusive: take &mut T\n  Exclusive --> Free: writer ends\n  note right of Exclusive: only one &mut T, and no &T at the same time`}
              caption="Any number of shared readers, or exactly one exclusive writer, never both. Every borrow error is the compiler keeping you out of the missing fourth state: a writer plus a reader at once."
            />
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside mt-4">
              {borrowingRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium text-foreground mb-2">Shared references</div>
                <p className="text-sm text-muted-foreground leading-6">
                  Use <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&amp;T</code> when the callee
                  only needs to inspect data. Many readers are allowed at once because no one is mutating through those
                  aliases.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium text-foreground mb-2">Mutable references</div>
                <p className="text-sm text-muted-foreground leading-6">
                  Use <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&amp;mut T</code> when the
                  callee needs to change the value. Rust requires exclusivity here because mutation plus aliasing is one
                  of the places memory and concurrency bugs are born.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Lifetimes in function signatures</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              A lifetime parameter answers one question for a function that returns a reference: which input does the
              output borrow from? When there is only one candidate input, the answer is obvious and Rust writes it for you;
              when there are several, you have to point at the right one. The diagram traces that decision.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  R[Function returns a reference?] -->|no| Own[No lifetime needed]\n  R -->|yes| C[How many input borrows could it come from?]\n  C -->|one| El[Elision ties output to that input]\n  C -->|several| Ex[Write an explicit lifetime to pick which input]\n  El --> Ok[Output borrow tied to a real owner]\n  Ex --> Ok`}
              caption="The lifetime is not extending anything; it only records which input owner the returned reference is tied to. One input means elision can do it; several means you choose."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  A lifetime annotation matters when the compiler must understand how output references relate to input
                  references. A classic example is choosing one of two input references and returning it. The function is
                  not extending lifetime; it is documenting which borrowing relationship must hold.
                </p>
                <pre className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">
                    {`fn pick_longer<'a>(left: &'a str, right: &'a str) -> &'a str`}
                  </code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  When a function borrows from one input and returns a slice of that same input, the relationship is often
                  simple enough that Rust can infer it. This is where lifetime elision helps keep common signatures small
                  without changing the underlying model.
                </p>
                <pre className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`fn first_segment(path: &str) -> &str`}</code>
                </pre>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Lifetime elision</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              Elision is convenience, not a second ruleset. Rust still reasons about lifetimes; it simply fills in common
              cases for you. The useful operational reading is below.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {elisionRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The practical takeaway is simple: if there is one input borrow, elision often works. If there are several
                candidate input borrows and one output borrow, the relationship usually needs to be written explicitly.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Common lifetime traps for C++ and Go developers</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              {lifetimeTraps.map((trap) => (
                <div key={trap} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{trap}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Designing APIs around ownership</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              {ownershipDesignRules.map((rule) => (
                <div key={rule} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{rule}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A strong default for service code is this: accept borrowed input for local inspection, parsing, and
                validation; return owned output when the result should be stored, queued, retried, or otherwise decoupled
                from the caller&apos;s input buffer.
              </p>
            </div>
          </div>

        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Coming from another language</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            The mechanics of borrowing are not the hard part. The hard part is that ownership and aliasing rules you used
            to enforce by habit, by convention, or by trusting a runtime are now checked by the compiler. Each of these
            cards names the single mental-model shift that trips people up most when they bring instincts from a specific
            language.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {comparisons.map((comparison) => (
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
                The wrong repair for a lifetime problem is often “add more lifetimes.” The right repair is usually one of
                three moves: shorten the borrow, change the owner, or return owned data.
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
                <h4 className="font-semibold text-foreground">Example 1: shared borrow first, mutable borrow second</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Read through a shared reference, then take an exclusive mutable borrow only for the short mutation step.
                </p>
              </div>
              {codes.ownership_borrowing_shared_mutable !== DEFAULT_CODES.ownership_borrowing_shared_mutable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("ownership_borrowing_shared_mutable")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-2">
              What to look at: the shared borrow for <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">request_size</code> is
              created, used, and finished before <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">append_trace</code> ever
              asks for its mutable borrow. The two borrows do not overlap in time, which is exactly why the code compiles.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Own[request: owned String] -->|&request| Read[request_size reads len]\n  Read --> End[shared borrow ends]\n  End -->|&mut request| Write[append_trace pushes trace id]\n  Write --> Own2[request mutated in place]`}
              caption="Shared borrow first, then it ends, then the exclusive mutable borrow. Sequencing the two so they never coexist is the design move, not cloning."
            />
            <RustCodeEditor
              code={codes.ownership_borrowing_shared_mutable}
              onChange={(newCode) => updateCode("ownership_borrowing_shared_mutable", newCode)}
              onRun={() => runCode("ownership_borrowing_shared_mutable")}
              output={outputs.ownership_borrowing_shared_mutable ?? null}
              isRunning={isRunning === "ownership_borrowing_shared_mutable"}
              filename="shared_and_mutable_borrows.rs"
              expectedOutput={"len before = 10\nrequest = GET /ready trace=abc-123"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.ownership_borrowing_shared_mutable}
              onRevert={() => resetCode("ownership_borrowing_shared_mutable")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Borrowing rule in action</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The immutable borrow used for <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">request_size</code> ends before the mutable borrow begins. That sequencing is the real design tool.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Production translation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Inspect first, mutate second, and keep the exclusive borrow narrow. This pattern resolves a surprising
                  number of logging, parsing, and request-enrichment borrow errors.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: explicit lifetime where needed, owned output where cleaner</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  One helper uses lifetime elision, one requires an explicit relationship, and one deliberately returns an
                  owned string.
                </p>
              </div>
              {codes.ownership_borrowing_lifetimes !== DEFAULT_CODES.ownership_borrowing_lifetimes && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("ownership_borrowing_lifetimes")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-2">
              What to look at: compare where each function&apos;s result gets its validity. Two of them return a slice that
              borrows from an input, so their output lives only as long as that input; the third builds a brand-new
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">String</code> it owns outright. The diagram
              groups the three by that distinction.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  FS[first_segment path: &str] -->|one input, elided| Slice1[returns &str into path]\n  PL[pick_longer left, right: &'a str] -->|two inputs, explicit 'a| Slice2[returns &str into one of them]\n  Slice1 --> Borrowed[Output borrows: valid only while input lives]\n  Slice2 --> Borrowed`}
              caption="The two functions that return slices: first_segment uses elision because it has one input; pick_longer needs an explicit 'a to pick which of two inputs the result borrows from. Either way the output is valid only while that input lives."
            />
            <p className="text-sm text-muted-foreground leading-6">
              The third function takes the opposite path: instead of borrowing from an input, it builds and returns a value
              it owns.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  ML[make_audit_label service, key: &str] -->|builds new value| Owned[returns owned String]\n  Owned --> Free[Output is independent: outlives the inputs]`}
              caption="make_audit_label returns an owned String that survives on its own. Returning owned data is the deliberate escape from a borrow relationship."
            />
            <RustCodeEditor
              code={codes.ownership_borrowing_lifetimes}
              onChange={(newCode) => updateCode("ownership_borrowing_lifetimes", newCode)}
              onRun={() => runCode("ownership_borrowing_lifetimes")}
              output={outputs.ownership_borrowing_lifetimes ?? null}
              isRunning={isRunning === "ownership_borrowing_lifetimes"}
              filename="lifetimes_and_owned_boundaries.rs"
              expectedOutput={"segment = api\nlonger = request-id\nlabel = gateway::api"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.ownership_borrowing_lifetimes}
              onRevert={() => resetCode("ownership_borrowing_lifetimes")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Elision</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">first_segment</code> borrows from one input, so elision keeps the signature compact.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Explicit lifetime</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">pick_longer</code> chooses
                  between two inputs, so the returned reference relationship must be written.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">API shape</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">make_audit_label</code> returns
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">String</code> because the label
                  should outlive the borrowed inputs cleanly.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The exercise page asks you to repair borrow-checker failures without cloning by reflex, decide when explicit
            lifetime annotations are required, and design APIs that take borrowed input while returning owned output.
          </p>
          <Button onClick={() => setCurrentPage(7)} className="gap-2">
            Open Chapter 04 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Ownership is the main abstraction. Borrowing and lifetimes refine it; they do not replace it.</li>
            <li>Shared references permit many readers. Mutable references require exclusive access for the duration of mutation.</li>
            <li>Lifetimes describe valid reference relationships. They do not extend object lifetime or keep a dropped owner&apos;s data alive.</li>
            <li>Elision handles common cases, but multiple input borrows often require an explicit output relationship.</li>
            <li>Good production APIs often accept borrowed input and return owned data at subsystem boundaries.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
