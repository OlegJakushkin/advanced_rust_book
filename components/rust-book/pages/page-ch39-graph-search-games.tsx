"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Network, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "A graph problem is two problems: how nodes are stored, and how the frontier moves",
    body: "The algorithms here are the same ones you already know from any language. What Rust forces into the open is the storage decision underneath them. Before you write a single line of traversal, you have to answer who owns the nodes, what an edge actually holds, and whether the search loop will read, mutate, or split that storage. Get those answers wrong and the borrow checker fights you on every line; get them right and the algorithm reads like a textbook.",
  },
  {
    title: "Reach for stable indices before you reach for references or smart pointers",
    body: "The instinct from pointer-based languages is to make a node hold pointers to its neighbors. In Rust that instinct leads to lifetime sprawl and reallocation hazards the moment the graph grows. The calm alternative is to keep every node in one Vec and let edges store a small Copy handle (a NodeId wrapping a usize). That handle survives reallocation, serializes cleanly, fits in a queue, and never ties one node's lifetime to another's.",
  },
  {
    title: "Pick the search from the cost model, not from how advanced it looks",
    body: "Each traversal answers a different question. BFS finds the fewest hops on an unweighted graph because it expands strictly outward in layers. DFS walks structure deeply and is the natural fit for cycle detection and topological ordering. Dijkstra finds the true minimum-cost path when edges carry non-negative weights. A* is Dijkstra plus a heuristic that estimates the remaining distance, so it skips frontier work that obviously cannot help. The mistake is reaching for the fanciest one out of habit when a simpler one already answers the question.",
  },
]

const representationCards = [
  {
    title: "Adjacency list",
    body: "Each node carries a list of the nodes it points to. This is the default for sparse graphs, where most pairs of nodes are not connected, which covers nearly every service map, dependency graph, and maze you will meet. Memory scales with the number of edges that actually exist, iterating a node's neighbors is direct, and adding an edge is a single push. It is the right base for BFS, DFS, and Dijkstra.",
    code: `struct Node {
    edges: Vec<NodeId>,
}`,
  },
  {
    title: "Adjacency matrix",
    body: "A flat n-by-n table where one cell answers \"is there an edge from i to j?\" in constant time. That lookup is its only real advantage, and it pays for it with memory that grows as the square of the node count. It earns its keep on dense graphs, fixed small sizes, or hot inner loops that ask the edge-existence question constantly. On a sparse service graph it is almost always the wrong shape.",
    code: `matrix[from * n + to]`,
  },
  {
    title: "Arena-backed graph",
    body: "One owning table holds every node, and edges are handles into that table rather than pointers between objects. The graph is built as a batch, searched many times, and dropped as a batch. This is the calmest shape in Rust for ASTs, intermediate representations, mazes, dependency plans, and game worlds, because logical identity (which node) is decoupled from memory identity (which address).",
    code: `struct Graph {
    nodes: Vec<Node>,
}`,
  },
]

const searchCards = [
  {
    title: "BFS — fewest hops, no weights",
    body: "Breadth-first search keeps a FIFO queue and expands the graph in concentric layers around the start node. Because it finishes a whole layer before touching the next, the first time it reaches a node is along a path with the fewest edges. That makes it the correct and simplest tool for unweighted shortest paths: maze steps, service hop counts, and reachability within a fixed radius.",
    code: `let mut queue = VecDeque::new();
queue.push_back(start);`,
  },
  {
    title: "DFS — structure, cycles, ordering",
    body: "Depth-first search follows one path as far as it goes before backtracking. It is the natural fit for exploring structure: detecting cycles, marking reachable sets, and producing topological orders. Recursive DFS reads cleanly, but on a deep graph it can overflow the call stack, so an explicit Vec used as a stack is the safer shape for large or untrusted inputs.",
    code: `let mut stack = vec![start];`,
  },
  {
    title: "Dijkstra — true minimum cost",
    body: "When edges carry non-negative weights, Dijkstra finds the genuinely cheapest path. It pops the lowest-cost node seen so far from a priority queue and relaxes its neighbors, which guarantees that the first time a node is finalized, its recorded cost is optimal. In Rust the frontier is a BinaryHeap, and the only subtlety is that the heap is a max-heap, so you invert the ordering to pop the smallest cost first.",
    code: `let mut heap = BinaryHeap::new();`,
  },
  {
    title: "A* — Dijkstra with a sense of direction",
    body: "A* prioritizes a node by cost-so-far plus a heuristic estimate of the cost remaining to the goal, so it pulls the search toward the target instead of expanding evenly in all directions. An admissible heuristic never overestimates the remaining cost and preserves optimality; a consistent (monotone) one additionally lets the closed-set version finalize each node on first pop with no re-opening. Grid distances such as Manhattan and Euclidean are consistent, which is why A* shines on mazes, grids, and route search.",
    code: `estimate = cost_so_far + heuristic(node, goal)`,
  },
]

