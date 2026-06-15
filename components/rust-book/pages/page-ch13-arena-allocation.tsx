"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Network, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "An arena is a lifetime policy packaged as storage",
    body: "The point is not only faster allocation. The point is that many values live together and die together. That lets you simplify ownership for whole phases of work: parse one request, build one AST, analyze one batch, then discard the region in one step.",
  },
  {
    title: "Arena design usually replaces pointers with handles or shared lifetimes",
    body: "You either borrow from the arena with one arena lifetime, or you store stable logical handles such as indices or typed IDs. Both approaches can be simpler than a graph of `Rc<RefCell<T>>` values with weak back-edges and runtime borrow checks.",
  },
  {
    title: "The real tradeoff is deallocation flexibility versus locality and simplicity",
    body: "Arenas are strong when most objects share one lifetime. They are awkward when objects need arbitrary individual deletion. The win is often locality, allocator calm, and easier graph construction. The cost is coarse-grained cleanup or more handle machinery.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "The mechanics are familiar from region allocators, pool allocators, and the pmr machinery, so the bump cursor and the whole-region reset will feel like home. The shift is that Rust forces you to declare, in the type, whether a value is a reference borrowed from the arena or an index handle into it. The aliasing and lifetime rules that you tracked by convention before are now checked by the compiler, which is why the reference-versus-handle choice is a real design decision rather than an implementation detail.",
  },
  {
    title: "C# background",
    body: "An arena is not a garbage collector feature and there is no finalizer thread reclaiming it later. The mental shift is that you, not the runtime, decide that a whole group of objects belongs to one phase and disappears together at a point you choose. You trade the convenience of the GC discovering dead objects for the predictability of releasing a region in one cheap step, with no pause and no nondeterministic timing.",
  },
  {
    title: "Go background",
    body: "This is not sync.Pool. A pool is about reusing individual objects across many lifetimes to dodge allocation; an arena is about grouping many objects into one lifetime so they die together. The shift is from thinking object-by-object to thinking phase-by-phase: a request parser, compiler front end, or query planner usually wants region semantics, where the whole working set is dropped at once, far more than it wants per-object reuse.",
  },
  {
    title: "Python background",
    body: "There is no reference counting walking the graph and no cyclic-GC pass to break cycles for you. The shift is that an arena sidesteps the cycle problem entirely: edges become integer handles, not owning references, so a parent-points-to-child-points-to-parent graph never forms a reference cycle in the first place. Instead of relying on a collector to eventually notice the region is dead, you own a single drop that frees all of it at a known moment.",
  },
]

const regionReasons = [
  "Parse or plan a whole request, query, or compilation unit, then drop the entire working set at once.",
  "Build object graphs where edges should be cheap handles rather than shared ref-counted pointers.",
  "Reduce allocator traffic in hot phases that create many small short-lived objects.",
  "Keep related data close together enough that traversal is cheaper and easier to reason about.",
]

const lifetimeModels = [
  {
    title: "Borrowed-from-arena references",
    body: "A reference arena gives you references tied to the arena's borrow. The idiomatic shape is `fn alloc<'a>(&'a self, value: T) -> &'a T`, often written simply as `fn alloc(&self, value: T) -> &T` and elided. In practice `typed-arena` returns `&mut T` so the caller can still mutate the newly allocated value. This is excellent for build-once, traverse-many trees where the arena outlives all reads. It is less comfortable when you need mutation after long-lived borrows exist, or when the data must cross wider subsystem boundaries.",
    signature: "fn alloc<'a>(&'a self, value: T) -> &'a mut T",
  },
  {
    title: "Index or ID handles",
    body: "An index arena stores owned values and returns handles such as `NodeId`. You reborrow from the owner when needed. This is usually easier for graphs, mutation, serialization, testing, and service boundaries, because the handle is a small value and the owner stays obvious.",
    signature: "fn alloc(&mut self, value: T) -> NodeId",
  },
]

