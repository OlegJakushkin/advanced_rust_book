"use client"

import { useEffect } from "react"
import { ArrowLeft, Lightbulb, Target, Trophy, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
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
    title: "Choose adjacency list, matrix, or stable-index arena from the workload",
    objective: "Practice mapping graph workload shape to the representation that keeps ownership and traversal calm.",
    starterPrompt:
      "Classify four cases: a sparse service dependency graph, a dense all-to-all connectivity matrix for 64 nodes, a maze grid with uniform step cost, and a long-lived mutable route graph that will be serialized and reloaded.",
    prompts: [
      "Which case wants an adjacency list because edges are sparse and iteration dominates?",
      "Which case justifies a matrix because edge existence lookup is dense and fixed-size?",
      "Which case wants stable indices because the owner should be one node table rather than many references?",
      "Which case is better modeled as a graph over grid coordinates rather than as a pointer graph?",
    ],
    acceptanceCriteria: [
      "You choose at least one adjacency-list case and one adjacency-matrix case with a concrete reason.",
      "You identify stable indices or arena-backed ownership as the calmer default for a mutable serialized graph.",
      "You explain one representation in terms of memory growth and one in terms of traversal shape.",
    ],
    hints: [
      "Ask first whether the graph is sparse or dense.",
      "Then ask who should own nodes and how long edges need to stay meaningful.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Explain why stable indices beat borrowed neighbors in a growable graph",
    objective: "Read a vector-backed graph design and explain the ownership and reallocation consequences precisely.",
    starterPrompt:
      "You inherit one graph that stores nodes in `Vec<Node>` and edges as `usize`, and another that stores nodes in `Vec<Node>` but keeps long-lived `&Node` references inside edge lists.",
    prompts: [
      "Which design survives vector growth and later serialization more honestly?",
      "Why is a long-lived `&Node` inside a growable owner table usually the wrong contract?",
      "What does the stable-index version give up, and what does it gain?",
      "Where would a truly shared-owner graph still justify `Rc` or `Arc` instead?",
    ],
    acceptanceCriteria: [
      "You explain why borrowed neighbors into growable storage are the wrong stability model.",
      "You identify at least one operational win for stable indices, such as mutation calm or serialization ease.",
      "You name one case where shared ownership could still be semantically real.",
    ],
    hints: [
      "The question is not only about memory safety. It is also about which design remains honest after change.",
      "Stable handles are often easier to queue, trace, and store than references.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Implement BFS over an adjacency list with stable indices",
    objective: "Build one small graph owner and traverse it with BFS without pointer-like references between nodes.",
    starterPrompt:
      "Implement `Graph`, `NodeId`, `bfs_order`, and `shortest_hops` over a `Vec<Node>` plus adjacency lists.",
    prompts: [
      "Keep nodes owned in one vector.",
      "Use `VecDeque` for the BFS frontier.",
      "Return stable `NodeId` handles from insertion.",
      "Do not use `Rc`, `RefCell`, or raw pointers.",
    ],
    acceptanceCriteria: [
      "The graph owner is one `Vec<Node>`.",
      "Edges store `NodeId` handles rather than references.",
      "BFS visits nodes in deterministic layer order.",
      "The runnable lab prints the expected visit order and hop count.",
    ],
    hints: [
      "This is the same owner-plus-handle shape used in many ASTs and dependency graphs.",
      "A visited bitmap or distance vector indexed by `NodeId.0` is usually enough.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair a DFS or cycle-check implementation that over-relies on recursion",
    objective: "Replace a fragile recursive structural walk with a more explicit stack or state-set model when graph depth or cycles make the original risky.",
    starterPrompt:
      "A service uses recursive DFS for cycle detection on user-supplied dependency graphs and occasionally sees stack depth concerns and confusing re-entry bugs.",
    prompts: [
      "Would an explicit stack improve control over depth and instrumentation?",
      "Which sets should distinguish 'currently exploring' from 'already finished' if you are detecting cycles?",
      "How would you report one concrete cycle witness rather than only returning `false`?",
      "What metric or log line would help operators diagnose a graph that causes unusual depth?",
    ],
    acceptanceCriteria: [
      "You distinguish traversal depth from cycle-state tracking clearly.",
      "You propose an explicit stack or another bounded-state repair with a reason.",
      "You include one production-facing diagnostic idea such as cycle witness, depth histogram, or node fan-out summary.",
    ],
    hints: [
      "Cycle detection usually needs more than one visited bit.",
      "An explicit stack is often easier to instrument than deep recursion.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Design a dependency resolver challenge",
    objective: "Turn graph search into a production-shaped dependency solver with explicit cycle handling and stable graph identity.",
    starterPrompt:
      "You are designing `resolve build units -> produce execution order -> surface one cycle path if no valid order exists`.",
    prompts: [
      "Which graph direction makes the scheduler calm: dependency to dependent or the reverse?",
      "Which algorithmic pieces belong together: indegree counting, ready frontier, or DFS cycle witness?",
      "What stable IDs or labels should every node carry for logs and test fixtures?",
      "What scoring or extension track would you add for version conflicts or optional edges?",
    ],
    acceptanceCriteria: [
      "You define one stable node identity strategy.",
      "You describe at least one valid ordering path and one cycle-reporting path.",
      "You include one extension or scoring rule for the challenge track.",
    ],
    hints: [
      "A good dependency resolver does more than output a sorted list. It also explains failure.",
      "Stable IDs make cycle reporting and replay testing much easier.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Design a distributed graph-search challenge with bounded frontier workers",
    objective: "Map graph search to a multi-worker control plane where duplicate suppression, queue age, and trace lineage are first-class.",
    starterPrompt:
      "You are designing `seed frontier -> expand neighbors -> dedupe visited nodes -> merge frontier -> publish best path so far`, with work split across several worker pools or processes.",
    prompts: [
      "Where does the owned frontier message boundary live?",
      "How will you stop duplicate discoveries from turning into infinite replay or a retry storm?",
      "Which queues should be bounded, and what metric should alert first when the frontier gets stuck?",
      "How would you score Bronze, Silver, and Gold versions of this challenge?",
    ],
    acceptanceCriteria: [
      "You define at least one owned queue boundary and one duplicate-suppression rule.",
      "You include at least one boundedness rule such as worker concurrency or queue capacity.",
      "You mention at least two observability hooks such as oldest frontier age, duplicate hit rate, or merge lag.",
      "You include one scoring or extension-track rule for the challenge.",
    ],
    hints: [
      "Distributed graph search is partly an algorithm problem and partly a control-plane problem.",
      "Frontier size and duplicate rate are often more useful than raw CPU usage at first.",
    ],
  },
]

const challengeTracks = [
  {
    title: "Bronze · Maze solver",
    score: "10 pts",
    rules: [
      "Find the shortest unweighted path.",
      "Render the chosen path and explored node count.",
      "Extension: compare BFS with A* on the same grid.",
    ],
  },
  {
    title: "Silver · Dependency resolver",
    score: "15 pts",
    rules: [
      "Produce one valid build order.",
      "Emit one cycle witness when no valid order exists.",
      "Extension: add optional edges or version constraints.",
    ],
  },
  {
    title: "Gold · Distributed graph search",
    score: "20 pts",
    rules: [
      "Bound the frontier queue and worker count.",
      "Track duplicate suppression and queue age.",
      "Extension: add retry budget and trace lineage for replay.",
    ],
  },
]

const reviewQuestions = [
  "Why are stable indices usually calmer than borrowed references in graph owners that grow or serialize?",
  "When is BFS the correct answer even if Dijkstra or A* looks more advanced?",
  "What makes a heuristic useful enough for A* but still safe enough for the guarantee you want?",
  "Why can frontier parallelism still fail if the visited-set or merge step is one hot lock?",
  "What extra operational questions appear the moment graph search crosses process or queue boundaries?",
]

const workingLoop = [
  "State the representation first: sparse list, dense matrix, or arena-backed node table.",
  "State the ownership model second: one owner plus handles, or explicit shared owners only if semantically real.",
  "State the search third: BFS, DFS, Dijkstra, or A* from the cost structure.",
  "If the frontier goes parallel or distributed, define duplicate suppression and queue budgets before chasing throughput.",
]

export function PageCh39GraphSearchGamesExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch39-graph-search-games-exercises")
  const mainPageIndex = getPageIndexById("ch39-graph-search-games")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 39 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice graph search the way it appears in production: explicit node ownership, stable handles, deliberate
          algorithm choice, and challenge tracks that expose queueing and replay policy as soon as search goes distributed.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a graph-design review. The strongest answer does not stop at “use BFS” or “use
                Dijkstra.” It says how nodes are owned, what edges store, what the frontier budget is, and which failure
                or queue signal the design would expose in production.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 39
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
          <h3 className="text-lg font-semibold text-foreground mb-3">Challenge tracks and scoring</h3>
          <div className="grid gap-4 lg:grid-cols-3">
            {challengeTracks.map((track) => (
              <div key={track.title} className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="font-medium text-foreground">{track.title}</div>
                  <span className="text-xs uppercase tracking-[0.2em] text-primary">{track.score}</span>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {track.rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
                  Graph drill
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
          title="Runnable lab · BFS over an adjacency list with stable indices"
          description={
            <>
              Repair the starter so the graph keeps one owning node table, BFS uses a queue, and the shortest hop count is
              computed without storing borrowed neighbors. The checker expects the exact visit order and hop count below.
            </>
          }
          filename="graph_bfs_lab.rs"
          runKey="ch39_ex_bfs_adj_list"
          expectedOutput={"visited = api,auth,billing,search\nhops = 2"}
          helperText={
            <>
              Tip: keep the owner as <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Vec&lt;Node&gt;</code>,
              use <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">NodeId</code> in the edge lists, and let{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">VecDeque</code> drive both BFS layers and
              unweighted shortest hops.
            </>
          }
          initialCode={`use std::collections::VecDeque;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
struct NodeId(usize);

#[derive(Debug)]
struct Node {
    name: &'static str,
    edges: Vec<NodeId>,
}

#[derive(Default, Debug)]
struct Graph {
    nodes: Vec<Node>,
}

impl Graph {
    fn add_node(&mut self, name: &'static str) -> NodeId {
        let id = NodeId(self.nodes.len());
        self.nodes.push(Node {
            name,
            edges: Vec::new(),
        });
        id
    }

    fn add_edge(&mut self, from: NodeId, to: NodeId) {
        self.nodes[from.0].edges.push(to);
    }

    fn names(&self, ids: &[NodeId]) -> Vec<&'static str> {
        ids.iter().map(|id| self.nodes[id.0].name).collect()
    }

    fn bfs_order(&self, _start: NodeId) -> Vec<NodeId> {
        Vec::new()
    }

    fn shortest_hops(&self, _start: NodeId, _goal: NodeId) -> Option<usize> {
        None
    }
}

fn main() {
    let mut graph = Graph::default();

    let api = graph.add_node("api");
    let auth = graph.add_node("auth");
    let billing = graph.add_node("billing");
    let search = graph.add_node("search");

    graph.add_edge(api, auth);
    graph.add_edge(api, billing);
    graph.add_edge(auth, search);
    graph.add_edge(billing, search);

    let order = graph.bfs_order(api);
    let hops = graph.shortest_hops(api, search).unwrap_or(0);

    println!("visited = {}", graph.names(&order).join(","));
    println!("hops = {}", hops);
}`}
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
            By the end of this page, you should be able to build a stable-index graph owner, implement BFS without
            pointer-like neighbors, choose graph representations from sparsity and lifecycle, and design maze, dependency,
            and distributed graph-search challenges with explicit scoring and operational budgets.
          </p>
        </section>
      </div>
    </div>
  )
}