const ownershipCards = [
  {
    title: "Edges hold handles, not references",
    body: "If an edge stored a &Node pointing into a growable Vec, the first push that reallocates the backing buffer would invalidate it, and the borrow checker rightly refuses to let you keep such a reference alive across a mutation. Storing a NodeId index sidesteps the whole problem: the index stays valid across reallocation, and node ownership stays centralized in the one table.",
  },
  {
    title: "One Vec plus a typed NodeId is the whole arena",
    body: "You do not need a crate to get arena semantics for a graph. A Vec of nodes plus a NodeId(usize) newtype is already an arena: appending is cheap, every node has a stable logical identity, and traversal borrows the table read-only while the search state lives in separate buffers. The newtype keeps you from accidentally mixing a node index with some other usize.",
  },
  {
    title: "When shared ownership is actually warranted",
    body: "Sometimes several long-lived subsystems genuinely co-own the same nodes, and then Rc or Arc is the honest model rather than a workaround. But a search problem rarely needs that. One owner plus small Copy handles handles building, traversing, queuing, and serializing without any reference counting at all, so reach for shared ownership only when co-ownership is a real requirement.",
  },
]

const parallelCards = [
  {
    title: "Parallelize one level at a time",
    body: "The unit of parallelism in graph search is the frontier: the set of nodes discovered at the current distance. Level-synchronous BFS splits that frontier into chunks, expands the chunks in parallel, then merges the discoveries into the next frontier before starting the next level. This keeps the layer structure (and therefore correctness) intact while still using every core, and it only pays off once a frontier is wide enough to cover the cost of splitting and merging.",
  },
  {
    title: "The visited set is where threads collide",
    body: "The shared state every worker touches is the visited set, and a single global Mutex around it serializes exactly the hot path you were trying to parallelize. The usual fix is to give each worker a local next-frontier buffer, let workers discover freely within a level, and resolve duplicates once when the buffers merge at the level boundary instead of contending on every node.",
  },
  {
    title: "Distributed search is a different problem",
    body: "Once the frontier crosses processes or machines, raw loop speed stops being the bottleneck. The hard questions become how to partition nodes across workers, how to suppress duplicate discoveries that arrive from different partitions, how to bound queue depth so a runaway frontier does not exhaust memory, and how to trace where each discovery came from. The algorithm is the easy part; the control plane is the work.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Your reflex is a node holding raw or smart pointers to its neighbors, with cleanup managed by discipline or shared_ptr cycles you have to break by hand. Rust will reject the borrowed-pointer version outright once the node table can reallocate. The shift: demote edges to a NodeId index and let the Vec be the single owner. You trade pointer chasing for index lookups, and in return the cycle-management and lifetime questions simply vanish.",
  },
  {
    title: "C# background",
    body: "You are used to object identity plus a garbage collector that lets neighbor references float freely, with the graph being a web of objects. Rust has no ambient GC to absorb that web, so the mental shift is from object references to one owning table plus integer handles. Traits and enums model node behavior, but they should not become the storage layer; keep the data flat and the behavior separate.",
  },
  {
    title: "Go background",
    body: "Go lets you build a *Node graph with the GC cleaning up behind you, and interface-heavy pointer graphs feel natural. Rust pushes you toward a slice of nodes plus integer handles, which is more explicit but pays back with better cache locality and no surprise lifetime errors. The instinct you keep is Go's preference for simple flat data; the instinct you drop is leaning on the runtime to track who points at whom.",
  },
  {
    title: "Python background",
    body: "If your model of graphs is NetworkX or a dict of adjacency lists, you are used to nodes being arbitrary hashable objects and edges being implicit in a dictionary. Rust wants something more concrete: a fixed node table and a NodeId you assign at insertion time. You lose the freedom of \"any object is a node,\" but you gain compile-checked traversal, no per-node hashing on the hot path, and orders-of-magnitude faster search over the same graph.",
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
  "Use typed stable indices such as a NodeId newtype for edges instead of storing references into a growable vector.",
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
          Graph search is where the algorithm you already know meets the storage decision Rust forces you to make first.
          This chapter treats BFS, DFS, Dijkstra, and A* as production data-processing components: how the nodes are
          owned, what an edge holds, which traversal fits the cost model, and only then whether the frontier should go
          parallel or distributed.
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              The order matters because each decision constrains the next. Representation determines how cheaply you can
              read neighbors; the identity model determines whether the borrow checker will let your search loop coexist
              with mutation; the cost structure determines which algorithm is even correct; and concurrency is a question
              you should only ask once the single-threaded version is right.
            </p>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Choose the graph representation from sparsity and mutation shape.</li>
              <li>Choose the node identity model from ownership: stable indices or explicit shared owners.</li>
              <li>Choose the search from cost structure: unweighted, weighted, heuristic, or structural.</li>
              <li>Only then decide whether the frontier should stay local, go parallel, or go distributed.</li>
            </ol>
          </div>
          <MermaidDiagram
            chart={`flowchart TD
  Rep[Representation] --> Id[Node identity]
  Id --> Search[Search policy]
  Search --> Conc[Local / parallel / distributed]
  Rep -.->|sparse?| Rep
  Search -.->|weighted?| Search`}
            caption="Each choice constrains the next. Settle storage and identity before picking an algorithm, and concurrency last of all."
          />
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
            <h4 className="font-semibold text-foreground mb-3">Choosing among BFS, DFS, Dijkstra, and A*</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              These four traversals are not a ranking from simple to advanced; they are answers to different questions.
              The decision tree below collapses the choice to two questions you can answer about almost any graph: do the
              edges carry weight, and do you have a usable estimate of the distance to the goal?
            </p>
            <MermaidDiagram
              chart={`flowchart TD
  Start{Edges carry weight?} -->|No| Goal{Shortest path or structure?}
  Goal -->|Fewest hops| BFS[BFS]
  Goal -->|Cycles / ordering| DFS[DFS]
  Start -->|Yes| Heur{Good distance estimate?}
  Heur -->|No| Dijkstra[Dijkstra]
  Heur -->|Yes| AStar[A*]`}
              caption="Two questions decide the search: are edges weighted, and is there a usable heuristic toward the goal?"
            />
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
              An arena-backed graph fits the common lifecycle exactly: the graph is built once as a batch, searched many
              times, and then dropped as a batch. That describes mazes, abstract syntax trees, dependency plans, route
              graphs, and many game worlds. The pattern is just a{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec&lt;Node&gt;</code> that owns every
              node plus a{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">NodeId</code> newtype that names a slot
              in it. The newtype is the load-bearing detail: it gives each node a stable logical identity that survives
              reallocation and serialization, and it stops you from confusing a node index with any other{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">usize</code> floating around the program.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The diagram shows why this stays calm under mutation: edges point at slots, not at addresses, so growing the
              table never invalidates an edge. Compare that to a pointer graph, where one reallocation would dangle every
              stored neighbor pointer.
            </p>
            <MermaidDiagram
              chart={`flowchart TD
  subgraph Owner[Graph: Vec of nodes]
    N0[slot 0: api]
    N1[slot 1: auth]
    N2[slot 2: billing]
  end
  N0 -->|NodeId 1| N1
  N0 -->|NodeId 2| N2
  Search[Search state: visited + queue] -.reads.-> Owner`}
              caption="One Vec owns every node; edges and search state hold NodeId handles into it, never references."
            />
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The safe way to parallelize a search is to keep BFS's layer structure and only parallelize within a layer.
              Split the current frontier into chunks, expand each chunk on its own worker into a private next-frontier
              buffer, and merge the buffers (deduplicating against the visited set once) before the next level begins. The
              merge is a barrier, so the speedup is real only when each level is wide enough that the parallel expansion
              dwarfs the synchronization cost.
            </p>
            <MermaidDiagram
              chart={`flowchart TD
  F[Current frontier] --> S1[Chunk 1]
  F --> S2[Chunk 2]
  F --> S3[Chunk 3]
  S1 --> W1[Worker buffer 1]
  S2 --> W2[Worker buffer 2]
  S3 --> W3[Worker buffer 3]
  W1 --> M[Merge + dedupe vs visited]
  W2 --> M
  W3 --> M
  M --> Next[Next frontier]`}
              caption="Level-synchronous BFS: expand frontier chunks in parallel, merge and dedupe once per level."
            />
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

        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How to think about this coming from another language</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Every language gives you a default mental picture of a graph, and most of those defaults assume a runtime that
            tracks who points at whom. Rust does not. The single biggest adjustment, regardless of where you come from, is
            to stop modeling a graph as a web of objects holding references and start modeling it as one owning table plus
            small handles. Here is the specific shift, and the specific trap, for each background.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
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
          <p className="text-sm text-muted-foreground leading-6">
            Both examples use the same storage idea from the mental model: one owning node table and edges that hold a
            NodeId handle. Run each listing first to confirm the baseline output, then edit the graph or the goal and
            watch how the answer changes. Each listing is introduced by what to look at and a diagram of the flow before
            the code itself.
          </p>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 1: BFS over an adjacency list with stable handles</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The graph is owned in one node table. Edges are{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">NodeId</code> handles, BFS uses a
                  queue, and the shortest unweighted route is counted in hops.
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the loop in{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">shortest_hops</code> marks each node
              with a distance the first time it is reached and never revisits it. Because the queue is FIFO, nodes come
              out in layer order, so the distance recorded for the goal is the minimum number of hops. The diagram traces
              that expansion over the sample graph: api is layer 0, its direct neighbors are layer 1, and search is first
              reached at layer 2.
            </p>
            <MermaidDiagram
              chart={`flowchart TD
  api((api)) -->|layer 1| auth((auth))
  api -->|layer 1| billing((billing))
  auth -->|layer 2| search((search))
  billing -->|layer 2| search`}
              caption="BFS expands in layers; search is first reached at hop 2 from api, which is the shortest path."
            />
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
                  a guess about the remaining distance. Both must agree on the answer.
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: both methods share the same{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">State</code> on a{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">BinaryHeap</code>, and the inverted{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Ord</code> makes that max-heap behave as
              a min-heap on the priority field. The only real difference is the priority: Dijkstra orders by cost so far,
              while A* orders by cost so far plus the Manhattan heuristic to the goal. On the sample graph the tempting
              direct edge B to Goal costs 9, but routing through D is cheaper, so both report the optimal cost of 7. The
              diagram shows the two candidate routes and why the indirect one wins.
            </p>
            <MermaidDiagram
              chart={`flowchart TD
  A((A)) -->|2| B((B))
  A -->|5| C((C))
  B -->|2| D((D))
  C -->|1| D
  D -->|3| Goal((Goal))
  B -->|9| Goal`}
              caption="A to B to D to Goal costs 2+2+3 = 7, beating the direct B to Goal edge of 9. Dijkstra and A* both find 7."
            />
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
                  A{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">BinaryHeap</code> frontier makes the
                  weighted next-best expansion policy explicit and efficient enough for most host-side work.
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
