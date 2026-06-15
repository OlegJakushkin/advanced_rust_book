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
    title: "Choose WebSockets, SSE, polling, gRPC streaming, or a broker-backed edge fan-out",
    objective:
      "Practice selecting the long-lived transport from directionality, latency, browser support, and durability needs instead of defaulting to WebSockets by habit.",
    starterPrompt:
      "Classify four products: a browser dashboard that only receives updates, a collaborative editor where both sides send commands, an internal polyglot stream between services, and a durable event feed where clients may reconnect after long offline gaps.",
    prompts: [
      "Which case wants SSE because the client only listens?",
      "Which case really wants full bidirectional state over one connection?",
      "Which case wants gRPC streaming because service-to-service protobuf contracts matter more than browser support?",
      "Which case probably wants a broker-backed replay surface rather than direct socket fan-out as the primary durability boundary?",
    ],
    acceptanceCriteria: [
      "You choose at least one transport other than WebSockets on purpose.",
      "You justify the choice with pacing or durability rather than with framework familiarity.",
      "You explain one tradeoff involving browser support, replay, or schema tooling.",
    ],
    hints: [
      "Two-way interactivity is only one dimension of the choice.",
      "If long offline replay matters, a broker or durable log may be the real core boundary.",
    ],
  },
  {
    number: 2,
    kind: "design comparison",
    title: "Review explicit read/write ownership in one connection loop",
    objective:
      "Read two async designs and explain why one writer-task boundary is calmer than several unrelated tasks writing directly through one shared sink.",
    starterPrompt:
      "Compare a design with one reader task, one application loop, and one writer task against a design that stores the write half behind `Arc<Mutex<...>>` and lets many tasks write whenever they want.",
    prompts: [
      "Which design keeps frame ordering and close behavior easier to reason about?",
      "Which design makes cancellation and shutdown easier to stage?",
      "Which design makes slow-consumer backpressure easier to measure?",
      "When might a shared sink still be acceptable even if it is not the calm default?",
    ],
    acceptanceCriteria: [
      "You explain one real win of the split read/write ownership model.",
      "You identify at least one real tradeoff or inconvenience of the shared sink design.",
      "You connect the answer to ordering, shutdown, or observability rather than only to syntax preference.",
    ],
    hints: [
      "The main question is not mutex overhead. It is transport ownership and protocol sequencing.",
      "A close frame is easier to reason about when one writer owns the send path.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Implement a small message loop with explicit read/write ownership",
    objective:
      "Build a small async loop where inbound frames cross one channel into app logic and outbound frames cross another channel into the writer side.",
    starterPrompt:
      "Implement one reader task, one application task, and one writer task, then react to text, ping, and close frames without sharing the write half directly.",
    prompts: [
      "Keep inbound and outbound message enums separate.",
      "Use one bounded channel for inbound messages and one for outbound messages.",
      "Close by signaling shutdown after the close frame is observed.",
      "Do not pass borrowed request-local data into later spawned work that can outlive the local scope.",
    ],
    acceptanceCriteria: [
      "The design has explicit read and write ownership boundaries.",
      "Application logic sits between IO and does not write directly to the transport from many places.",
      "The message loop reacts to ping and close distinctly.",
      "The code is plausible Rust and the lifecycle is reviewable from the types and channels alone.",
    ],
    hints: [
      "A reader-app-writer pipeline is the whole point of the exercise.",
      "The best answer is easy to explain on a whiteboard without a specific WebSocket crate.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Replace unbounded broadcast with a bounded slow-consumer policy",
    objective:
      "Refactor one fan-out hub so backlog becomes visible and one slow client cannot quietly grow memory forever.",
    starterPrompt:
      "You inherit a room broadcaster that stores every outbound event in an unbounded per-client queue and only notices trouble after RSS climbs.",
    prompts: [
      "Would you disconnect the slow client, drop old events, coalesce to one latest snapshot, or choose several policies by message class?",
      "Where should the queue bound live: per connection, per room, or both?",
      "Which metrics should spike first when one client or room falls behind?",
      "What regression test would prove the new policy is actually enforced?",
    ],
    acceptanceCriteria: [
      "You define one explicit boundedness rule.",
      "You choose one slow-consumer policy and justify it with product semantics.",
      "You mention at least one metric and one test for the repair.",
      "You avoid leaving the queue effectively unbounded under a different name.",
    ],
    hints: [
      "There is no neutral slow-consumer policy. Every choice changes product semantics.",
      "Per-connection bounds are usually the first honest minimum.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Design a production WebSocket protocol with versioning, auth, and shutdown semantics",
    objective:
      "Make the envelope and lifecycle contract explicit before mixed clients, reconnects, and deploy shutdowns force emergency protocol decisions.",
    starterPrompt:
      "Design a protocol for `subscribe -> receive events -> ack or resume -> close`, with browser clients, per-tenant auth, and deploy-time drain requirements.",
    prompts: [
      "Which envelope fields are mandatory: protocol version, trace ID, session ID, sequence, or all of them?",
      "Which messages belong to the transport layer and which belong to the domain layer?",
      "How will reconnect resume or snapshot catch-up work?",
      "What should the server send during graceful shutdown before closing the socket?",
    ],
    acceptanceCriteria: [
      "You define one versioned envelope or equivalent contract boundary.",
      "You separate auth or transport messages from domain events explicitly.",
      "You describe one reconnect or resume rule and one shutdown rule.",
      "You include at least one authorization or origin-check decision.",
    ],
    hints: [
      "A protocol is easier to evolve when the lifecycle messages are explicit from day one.",
      "If the server will ever drain, the close reason or terminal event belongs in the design now.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Test disconnect storms, reconnects, and long-lived shutdown behavior",
    objective:
      "Design the test matrix and observability surface for the failure paths that make or break long-lived connection systems.",
    starterPrompt:
      "You are testing a multi-tenant live-update service that can reconnect thousands of clients after a load-balancer change and must shut down gracefully during deploys.",
    prompts: [
      "Which parts deserve deterministic unit or integration tests: protocol state, resume rules, bounded queues, graceful close, or all of them?",
      "Which metrics should prove a disconnect storm is under control: reconnect rate, handshake error rate, queue age, or per-tenant active connections?",
      "How would you simulate a slow consumer and a drained shutdown in CI without waiting on real wall-clock sleeps?",
      "Which trace or log fields must exist so one failed reconnect path is attributable later?",
    ],
    acceptanceCriteria: [
      "You include at least one deterministic test for queue or shutdown behavior.",
      "You mention at least three observability hooks for storm or reconnect diagnosis.",
      "You include at least one stable ID field for logs or traces.",
      "You explain how the test plan avoids timing-lottery sleeps where possible.",
    ],
    hints: [
      "Storm handling is partly a test problem and partly a metrics problem.",
      "If the only test is 'the browser reconnected once on my laptop,' the failure matrix is still missing.",
    ],
  },
]

const reviewQuestions = [
  "Why is one writer task usually calmer than many tasks sharing the write half directly?",
  "What makes queue age or pending depth more actionable than active connection count alone?",
  "Why are reconnect and resume protocol decisions separate from ping or pong liveness?",
  "When is SSE a better answer than WebSockets even if the product still wants live updates?",
  "Why should graceful shutdown for long-lived sockets stop admission before closing active connections?",
  "Why does Rust's ownership model force you to name the channel bound and payload type that Go or Python would leave implicit?",
]

const workingLoop = [
  "Choose the transport from the actual traffic pattern first.",
  "Split read, write, and application ownership second.",
  "Bound outbound memory before the first slow consumer appears.",
  "Version the envelope and define reconnect and shutdown rules before mixed releases.",
  "Test failure modes and instrument queue age, evictions, reconnect rate, and close reasons explicitly.",
]

const connectionChecklist = [
  "Upgrade auth, origin checks, and handshake rate limits are explicit.",
  "Reader task, writer task, and application state owner are distinct and reviewable.",
  "Per-connection outbound queue is bounded and policy on overflow is documented.",
  "Ping or pong liveness, sequence or resume state, and close semantics are all separate concepts.",
  "Shutdown path stops new upgrades before draining or closing active sockets.",
]

export function PageCh48WebsocketsLongLivedConnectionsExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch48-websockets-long-lived-connections-exercises")
  const mainPageIndex = getPageIndexById("ch48-websockets-long-lived-connections")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 48 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice long-lived connection design the way it survives production review: transport choice, explicit
          read/write ownership, bounded fan-out, versioned protocols, and shutdown behavior that another engineer can test.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a connection and protocol review. The strongest answer does not stop at “use a
                WebSocket.” It says who owns reads, who owns writes, how slow clients are handled, and which signals prove
                the system is behaving under reconnect and shutdown pressure.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 48
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
          <h3 className="text-lg font-semibold text-foreground mb-3">Long-lived connection checklist</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {connectionChecklist.map((item) => (
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
                  Long-lived connection drill
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
          title="Runnable lab · Refactor unbounded fan-out into a bounded slow-consumer-aware design"
          description={
            <>
              Repair the starter so the hub evicts clients whose pending queue is already at the limit before another event
              is queued. The browser runner uses a simple{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">VecDeque</code>-based model to keep the
              policy visible without external crates.
            </>
          }
          filename="bounded_fanout_lab.rs"
          runKey="ch48_ex_bounded_fanout"
          expectedOutput={"active = 1\nevicted = beta,gamma\ndelivered = 3"}
          helperText={
            <>
              Tip: the repair is the policy itself. Check
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs mx-1">
                pending.len() &gt;= max_pending
              </code>
              before pushing the next payload, remove the slow client, and record the eviction. In a real Tokio service,
              the same logic usually wraps a bounded outbound channel per connection.
            </>
          }
          initialCode={`use std::collections::{HashMap, VecDeque};

#[derive(Debug, Default)]
struct Client {
    pending: VecDeque<String>,
}

#[derive(Debug)]
struct Hub {
    clients: HashMap<&'static str, Client>,
    max_pending: usize,
    delivered: usize,
    evicted: Vec<&'static str>,
}

impl Hub {
    fn new(max_pending: usize) -> Self {
        Self {
            clients: HashMap::new(),
            max_pending,
            delivered: 0,
            evicted: Vec::new(),
        }
    }

    fn add_client(&mut self, id: &'static str, pending: usize) {
        let mut queue = VecDeque::new();
        for _ in 0..pending {
            queue.push_back(String::from("old"));
        }

        self.clients.insert(id, Client { pending: queue });
    }

    fn broadcast(&mut self, payload: &str) {
        // Iterate over a sorted snapshot of ids so eviction order is deterministic
        // regardless of HashMap iteration order (which is randomized per process).
        let mut ids: Vec<_> = self.clients.keys().copied().collect();
        ids.sort_unstable();

        for id in ids {
            if let Some(client) = self.clients.get_mut(id) {
                client.pending.push_back(payload.to_string());
                self.delivered += 1;
            }
        }
    }
}

fn main() {
    let mut hub = Hub::new(2);
    hub.add_client("alpha", 0);
    hub.add_client("beta", 2);
    hub.add_client("gamma", 1);

    hub.broadcast("first");
    hub.broadcast("second");

    println!("active = {}", hub.clients.len());
    println!("evicted = {}", if hub.evicted.is_empty() { "none".to_string() } else { hub.evicted.join(",") });
    println!("delivered = {}", hub.delivered);
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
            By the end of this page, you should be able to choose the right long-lived transport, design an explicit
            reader-app-writer ownership model, replace unbounded fan-out with a bounded policy another engineer can reason
            about, and describe reconnect, auth, and shutdown semantics as part of one versioned protocol contract.
          </p>
        </section>
      </div>
    </div>
  )
}
