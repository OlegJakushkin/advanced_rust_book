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
    title: "A graph problem is mostly an identity problem plus a traversal policy",
    body: "Rust does not make graphs hard because of algorithms. It makes you state who owns nodes, how edges refer to nodes, and which traversal should borrow, mutate, or parallelize the frontier.",
  },
  {
    title: "Stable indices are often simpler than borrowed references",
    body: "A graph stored in a `Vec<Node>` plus `NodeId` handles is usually easier to mutate, serialize, queue, and profile than a pointer-rich object graph with many long-lived borrows or ref-counted owners.",
  },
  {
    title: "Choose the search from the workload, not from habit",
    body: "BFS solves unweighted shortest hops. DFS explores structure and reachability. Dijkstra solves weighted shortest paths with non-negative costs. A* adds a heuristic when you can predict which frontier matters first.",
  },
]

const representationCards = [
  {
    title: "Adjacency list",
    body: "The default for sparse graphs. Store one node table and one per-node neighbor list. It is memory-efficient, easy to mutate, and usually the right base for BFS, DFS, Dijkstra, and dependency graphs.",
    code: `struct Node {
    edges: Vec<NodeId>,
}`,
  },
  {
    title: "Adjacency matrix",
    body: "Useful when the graph is dense, fixed-size, or when constant-time edge existence checks dominate. It is usually the wrong shape for sparse service graphs because memory grows with node_count squared.",
    code: `matrix[from * n + to]`,
  },
  {
    title: "Arena-backed graph",
    body: "A graph arena owns all nodes in one table and edges store handles. This is especially calm for ASTs, IR, mazes, dependency graphs, and other structures where logical identity matters more than pointer identity.",
    code: `struct Graph {
    nodes: Vec<Node>,
}`,
  },
]

const searchCards = [
  {
    title: "BFS",
    body: "Breadth-first search is the shortest-path tool for unweighted graphs. It explores in layers from the start node, which makes it ideal for maze steps, service hop count, and reachability radius.",
    code: `let mut queue = VecDeque::new();
queue.push_back(start);`,
  },
  {
    title: "DFS",
    body: "Depth-first search is excellent for structural exploration, cycle checks, reachability marking, and topological helpers. Recursive DFS is readable, but iterative DFS avoids deep stack risk on large graphs.",
    code: `let mut stack = vec![start];`,
  },
  {
    title: "Dijkstra",
    body: "Use Dijkstra when edges carry non-negative cost and you want the true minimum weighted path. The usual host-side Rust shape is one graph owner plus a `BinaryHeap` frontier.",
    code: `let mut heap = BinaryHeap::new();`,
  },
  {
    title: "A*",
    body: "Use A* when you can provide a heuristic that estimates remaining cost. An admissible heuristic never overestimates the true remaining cost and gives optimality; a consistent (monotone) heuristic additionally lets the standard closed-set A* finalize each node on first pop and never need to re-open it. Common grid distances such as Manhattan and Euclidean are consistent. A* often wins on mazes, grids, and route search because it avoids exploring obviously irrelevant frontier work.",
    code: `estimate = cost_so_far + heuristic(node, goal)`,
  },
]

const ownershipCards = [
  {
    title: "Ownership-friendly graph models",
    body: "Graph edges should usually store IDs or indices, not references into a growable vector. That keeps node ownership centralized and avoids reallocation invalidation and lifetime sprawl.",
  },
  {
    title: "Arena-backed graphs",
    body: "A `Vec<Node>` plus typed `NodeId` is the simplest arena-backed graph. It works well when nodes are appended, traversed, and sometimes mutated from one root owner.",
  },
  {
    title: "When shared ownership is still real",
    body: "If several subsystems truly co-own long-lived graph nodes, `Arc<T>` or `Rc<T>` may still be the right model. But most search problems only need one owner plus small handles.",
  },
]