const generationalNotes = [
  {
    title: "Plain arenas",
    body: "Best when objects are allocated, traversed, and dropped as one region. No individual free path, minimal bookkeeping, strong locality.",
  },
  {
    title: "Generational arenas",
    body: "Best when you want deletion and slot reuse without stale-handle bugs. The handle carries an index plus a generation counter, so a reused slot invalidates old handles instead of silently pointing at a different object.",
  },
  {
    title: "Slab allocation",
    body: "Best when many homogeneous objects come and go individually: connections, timers, parser states, or in-flight requests. Slabs are often about fast slot reuse and stable logical handles more than region teardown.",
  },
]

const tradeoffCards = [
  {
    title: "Deallocation",
    body: "Bump arenas are coarse-grained. The common free operation is `reset` or whole-arena drop. That is wonderfully cheap when lifetime grouping is real and frustrating when it is not.",
  },
  {
    title: "Fragmentation",
    body: "Arenas avoid some general-heap fragmentation and metadata overhead, but they can retain dead memory until the whole region is released. Slabs reduce different kinds of fragmentation by reusing fixed-size or slot-shaped storage.",
  },
  {
    title: "Locality",
    body: "Arena-backed traversals often improve cache behavior because related nodes are allocated close together. This is one of the most practical wins for ASTs, IR, query plans, and dense graph metadata.",
  },
  {
    title: "Destructor timing",
    body: "Dropping an arena may run many destructors at once. That can be fine for small pure data nodes and surprising for heavier objects. Senior designs usually keep arena contents boring: strings, nodes, indices, spans, and compact metadata.",
  },
]

const crateNotes = [
  {
    title: "`bumpalo`",
    body: "A practical ecosystem choice for bump-style region allocation when you want fast request-scoped or phase-scoped allocation.",
  },
  {
    title: "`typed-arena`",
    body: "Useful when you want typed arena allocation with arena-tied references for build-once, traverse-many data.",
  },
  {
    title: "`id-arena`",
    body: "A good fit when you prefer stable typed IDs over borrowed references and you want the owner plus handle model.",
  },
  {
    title: "`generational-arena` or `slotmap`",
    body: "Useful when deletion and reuse are part of the model and stale handles must fail cleanly instead of aliasing reused slots.",
  },
  {
    title: "`slab`",
    body: "A good fit for registries and runtime tables where fast insertion, removal, and reuse by slot index matter more than region-wide teardown.",
  },
]

const productionPatterns = [
  "Use a bump arena for request-scoped scratch allocations, parser nodes, temporary symbol tables, and other data that naturally dies with one phase.",
  "Use index-based arenas for ASTs, IR graphs, workflow DAGs, entity tables, and service registries where object identity matters more than long-lived borrowed references.",
  "Use generational handles when deletion and reuse are normal. A raw `usize` slot is not enough once stale-handle correctness matters.",
  "Keep arena contents simple and cheap to drop. If values own sockets, locks, or heavyweight buffers, question whether they belong in a coarse-grained region.",
  "Profile allocator counts and cache behavior before and after the change. Arena allocation is most persuasive when it removes real heap churn or improves traversal locality.",
]

const pitfalls = [
  "Choosing an arena only because borrow checking felt inconvenient. Arenas are a lifetime design tool, not a general excuse to stop thinking about ownership.",
  "Letting arena-borrowed references spread into async tasks, caches, or long-lived service structs whose lifetime is wider than the arena itself.",
  "Using plain index handles in a deleting or slot-reusing structure and then discovering stale-handle bugs later. That is the moment generational handles earn their cost.",
  "Putting arbitrarily mixed lifetimes into one long-lived arena and then wondering why memory usage grows until process shutdown.",
  "Comparing arena allocation only on raw allocation speed while ignoring the real question: does the workload actually share one lifetime policy?",
]

