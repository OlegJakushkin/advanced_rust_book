"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
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
    body: "If you have used region allocators, pool allocators, or `pmr`-style allocation strategies, the idea will feel familiar. Rust adds a sharper distinction between arena-borrowed references and index-based handles, because aliasing and lifetime rules stay explicit.",
  },
  {
    title: "C# background",
    body: "This is not a garbage collector feature. It is a deliberate lifetime grouping tool. Instead of letting the runtime discover dead objects later, you decide that a whole region of objects belongs to one phase and goes away together.",
  },
  {
    title: "Go background",
    body: "This is not the same as `sync.Pool`. Pools are about reuse across lifetimes. Arenas are about grouping lifetimes. A request parser, compiler front-end, or query planner often wants region semantics more than reuse semantics.",
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
                  A common Rust repair for graph-shaped data is simple: let one arena own all nodes, then let edges store
                  `NodeId` handles instead of `Rc<Node>` pointers. The graph becomes one owner plus cheap handles, not a
                  web of ref-counted owners.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  This is often calmer than `Rc<RefCell<T>>` for ASTs, IR, routing graphs, and domain DAGs. You remove
                  cycles by construction because edges are not owners. You also regain explicit control over mutation and
                  traversal from the arena root.
                </p>
              </div>
            </div>
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

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">translating prior instincts</h4>
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
                <h4 className="font-semibold text-foreground">Example 2: arena-backed AST with stable IDs instead of `Rc` edges</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  One owner stores all nodes. Expressions point to each other by `ExprId`, and evaluation reborrows from
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
                  `ExprId` is logical identity, not shared ownership.
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
            The companion exercise page asks you to build a tiny arena-backed AST, compare an `Rc` graph with an
            arena-and-handle graph, and reason explicitly about deallocation, locality, and deletion tradeoffs.
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
````

### File: `components/rust-book/pages/page-ch13-arena-allocation-exercises.tsx`
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
    title: "Choose region lifetime, shared ownership, or ordinary ownership on purpose",
    objective: "Practice deciding whether a workload really wants an arena instead of a normal owner graph or ref-counted sharing.",
    starterPrompt:
      "Classify four cases: a request parser that builds a temporary AST, a long-lived cache entry graph with arbitrary eviction, a single-thread UI tree with parent links, and a connection registry with frequent insert/remove operations.",
    prompts: [
      "Which case has one coarse-grained lifetime and therefore fits an arena best?",
      "Which case wants deletion and reuse rather than region teardown?",
      "Which case may still justify `Rc` or `Weak` because sharing is semantically real?",
      "Which case should probably stay ordinary owned structs and vectors?",
    ],
    acceptanceCriteria: [
      "You identify at least one strong arena candidate and justify it with shared lifetime, not only performance hope.",
      "You distinguish deletion-heavy registries from pure region workloads.",
      "You explain at least one case where shared ownership remains semantically real and an arena is not automatically better.",
    ],
    hints: [
      "Ask first: do these values live and die together?",
      "If arbitrary individual deletion is part of the job, a pure bump arena is usually the wrong first tool.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Compare an `Rc` graph with an arena-and-handle graph",
    objective: "Read two designs and explain the ownership and operational differences instead of only saying one is faster.",
    starterPrompt:
      "Compare a small AST built with `Rc<RefCell<Node>>` and parent/child pointers against an AST built as `Vec<Node>` plus `NodeId` handles.",
    prompts: [
      "Where does ownership live in each design?",
      "Where would cycle or runtime borrow problems appear in the `Rc<RefCell<T>>` design?",
      "What does the handle-based design give up, and what does it gain?",
      "Which design is calmer for serialization, testing, or mutation from the owner root?",
    ],
    acceptanceCriteria: [
      "You explain one-owner-plus-handles versus shared ref-counted ownership precisely.",
      "You name runtime borrow checks and cycle risk as concrete tradeoffs in the `Rc<RefCell<T>>` version.",
      "You name at least one benefit and one cost of the arena-and-handle version.",
    ],
    hints: [
      "The question is not only about speed. It is about where ownership and mutation authority live.",
      "Try to answer as if you were reviewing the design with another senior engineer.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Build a tiny arena-backed AST",
    objective: "Implement a small owner-plus-handle AST so evaluation reborrows from the arena instead of walking shared pointers.",
    starterPrompt:
      "Implement `ExprArena` with `ExprId`, `Expr::Number`, and `Expr::Add`, then allocate two numbers and one add node and evaluate the result.",
    prompts: [
      "Keep the owner as `Vec<Expr>`.",
      "Return `ExprId` from allocation.",
      "Evaluate by recursively looking nodes up from `&self`.",
      "Do not use `Rc`, `RefCell`, or raw pointers.",
    ],
    acceptanceCriteria: [
      "The arena owns all nodes in one vector.",
      "The API returns handles rather than borrowed node references.",
      "Evaluation works by reborrowing from the arena root.",
      "The runnable lab prints the expected value and node count.",
    ],
    hints: [
      "This is the same basic pattern used in many AST and IR builders.",
      "If the arena is the owner, handles are enough for edges.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair a stale-handle design before deletion lands in production",
    objective: "Replace plain slot indices with a handle strategy that stays honest once removal and reuse appear.",
    starterPrompt:
      "You inherit a table-backed registry that stores objects in `Vec<Option<T>>` and hands out raw `usize` indices. A new requirement adds removal and slot reuse.",
    prompts: [
      "Why can a plain `usize` become a stale logical identity after reuse?",
      "Would a free list plus generation counter repair the handle story?",
      "When would a generational arena or slot map be cheaper than hand-rolled bookkeeping?",
    ],
    acceptanceCriteria: [
      "You explain the stale-handle failure mode concretely.",
      "You propose a handle scheme with generation or another explicit validity check.",
      "You justify when to keep a custom design and when to move to a specialized crate.",
    ],
    hints: [
      "Deletion changes the semantics of a handle, not only the storage.",
      "A stale handle bug is usually much worse than a few bytes of extra metadata.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "List deallocation and locality tradeoffs like a production reviewer",
    objective: "Practice stating the real arena tradeoffs without slogans.",
    starterPrompt:
      "Review a proposal to use a bump arena for a compiler front-end pass and write a short tradeoff note for the team.",
    prompts: [
      "What becomes cheaper about allocation and cleanup?",
      "What deallocation flexibility is lost?",
      "Why might locality improve?",
      "What kinds of values do not belong in this region by default?",
    ],
    acceptanceCriteria: [
      "You name both the cleanup win and the coarse-grained free limitation.",
      "You mention locality or cache behavior explicitly.",
      "You call out at least one kind of heavy or long-lived value that should probably stay outside the arena.",
    ],
    hints: [
      "A good answer mentions lifetime grouping, not just 'fewer mallocs.'",
      "If a value has a wider lifetime than the pass, it is a bad arena resident by default.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose bump arena, generational arena, slab, or general allocation for a service",
    objective: "Map four different allocator shapes to one realistic distributed-service design.",
    starterPrompt:
      "You are designing `request bytes -> parse -> build AST -> route to workers -> track live connections -> evict idle sessions -> persist summaries`.",
    prompts: [
      "Which phase wants a request-scoped bump arena?",
      "Which runtime table wants deletion plus stale-handle protection?",
      "Which part wants slot reuse because the objects are homogeneous and churn heavily?",
      "Which data should stay under ordinary ownership because its lifetime is wide or mixed?",
    ],
    acceptanceCriteria: [
      "You choose at least one bump-arena phase, one generational or slot-based table, and one part that stays ordinary allocation.",
      "You justify each choice with lifetime shape and mutation pattern.",
      "You mention at least one testing or observability hook, such as allocation count, handle-validity assertions, or memory-usage tracking.",
    ],
    hints: [
      "One system can legitimately use more than one allocation policy.",
      "The cleanest answer names the owner and lifetime boundary at each stage.",
    ],
  },
]

const reviewQuestions = [
  "What makes an arena a lifetime design tool rather than only an optimization?",
  "When is a handle-based arena calmer than `Rc<RefCell<T>>`?",
  "Why do generational handles exist, and what bug class do they prevent?",
  "What is the practical difference between a bump arena and a slab allocator?",
  "Why are arena-borrowed references often a poor fit for async or long-lived subsystem boundaries?",
]

const workingLoop = [
  "State the lifetime shape first: whole phase, slot reuse, or arbitrary mixed lifetimes.",
  "Pick the owner model second: borrowed-from-arena references or stable handles.",
  "Name what deallocation flexibility you are giving up in exchange for locality or allocator calm.",
  "If deletion exists, ask immediately whether stale-handle protection is now required.",
]

export function PageCh13ArenaAllocationExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = 25
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 13 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice choosing arenas where the lifetime model is real, not fashionable, and translating graphs into one
          owner plus stable handles when that makes the system calmer.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as an ownership and lifetime review. The best answer does not stop at “arena = fast.”
                It explains which values share a lifetime, where ownership lives, what handle policy exists, and what
                deallocation tradeoff the team is accepting.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(24)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 13
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
                  Arena design drill
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
          title="Runnable lab · Tiny arena-backed AST"
          description={
            <>
              Fix the evaluator so it computes an addition node by reborrowing from the arena. The checker expects the
              final expression to evaluate to{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">42</code> with exactly three nodes
              allocated.
            </>
          }
          filename="arena_ast_lab.rs"
          runKey="ch13_ex_arena_ast"
          expectedOutput={"value = 42\nnodes = 3"}
          helperText={
            <>
              Tip: keep the owner as <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Vec&lt;Expr&gt;</code>,
              return <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">ExprId</code> from allocation,
              and make the <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Add</code> branch call{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">self.eval</code> on both children.
            </>
          }
          initialCode={`#[derive(Clone, Copy, Debug, PartialEq, Eq)]\nstruct ExprId(usize);\n\n#[derive(Debug)]\nenum Expr {\n    Number(i64),\n    Add(ExprId, ExprId),\n}\n\n#[derive(Default)]\nstruct ExprArena {\n    nodes: Vec<Expr>,\n}\n\nimpl ExprArena {\n    fn alloc(&mut self, expr: Expr) -> ExprId {\n        let id = ExprId(self.nodes.len());\n        self.nodes.push(expr);\n        id\n    }\n\n    fn eval(&self, id: ExprId) -> i64 {\n        match &self.nodes[id.0] {\n            Expr::Number(value) => *value,\n            Expr::Add(left, right) => 0,\n        }\n    }\n}\n\nfn main() {\n    let mut arena = ExprArena::default();\n    let left = arena.alloc(Expr::Number(10));\n    let right = arena.alloc(Expr::Number(32));\n    let root = arena.alloc(Expr::Add(left, right));\n\n    println!(\"value = {}\", arena.eval(root));\n    println!(\"nodes = {}\", arena.nodes.len());\n}`}
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
            By the end of this page, you should be able to explain when an arena is the right lifetime model, build a
            tiny AST with owner-plus-handle design, compare that model against `Rc` graphs without hand-waving, and
            choose bump arenas, generational arenas, slabs, or ordinary ownership from workload shape rather than habit.
          </p>
        </section>
      </div>
    </div>
  )
}
````

### File: `examples/ch13_arena_allocation/fixed_bump_buffer.rs`
````
struct Bump<const N: usize> {
    buf: [u8; N],
    used: usize,
}

impl<const N: usize> Bump<N> {
    fn new() -> Self {
        Self {
            buf: [0; N],
            used: 0,
        }
    }

    fn alloc_bytes(&mut self, bytes: &[u8]) -> Option<(usize, usize)> {
        let end = self.used.checked_add(bytes.len())?;
        if end > N {
            return None;
        }

        let start = self.used;
        self.buf[start..end].copy_from_slice(bytes);
        self.used = end;
        Some((start, end))
    }

    fn slice(&self, range: (usize, usize)) -> &[u8] {
        &self.buf[range.0..range.1]
    }

    fn used(&self) -> usize {
        self.used
    }

    fn reset(&mut self) {
        self.used = 0;
    }
}

fn main() {
    let mut arena = Bump::<32>::new();
    let first = arena.alloc_bytes(b"arena123").unwrap();
    let _second = arena.alloc_bytes(b"logs").unwrap();

    println!("used = {}", arena.used());
    println!(
        "first = {}",
        std::str::from_utf8(arena.slice(first)).unwrap()
    );

    arena.reset();
    println!("after reset = {}", arena.used());
}
````

### File: `examples/ch13_arena_allocation/arena_indexed_ast.rs`
````
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct ExprId(usize);

#[derive(Debug)]
enum Expr {
    Number(i64),
    Add(ExprId, ExprId),
    Mul(ExprId, ExprId),
}

#[derive(Default)]
struct ExprArena {
    nodes: Vec<Expr>,
}

impl ExprArena {
    fn alloc(&mut self, expr: Expr) -> ExprId {
        let id = ExprId(self.nodes.len());
        self.nodes.push(expr);
        id
    }

    fn get(&self, id: ExprId) -> &Expr {
        &self.nodes[id.0]
    }

    fn eval(&self, id: ExprId) -> i64 {
        match self.get(id) {
            Expr::Number(value) => *value,
            Expr::Add(left, right) => self.eval(*left) + self.eval(*right),
            Expr::Mul(left, right) => self.eval(*left) * self.eval(*right),
        }
    }

    fn len(&self) -> usize {
        self.nodes.len()
    }
}

fn main() {
    let mut arena = ExprArena::default();

    let two = arena.alloc(Expr::Number(2));
    let three = arena.alloc(Expr::Number(3));
    let four = arena.alloc(Expr::Number(4));
    let sum = arena.alloc(Expr::Add(two, three));
    let root = arena.alloc(Expr::Mul(sum, four));

    println!("value = {}", arena.eval(root));
    println!("nodes = {}", arena.len());
}
````

### File: `components/rust-book/types.ts`
````diff
--- components/rust-book/types.ts
+++ components/rust-book/types.ts
@@ -2,6 +2,7 @@
 import { DEFAULT_CODES_CH10 } from "./default-codes-ch10"
 import { DEFAULT_CODES_CH11 } from "./default-codes-ch11"
 import { DEFAULT_CODES_CH12 } from "./default-codes-ch12"
+import { DEFAULT_CODES_CH13 } from "./default-codes-ch13"
 
 export interface PageConfig {
   id: string
@@ -297,6 +298,29 @@ export const CHAPTERS: ChapterConfig[] = [
         icon: "trophy",
       },
     ],
+  },
+  {
+    id: "ch13-arena-allocation",
+    title: "Chapter 13 · Arena Allocation and Region-Based Memory",
+    icon: "book",
+    pages: [
+      {
+        id: "ch13-arena-allocation",
+        title: "Arena Allocation and Region-Based Memory",
+        shortTitle: "Arena Allocation",
+        description:
+          "Bump allocators, arena-backed ASTs, region lifetimes, generational handles, slabs, and locality tradeoffs",
+        icon: "book",
+        codeKeys: ["arena_allocation_bump_scratch", "arena_allocation_index_ast"],
+      },
+      {
+        id: "ch13-arena-allocation-exercises",
+        title: "Chapter 13 Exercises",
+        shortTitle: "Exercises",
+        description:
+          "Build a tiny arena-backed AST, compare Rc graphs with arena handles, and reason about lifetime-grouped memory",
+        icon: "trophy",
+      },
+    ],
   },
 ]
 
@@ -728,6 +752,7 @@ export const DEFAULT_CODES: Record<string, string> = {
   ...DEFAULT_CODES_CH10,
   ...DEFAULT_CODES_CH11,
   ...DEFAULT_CODES_CH12,
+  ...DEFAULT_CODES_CH13,
 }
 
 export interface BookState {
````

### File: `components/rust-book/pages/index.ts`
````diff
--- components/rust-book/pages/index.ts
+++ components/rust-book/pages/index.ts
@@ -22,3 +22,5 @@ export { PageCh11HashMapsAndSetsExercises } from "./page-ch11-hash-maps-and-set
 export { PageCh12MatricesAndMultidimensionalData } from "./page-ch12-matrices-and-multidimensional-data"
 export { PageCh12MatricesAndMultidimensionalDataExercises } from "./page-ch12-matrices-and-multidimensional-data-exercises"
+export { PageCh13ArenaAllocation } from "./page-ch13-arena-allocation"
+export { PageCh13ArenaAllocationExercises } from "./page-ch13-arena-allocation-exercises"
````

### File: `components/rust-book/index.tsx`
````diff
--- components/rust-book/index.tsx
+++ components/rust-book/index.tsx
@@ -33,6 +33,8 @@ import {
   PageCh11HashMapsAndSetsExercises,
   PageCh12MatricesAndMultidimensionalData,
   PageCh12MatricesAndMultidimensionalDataExercises,
+  PageCh13ArenaAllocation,
+  PageCh13ArenaAllocationExercises,
 } from "./pages"
 
 const PAGE_COMPONENTS = [
@@ -61,6 +63,8 @@ const PAGE_COMPONENTS = [
   PageCh11HashMapsAndSetsExercises,
   PageCh12MatricesAndMultidimensionalData,
   PageCh12MatricesAndMultidimensionalDataExercises,
+  PageCh13ArenaAllocation,
+  PageCh13ArenaAllocationExercises,
 ]
 
 function BookContent() {
````

### File: `components/rust-book/rust-simulator.ts`
````diff
--- components/rust-book/rust-simulator.ts
+++ components/rust-book/rust-simulator.ts
@@ -1,7 +1,9 @@
+import { simulateCh13Output } from "./rust-simulator-ch13"
 import { simulateCh12Output } from "./rust-simulator-ch12"
 import { simulateCh11Output } from "./rust-simulator-ch11"
 import { simulateCh10Output } from "./rust-simulator-ch10"
 import { simulateCh09Output } from "./rust-simulator-ch09"
+
 
 export const RUST_COMPILER_ERROR_PREFIX = "__RUSTC_ERROR__\n"
 
@@ -991,6 +993,9 @@ export function simulateRustExecution(code: string, key?: string, filename = "ma
   const compilationError = findCompilationError(code, filename)
   if (compilationError) return compilationError
 
+  const ch13Output = simulateCh13Output(code, key)
+  if (ch13Output !== null) return ch13Output
+
   const ch12Output = simulateCh12Output(code, key)
   if (ch12Output !== null) return ch12Output
 
````