const parallelCards = [
  {
    title: "Frontier parallelism",
    body: "Level-synchronous BFS and wide graph expansion can parallelize by frontier chunk or by edge bucket. The key is keeping the visited-set contract explicit so workers do not race on logical discovery.",
  },
  {
    title: "Visited-set contention",
    body: "A naive global mutex around one visited set can erase the benefit of parallel traversal. Many production designs shard by frontier chunk, use local next-frontier buffers, then merge once per level.",
  },
  {
    title: "Distributed graph search",
    body: "Once frontier work crosses processes or machines, the interesting questions become partitioning, duplicate suppression, trace lineage, and queue budgets rather than only local loop speed.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You may be used to pointer-rich graphs with node ownership handled by discipline or smart-pointer trees. Rust often gets calmer when you demote edges to `NodeId` and keep the node table as the real owner.",
  },
  {
    title: "C# background",
    body: "Think less in terms of object identity plus ambient references and more in terms of one owning table plus explicit handles. Traits and enums describe behavior; they do not need to become a graph storage model.",
  },
  {
    title: "Go background",
    body: "A slice of nodes plus integer handles will often feel more explicit than interface-heavy pointer graphs. Rust rewards that explicitness with calmer mutation, better locality, and fewer lifetime surprises.",
  },
]

const challengeTracks = [
  {
    title: "Maze solver",
    body: "Build one grid search that finds shortest unweighted steps, renders the path, and reports explored frontier width.",
    extensions: [
      "Add walls and diagonals as explicit policy choices.",
      "Switch between BFS and A* on the same maze and compare explored nodes.",
    ],
  },
  {
    title: "Dependency resolver",
    body: "Build one directed graph resolver that emits a valid build order, reports one cycle witness, and supports stable node IDs through refactors.",
    extensions: [
      "Add version conflict reporting or optional edges.",
      "Profile cycle-heavy graphs separately from clean DAG runs.",
    ],
  },
  {
    title: "Distributed graph search",
    body: "Partition one large search frontier across bounded workers, dedupe discoveries explicitly, and trace queue wait, expansion time, and merge lag.",
    extensions: [
      "Add retry budget and dead-frontier handling.",
      "Track critical-path or oldest-frontier age under load.",
    ],
  },
]

const productionPatterns = [
  "Use adjacency lists for sparse graphs and keep node ownership centralized in one root structure.",
  "Use typed stable indices such as `NodeId` for edges instead of storing references into a growable vector.",
  "Choose BFS for unweighted shortest hops, DFS for structure and cycle exploration, Dijkstra for weighted shortest paths, and A* when a useful heuristic exists.",
  "Keep maze, route, or dependency search policies explicit: edge direction, odd cases, heuristic validity, and cycle reporting should not be hidden in one helper.",
  "Parallelize the frontier only when the frontier is wide enough to amortize synchronization and merge cost.",
  "If search crosses threads, tasks, or processes, treat the frontier queue and visited-set budget as first-class observability surfaces.",
]

const pitfalls = [
  "Storing references into graph owners that later grow or reorder. The calm repair is usually stable indices, not more lifetimes.",
  "Using adjacency matrices for sparse service or dependency graphs and paying quadratic memory for no algorithmic win.",
  "Running recursive DFS on very deep graphs without thinking about stack depth or an iterative alternative.",
  "Using Dijkstra where BFS already solves the unweighted problem, or using A* with a heuristic that is not admissible (so optimality is lost) or not consistent (so the closed-set version may need to re-open nodes and break the claimed guarantee).",
  "Parallelizing graph search with one hot global visited lock and then blaming threads when the frontier stalls.",
  "Treating distributed graph search as only a bigger local BFS. The control plane changes once queueing, duplicate suppression, and trace lineage matter.",
]

const summaryPoints = [
  "Graph design in Rust is usually simpler when one owner keeps all nodes and edges store stable handles.",
  "Adjacency lists are the default sparse representation; matrices are better when density or fixed-size edge lookups dominate.",
  "BFS, DFS, Dijkstra, and A* each answer different search questions and should be chosen from edge and cost structure.",
  "Arena-backed graphs fit Rust well because they separate node ownership from edge identity cleanly.",
  "Parallel and distributed graph traversal are mostly about frontier budgeting, duplicate suppression, and observability once the algorithm itself is correct.",
]