export function PageCh13ArenaAllocation() {
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
  const pageIndex = getPageIndexById("ch13-arena-allocation")
  const chapter04PageIndex = getPageIndexById("ch04-ownership-borrowing-and-lifetimes")
  const chapter06PageIndex = getPageIndexById("ch06-ownership-inside-vectors")
  const chapter09PageIndex = getPageIndexById("ch09-smart-pointers-and-pinning")
  const chapter10PageIndex = getPageIndexById("ch10-arrays-slices-and-vectors")
  const exercisesPageIndex = getPageIndexById("ch13-arena-allocation-exercises")
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
          Chapter 13 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Arena allocation supports workloads that create many related values under one lifecycle. This chapter uses
          region ownership and stable handles to reduce allocation overhead and simplify teardown.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 04, 06, 09, and 10</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Borrowing rules from Chapter 04, handle design from Chapter 06, smart-pointer tradeoffs from Chapter 09,
                and contiguous-storage reasoning from Chapter 10 all converge here. Arenas are easiest to understand once
                you see them as lifetime grouping plus locality, not as a mysterious allocator trick.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter04PageIndex)}>
                Chapter 04
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter06PageIndex)}>
                Chapter 06
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter09PageIndex)}>
                Chapter 09
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter10PageIndex)}>
                Chapter 10
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A query service parses requests, builds ASTs, resolves names, creates plans, and discards the working graph
            when each request finishes. The business requirement is region ownership: allocate phase-local data together,
            traverse it through arena references or stable handles, and release the whole region predictably.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">Why arena allocation matters</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {regionReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
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
          <p className="text-sm text-muted-foreground leading-6">
            The shape to hold in your head is two columns. On the left, the general heap tracks each object on its own:
            every allocation and every free is an independent event the allocator has to bookkeep. On the right, an arena
            tracks one region: every object is born into it, and the whole region is released in a single step. The arena
            does not make any one allocation magically faster so much as it collapses many free operations into one.
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  subgraph Heap[General heap]\n    A1[alloc node] --> F1[free node]\n    A2[alloc node] --> F2[free node]\n    A3[alloc node] --> F3[free node]\n  end`}
            caption="General heap: every object is freed on its own, so each allocation has a matching independent free the allocator must track."
          />
          <p className="text-sm text-muted-foreground leading-6">
            Side by side, the arena collapses all of those individual frees into one region teardown:
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  subgraph Arena[Arena region]\n    B1[alloc node] --> R[reset / drop once]\n    B2[alloc node] --> R\n    B3[alloc node] --> R\n  end`}
            caption="Arena region: many objects share one lifetime, so a single reset or drop reclaims all of them at once."
          />
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How this maps to other languages</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Most engineers arrive at arenas with a habit from another language, and the habit is usually close enough to
            be misleading. The cards below name the one mental-model shift that matters for each background, rather than
            the API differences, because the API is the easy part once the model is right.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {comparisonCallouts.map((comparison) => (
              <div key={comparison.title} className="rounded-lg border border-border bg-card p-4">
                <div className="font-semibold text-foreground mb-2">{comparison.title}</div>
                <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
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
            <h4 className="font-semibold text-foreground mb-3">Bump allocators</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  A bump allocator is the simplest arena shape. It maintains a cursor into a region. Allocation moves the
                  cursor forward. There is usually no per-object free. The cheap operation is whole-region reset or drop.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`request starts
  parse
  allocate scratch
  build temporary nodes
request ends
  reset arena once`}</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  That model is strong when most temporary objects share one scope. It is weak when individual objects
                  must be freed independently.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Object graphs without reference cycles</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  A common Rust repair for graph-shaped data is simple: let one arena own all nodes, then let edges store{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">NodeId</code> handles instead of{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Rc&lt;Node&gt;</code> pointers. The
                  graph becomes one owner plus cheap handles, not a web of ref-counted owners.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  This is often calmer than{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Rc&lt;RefCell&lt;T&gt;&gt;</code> for
                  ASTs, IR, routing graphs, and domain DAGs. You remove cycles by construction because edges are not
                  owners. You also regain explicit control over mutation and traversal from the arena root.
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground leading-6">
              The diagram below is the same graph drawn two ways. Look at where ownership lives. On the left every edge is
              an owner, so a back-edge from D to A forms a reference cycle that never drops to zero and leaks. On the right
              the arena is the only owner and every edge is just an index, so the identical back-edge is harmless data and
              one drop frees the whole region.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph RC[Rc edges own]\n    A[Node A] -->|owns| B[Node B]\n    B -->|owns| D[Node D]\n    D -->|owns, back-edge| A\n  end`}
              caption="Owning Rc edges: the back-edge from D to A closes a reference cycle that never drops to zero, so the whole loop leaks."
            />
            <p className="text-sm text-muted-foreground leading-6">
              Side by side, the same shape redrawn so the arena is the only owner and every edge is just an index:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph IDX[Arena + index edges]\n    Ar[(Arena owns all)] --> N0[id 0]\n    Ar --> N1[id 1]\n    Ar --> N3[id 3]\n    N0 -->|edge id 1| N1\n    N1 -->|edge id 3| N3\n    N3 -->|edge id 0, back-edge| N0\n  end`}
              caption="Index edges into a single-owner arena: the identical back-edge is now a harmless integer, and one drop frees the whole region."
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Arena-backed ASTs</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  ASTs are a near-perfect arena workload. You parse once, build many small nodes, connect them densely,
                  run analysis passes, and then discard the whole tree. A region allocator or ID arena usually matches the
                  operational truth better than individually boxed nodes.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>Node creation is append-only during parsing.</li>
                  <li>Traversal is read-heavy after construction.</li>
                  <li>Edges are usually logical identity, not shared ownership.</li>
                  <li>The whole tree often dies as one batch.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Lifetimes with arenas</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {lifetimeModels.map((model) => (
                <div key={model.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{model.title}</div>
                  <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                    <code className="font-mono text-foreground">{model.signature}</code>
                  </pre>
                  <p className="mt-3 text-sm text-muted-foreground leading-6">{model.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground leading-6">
              The difference is what crosses the boundary back to the caller. A reference arena hands back a borrow that
              is chained to the arena&apos;s lifetime, so the borrow checker will not let that reference outlive the
              arena. An index arena hands back a small plain value that owns nothing, so it can travel anywhere; the cost
              is that you must go back to the arena to turn the handle into data.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  C[Caller] -->|"alloc(value)"| Ar[Arena]\n  Ar -->|"&'a T borrow, tied to arena"| RefPath[Use within arena lifetime]\n  Ar -->|"NodeId, plain value"| IdPath[Travel anywhere]\n  IdPath -->|"arena.get(id)"| Ar`}
              caption="Two return shapes from the same alloc call: a borrow welded to the arena's lifetime, or a handle that owns nothing and must be resolved back through the arena."
            />
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                A useful rule: if you want data to cross async tasks, queues, caches, or other long-lived subsystem
                boundaries, prefer owned values or stable handles. Arena-borrowed references are strongest when the whole
                phase stays local and synchronous.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Generational arenas and slab allocation</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {generationalNotes.map((note) => (
                <div key={note.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{note.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{note.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground leading-6">
              The whole point of a generation counter is what happens to a slot after it is freed and reused. A plain{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">usize</code> index would still point at
              the slot and silently read whatever now lives there. A generational handle carries the generation it was
              issued for: when a slot is removed its generation is bumped, so a handle minted earlier no longer matches and
              the lookup fails cleanly instead of aliasing the new occupant. That clean failure is exactly the bug class a
              raw index cannot protect against.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Tradeoffs: deallocation, fragmentation, locality</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {tradeoffCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Practical crates and implementation patterns</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              {crateNotes.map((note) => (
                <div key={note.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{note.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{note.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The choice is less about crate popularity than about model fit. Ask three questions first: do I want
                arena-tied references or handles, do I need deletion, and does stale-handle protection matter?
              </p>
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
                The best arena optimization is often not “allocation became faster.” It is “the lifetime model became
                honest.” If the workload does not actually share one region lifetime, the arena will eventually expose that
                mismatch.
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
                <h4 className="font-semibold text-foreground">Example 1: a tiny bump allocator for request-scoped scratch</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Allocation only moves the cursor forward. Reset drops the whole region's logical contents in one step.
                </p>
              </div>
              {codes.arena_allocation_bump_scratch !== DEFAULT_CODES.arena_allocation_bump_scratch && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("arena_allocation_bump_scratch")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: there is exactly one piece of mutable state, the{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">used</code> cursor. Every allocation
              only moves it forward, and the single cheap teardown sets it back to zero. There is no per-allocation free
              path anywhere in the type. The diagram traces what the cursor does for the exact byte strings in{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">main</code>.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  S["used = 0"] -->|"alloc b'arena123' (8)"| A["used = 8"]\n  A -->|"alloc b'logs' (4)"| B["used = 12"]\n  B -->|"read slice (0..8)"| R["arena123"]\n  B -->|"reset()"| Z["used = 0"]`}
              caption="The cursor only ever moves forward on alloc; reset snaps it back to zero in one step, logically discarding everything at once."
            />
            <RustCodeEditor
              code={codes.arena_allocation_bump_scratch}
              onChange={(newCode) => updateCode("arena_allocation_bump_scratch", newCode)}
              onRun={() => runCode("arena_allocation_bump_scratch")}
              output={outputs.arena_allocation_bump_scratch ?? null}
              isRunning={isRunning === "arena_allocation_bump_scratch"}
              filename="fixed_bump_buffer.rs"
              expectedOutput={"used = 12\nfirst = arena123\nafter reset = 0"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.arena_allocation_bump_scratch}
              onRevert={() => resetCode("arena_allocation_bump_scratch")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: change the byte strings or arena size and rerun. The important part is the lifetime model:
              append-only allocation now, coarse reset later.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Design choice</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The example returns ranges, not long-lived borrowed slices, so later allocations stay simple and safe.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Production translation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  This is the shape to use for request-scoped scratch buffers, parser workspaces, and temporary packing
                  regions.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 2: arena-backed AST with stable IDs instead of{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Rc</code> edges
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  One owner stores all nodes. Expressions point to each other by{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">ExprId</code>, and evaluation
                  reborrows from
                  the arena root.
                </p>
              </div>
              {codes.arena_allocation_index_ast !== DEFAULT_CODES.arena_allocation_index_ast && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("arena_allocation_index_ast")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the enum variants hold{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">ExprId</code> values, not{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Box&lt;Expr&gt;</code> or{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Rc&lt;Expr&gt;</code>. A node never owns
              another node; the arena owns them all in one vector, and an edge is just an index into that vector. The
              diagram is the tree this program builds, with each node labelled by the slot it lands in.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Root["id 4: Mul"] --> Sum["id 3: Add"]\n  Root --> Four["id 2: Number(4)"]\n  Sum --> Two["id 0: Number(2)"]\n  Sum --> Three["id 1: Number(3)"]`}
              caption="The expression (2 + 3) * 4 as five arena slots. eval walks the tree by resolving each ExprId back through the arena, so 2 + 3 = 5 then 5 * 4 = 20, across 5 nodes."
            />
            <RustCodeEditor
              code={codes.arena_allocation_index_ast}
              onChange={(newCode) => updateCode("arena_allocation_index_ast", newCode)}
              onRun={() => runCode("arena_allocation_index_ast")}
              output={outputs.arena_allocation_index_ast ?? null}
              isRunning={isRunning === "arena_allocation_index_ast"}
              filename="arena_indexed_ast.rs"
              expectedOutput={"value = 20\nnodes = 5"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.arena_allocation_index_ast}
              onRevert={() => resetCode("arena_allocation_index_ast")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: change the numbers or operator structure and rerun. The real lesson is that the graph has one
              owner and no reference cycle problem to solve.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Owner</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The arena owns every node in one contiguous table.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Edges</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">ExprId</code> is logical identity,
                  not shared ownership.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Tradeoff</div>
                <p className="text-xs text-muted-foreground leading-5">
                  You give up direct references in exchange for simpler mutation, simpler graphs, and clearer ownership.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to build a tiny arena-backed AST, compare an{" "}
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Rc</code> graph with an arena-and-handle
            graph, and reason explicitly about deallocation, locality, and deletion tradeoffs.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 13 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Arena allocation is batch lifetime management, not only fast allocation.</li>
            <li>Bump allocators are strongest when many objects share one phase and can be reset together.</li>
            <li>Arena-backed graphs often replace pointer ownership with handles, which removes many cycle and mutation problems.</li>
            <li>Arena-tied references are powerful for local read-heavy phases; handle-based arenas are often calmer for mutation and subsystem boundaries.</li>
            <li>Generational arenas and slabs exist for workloads that need deletion, reuse, and stale-handle protection.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
