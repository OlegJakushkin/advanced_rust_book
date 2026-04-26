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
    title: "Model one tiny P2P protocol as events and state transitions",
    objective:
      "Practice designing a peer protocol as owned events and explicit state transitions before any real sockets or crates appear.",
    starterPrompt:
      "Design a minimal sync protocol where a node discovers a peer, opens a connection, sends one state request, receives one state summary, and later observes one gossip update.",
    prompts: [
      "Which events belong to the network edge and which commands belong to local application logic?",
      "Which peer or request IDs must be carried through the state machine?",
      "Which state transitions add pending work and which clear it?",
      "What should the node record so another engineer can replay the same sequence in a deterministic test?",
    ],
    acceptanceCriteria: [
      "You separate local commands from inbound network events clearly.",
      "You include at least one pending-request or connected-peer state transition.",
      "You identify at least one stable correlation field such as peer ID or request ID.",
      "You explain the design in terms of owned events rather than shared mutable transport access.",
    ],
    hints: [
      "A protocol loop is usually easier to test when every event is a plain value.",
      "If the state change is important in production, it should have a name in the model.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Identify ownership and async-task boundaries in a swarm loop",
    objective:
      "Read a libp2p-style event loop and explain who owns the swarm, who owns application state, and what moves through channels or tasks.",
    starterPrompt:
      "You inherit a node that stores the swarm behind a broad shared lock while several unrelated tasks mutate protocol state and write directly to transport handles.",
    prompts: [
      "Which part of the system should own the swarm loop directly?",
      "Which data should cross boundaries as owned commands or events instead of as shared references?",
      "Which path becomes easier to reason about once one writer owns outbound transport effects?",
      "What cancellation or shutdown bug becomes more likely when many tasks all think they own the connection state?",
    ],
    acceptanceCriteria: [
      "You identify at least one owner for the swarm and one owner for application state explicitly.",
      "You propose owned messages or commands at one async or channel boundary.",
      "You connect the answer to shutdown, ordering, or duplicate-state risk rather than only to syntax taste.",
    ],
    hints: [
      "The broad shared lock is often compensating for a missing ownership boundary.",
      "One event loop with owned inputs is usually calmer than many tasks with partial transport authority.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Build a small libp2p-style swarm loop over owned enums",
    objective:
      "Implement one small event loop that records connected peers, tracks one pending request map, and clears state on response.",
    starterPrompt:
      "Create `PeerId`, `Event`, and `SwarmState`, then handle a connect, request, and response sequence with no real networking required.",
    prompts: [
      "Keep the owner as one plain Rust struct.",
      "Use one map keyed by request ID for pending work.",
      "Use one small log or event queue for observability.",
      "Do not use `Rc`, `RefCell`, or raw pointers for the main design.",
    ],
    acceptanceCriteria: [
      "The event loop keeps one central owner for protocol state.",
      "Requests create pending entries and responses clear them.",
      "The runnable lab prints the expected connected count, pending count, and final log line.",
      "The code is plausible Rust and easy to test without a live network.",
    ],
    hints: [
      "This is the same ownership story many real libp2p nodes want internally.",
      "A pending-request map is often the simplest way to make response handling honest.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair peer discovery with abuse controls and observability",
    objective:
      "Turn an unbounded peer-discovery feature into one that has explicit limits, dedupe, and telemetry before it melts under hostile or noisy inputs.",
    starterPrompt:
      "A discovery subsystem accepts every advertised peer, queues unlimited dials, and emits no metric for dial failure, relay fallback, or duplicate discovery.",
    prompts: [
      "Where should dedupe live: known peer set, pending dial set, or both?",
      "Which queue or dial-attempt budgets should be explicit?",
      "Which peer records should be rejected before expensive work happens?",
      "What metrics or logs should exist before the feature rolls to production?",
    ],
    acceptanceCriteria: [
      "You add or propose at least one dedupe boundary and one explicit budget.",
      "You identify one cheap validation step that should run before expensive dial or allocation work.",
      "You mention at least two observability hooks such as dial failure count, relay usage, or oldest pending dial age.",
      "You explain one test or simulation case for the repair.",
    ],
    hints: [
      "Discovery is both a correctness problem and a resource-exhaustion problem.",
      "If you do not measure relay fallback, you may not know the network is degraded until users tell you.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Design NAT traversal, relay fallback, and connectivity telemetry",
    objective:
      "Choose a realistic connectivity policy for peers that do not all live on public routable networks.",
    starterPrompt:
      "You are deploying a peer mesh across laptops, cloud VMs, and branch-office devices. Some peers can accept inbound dials, some cannot, and relay capacity is limited.",
    prompts: [
      "Which peers should try direct dial first, and when should they fall back to a relay?",
      "Which metrics should prove whether relay usage is becoming the default path accidentally?",
      "How would you decide the lease or retry policy for repeated failed direct dials?",
      "What operator dashboard fields would you require before rollout?",
    ],
    acceptanceCriteria: [
      "You define one direct-dial path and one relay fallback path explicitly.",
      "You mention at least one retry or budget rule for failed connectivity attempts.",
      "You include at least three observability hooks such as hole-punch success, relay usage, dial failure rate, or oldest queued outbound connection.",
      "You keep the explanation grounded in product and network shape rather than generic P2P enthusiasm.",
    ],
    hints: [
      "A relay is a useful escape hatch and a dangerous silent default.",
      "Connectivity budgets matter before application throughput budgets do.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose P2P vs brokered messaging, gRPC, or HTTP for one product",
    objective:
      "Defend whether a given product boundary really benefits from P2P instead of from a more centralized transport.",
    starterPrompt:
      "Your team is building a collaborative edge cache, a public billing API, and an internal durable task pipeline. Choose the primary communication model for each and justify the choice.",
    prompts: [
      "Which path truly benefits from direct peer identity and partial decentralization?",
      "Which path wants durable replay and queue semantics instead of mesh connectivity?",
      "Which path wants typed service RPC or plain HTTP rather than overlay routing?",
      "Would any of the systems benefit from a hybrid model, and where would the boundary split?",
    ],
    acceptanceCriteria: [
      "You choose at least one case for P2P and at least one case against it with a clear reason.",
      "You include at least one hybrid design where control plane and data plane use different transports.",
      "You explain the choice in terms of durability, topology, or operational cost rather than only in terms of implementation style.",
    ],
    hints: [
      "P2P is not the advanced answer to every network problem.",
      "Hybrid is often the calm senior answer when topology and durability pull in different directions.",
    ],
  },
]

const reviewQuestions = [
  "Why do owned events and commands make a swarm loop easier to test than shared transport state does?",
  "What is the practical difference between peer identity, channel security, and application-level authorization?",
  "Why are NAT traversal and relay fallback product concerns instead of networking trivia?",
  "When is a deterministic scalar version plus tie-break rule enough for sync, and when is it too weak?",
  "What signs tell you a product really wants P2P instead of a broker or service API?",
]

const workingLoop = [
  "Write the protocol states and owned events first.",
  "Choose who owns the swarm and who owns the application state second.",
  "Add queue, dial, and message budgets before real peer counts arrive.",
  "Instrument relay use, dial failure, queue age, and duplicate suppression before rollout.",
  "Only then compare P2P honestly against brokers, gRPC, or HTTP for the same product boundary.",
]

const discoveryChecklist = [
  "Known-peer dedupe and pending-dial dedupe are explicit.",
  "Per-peer and per-topic queues are bounded.",
  "Dial failure, relay usage, and oldest outbound age are measurable.",
  "Large or malformed discovery records are rejected before expensive work.",
  "Replay and sync tests exist without needing a live WAN to prove the policy.",
]

export function PageCh50Libp2pPeerToPeerRustSystemsExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch50-libp2p-peer-to-peer-rust-systems-exercises")
  const mainPageIndex = getPageIndexById("ch50-libp2p-peer-to-peer-rust-systems")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 50 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice libp2p-style design the way it survives review: owned swarm events, bounded discovery, explicit relay
          fallback, and transport choices justified from real product boundaries.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a protocol and systems review. The strongest answer does not stop at “use P2P.” It
                says which messages are owned, which queues are bounded, how replay or discovery is observed, and why a
                more centralized transport might still be the better choice.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 50
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
          <h3 className="text-lg font-semibold text-foreground mb-3">Peer discovery checklist</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {discoveryChecklist.map((item) => (
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
                  P2P drill
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
          title="Runnable lab · Swarm loop with owned events"
          description={
            <>
              Repair the starter so the response event clears the pending request and records one final response log line.
              The checker expects a connected peer, no pending requests, and the exact response line below.
            </>
          }
          filename="swarm_loop_lab.rs"
          runKey="ch50_ex_swarm_loop"
          expectedOutput={"connected = 1\npending = 0\nlast = response peer-b state-v3"}
          helperText={
            <>
              Tip: the response branch should do two things only: remove the matching request ID from the pending map and
              append one log entry that includes the responding peer and body. Keep the whole state owner in one struct.
            </>
          }
          initialCode={`use std::collections::{HashMap, VecDeque};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct PeerId(&'static str);

#[derive(Debug, Clone)]
enum Event {
    Connected(PeerId),
    Request {
        peer: PeerId,
        id: u64,
    },
    Response {
        peer: PeerId,
        id: u64,
        body: String,
    },
}

#[derive(Debug, Default)]
struct SwarmState {
    connected: Vec<PeerId>,
    pending: HashMap<u64, PeerId>,
    log: VecDeque<String>,
}

impl SwarmState {
    fn on_event(&mut self, event: Event) {
        match event {
            Event::Connected(peer) => {
                self.connected.push(peer);
            }
            Event::Request { peer, id } => {
                self.pending.insert(id, peer);
                self.log.push_back(format!("request {}", id));
            }
            Event::Response { peer, id, body } => {
                // repair this branch
            }
        }
    }
}

fn main() {
    let mut state = SwarmState::default();
    let peer = PeerId("peer-b");

    state.on_event(Event::Connected(peer));
    state.on_event(Event::Request { peer, id: 7 });
    state.on_event(Event::Response {
        peer,
        id: 7,
        body: String::from("state-v3"),
    });

    println!("connected = {}", state.connected.len());
    println!("pending = {}", state.pending.len());
    println!("last = {}", state.log.back().map(String::as_str).unwrap_or("none"));
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
            By the end of this page, you should be able to model a small P2P protocol as events and state transitions,
            identify ownership boundaries in a libp2p-style swarm loop, design abuse controls and observability for peer
            discovery, and explain when P2P is or is not the right transport choice for a production system.
          </p>
        </section>
      </div>
    </div>
  )
}