export function PageCh39GraphSearchGames() {
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
  const pageIndex = getPageIndexById("ch39-graph-search-games")
  const chapter10PageIndex = getPageIndexById("ch10-arrays-slices-and-vectors")
  const chapter11PageIndex = getPageIndexById("ch11-hash-maps-and-sets")
  const chapter13PageIndex = getPageIndexById("ch13-arena-allocation")
  const chapter22PageIndex = getPageIndexById("ch22-multithreading-in-rust")
  const chapter26PageIndex = getPageIndexById("ch26-task-libraries-and-parallel-execution")
  const exercisesPageIndex = getPageIndexById("ch39-graph-search-games-exercises")
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
          Chapter 39 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Graph search workloads need clear graph ownership, traversal state, memory layout, and concurrency policy. This
          chapter covers search algorithms as production data-processing components.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 10, 11, 13, 22, and 26</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 10 covered contiguous storage and slice-first APIs. Chapter 11 covered hash-based visited sets
                and maps. Chapter 13 explained arena-backed ownership. Chapter 22 covered threads and shared-state
                tradeoffs. Chapter 26 covered bounded work orchestration. This chapter uses all of them.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter10PageIndex)}>
                Chapter 10
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter11PageIndex)}>
                Chapter 11
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter13PageIndex)}>
                Chapter 13
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter22PageIndex)}>
                Chapter 22
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter26PageIndex)}>
                Chapter 26
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A platform team is building a maze solver, a dependency resolver, and a distributed topology search. The
            business requirement is to choose graph ownership, representation, and traversal policy from the workload
            before adding parallelism or distributed execution.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Choose the graph representation from sparsity and mutation shape.</li>
              <li>Choose the node identity model from ownership: stable indices or explicit shared owners.</li>
              <li>Choose the search from cost structure: unweighted, weighted, heuristic, or structural.</li>
              <li>Only then decide whether the frontier should stay local, go parallel, or go distributed.</li>
            </ol>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">At a glance</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Choose representation from sparsity and mutation shape before choosing an algorithm.</li>
              <li>Prefer one owner plus stable handles when the graph grows, serializes, or crosses queue boundaries.</li>
              <li>Use BFS for unweighted hops, DFS for structure, Dijkstra for weighted shortest paths, and A* only when the heuristic is worth defending.</li>
              <li>Parallel or distributed frontiers add duplicate-suppression and merge-cost questions immediately.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">Design questions</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Is this graph sparse, dense, grid-shaped, or arena-friendly?</li>
              <li>What should an edge store: a stable handle, a weight, or a queued message?</li>
              <li>Which search policy matches the real cost model rather than the most advanced-looking algorithm?</li>
              <li>If the frontier widens, where do queue bounds, visited-state contention, and trace lineage become operational concerns?</li>
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
            <h4 className="font-semibold text-foreground mb-3">Graph representations in Rust</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {representationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                  <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                    <code className="font-mono text-foreground">{card.code}</code>
                  </pre>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                For most service, maze, and dependency workloads, adjacency lists win because the graph is sparse and
                edge iteration dominates. Adjacency matrices only become calm when the graph is dense enough or fixed
                enough that the quadratic storage buys a real lookup advantage.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">BFS, DFS, Dijkstra, and A*</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {searchCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                  <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                    <code className="font-mono text-foreground">{card.code}</code>
                  </pre>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                A common correction: do not use a more general weighted search when the workload is unweighted. BFS
                often gives the simplest correct answer and the simplest implementation.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Ownership-friendly graph models</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {ownershipCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                This is one of the main places Rust differs from many C++ or C# designs: the simpler graph is often one
                owner plus handles, not a web of objects each acting as an independent owner.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Arena-backed graphs</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Arena-backed graphs are especially useful when the graph is built as one batch, searched many times, and
              then discarded as one batch. That matches mazes, ASTs, dependency plans, route graphs, and many game
              worlds. A{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec&lt;Node&gt;</code> plus{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">NodeId</code> gives you stable logical
              identity without leaking references all over the system.
            </p>
            <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
struct NodeId(usize);

struct Graph {
    nodes: Vec<Node>,
}`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Parallel graph traversal</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {parallelCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The repository also includes a standalone example under{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                  examples/ch39_graph_search_games/parallel_frontier_levels.rs
                </code>{" "}
                that shows one level-synchronous frontier expansion shape outside the in-browser editor.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Notes for C++, C#, and Go engineers</h4>
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
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Practice projects</h3>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {challengeTracks.map((track) => (
              <div key={track.title} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="font-semibold text-foreground">{track.title}</div>
                </div>
                <p className="text-sm text-muted-foreground leading-6">{track.body}</p>
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Extensions</div>
                  <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                    {track.extensions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
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
                The most common graph-design mistake in Rust is trying to preserve a reference-rich object model from
                another language when a stable-index arena model would have made search, mutation, and serialization much
                easier.
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
                <h4 className="font-semibold text-foreground">Example 1: BFS over an adjacency list with stable handles</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The graph is owned in one node table. Edges are `NodeId` handles, BFS uses a queue, and the shortest
                  unweighted route is counted in hops.
                </p>
              </div>
              {codes.graph_search_bfs_handles !== DEFAULT_CODES.graph_search_bfs_handles && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("graph_search_bfs_handles")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.graph_search_bfs_handles}
              onChange={(newCode) => updateCode("graph_search_bfs_handles", newCode)}
              onRun={() => runCode("graph_search_bfs_handles")}
              output={outputs.graph_search_bfs_handles ?? null}
              isRunning={isRunning === "graph_search_bfs_handles"}
              filename="bfs_adjacency_handles.rs"
              expectedOutput={"bfs = api,auth,billing,search\npath hops = 2"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.graph_search_bfs_handles}
              onRevert={() => resetCode("graph_search_bfs_handles")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Representation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  One <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec&lt;Node&gt;</code> plus{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">NodeId</code> keeps ownership stable and makes edges cheap values.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Algorithm</div>
                <p className="text-xs text-muted-foreground leading-5">
                  BFS explores by layers, so the first time the goal is reached is the shortest unweighted hop count.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Operational fit</div>
                <p className="text-xs text-muted-foreground leading-5">
                  This is the calm shape for dependency graphs, service-route graphs, and maze steps when costs are uniform.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: weighted shortest path with Dijkstra and A*</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The graph keeps coordinates only because A* needs a heuristic. Dijkstra uses exact cost only; A* adds
                  a guess about the remaining distance.
                </p>
              </div>
              {codes.graph_search_dijkstra_astar !== DEFAULT_CODES.graph_search_dijkstra_astar && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("graph_search_dijkstra_astar")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.graph_search_dijkstra_astar}
              onChange={(newCode) => updateCode("graph_search_dijkstra_astar", newCode)}
              onRun={() => runCode("graph_search_dijkstra_astar")}
              output={outputs.graph_search_dijkstra_astar ?? null}
              isRunning={isRunning === "graph_search_dijkstra_astar"}
              filename="weighted_graph_dijkstra_astar.rs"
              expectedOutput={"dijkstra cost = 7\na_star cost = 7"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.graph_search_dijkstra_astar}
              onRevert={() => resetCode("graph_search_dijkstra_astar")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Weighted search</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Dijkstra is the correct baseline whenever edge costs matter and remain non-negative.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Heuristic</div>
                <p className="text-xs text-muted-foreground leading-5">
                  A* becomes useful only because the heuristic is explicit and tied to node coordinates.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Data structure</div>
                <p className="text-xs text-muted-foreground leading-5">
                  A `BinaryHeap` frontier makes the weighted next-best expansion policy explicit and efficient enough for most host-side work.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">examples/ch39_graph_search_games/</code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to implement BFS over an adjacency list, model graph nodes with stable
            indices, design a dependency resolver, and sketch a bounded distributed graph-search challenge with scoring tracks.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 39 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
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
