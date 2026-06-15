"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Bug,
  Cpu,
  Gauge,
  GitCompare,
  Network,
  Shield,
  TriangleAlert,
  Wrench,
} from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "A P2P system is several protocols plus one event loop, not one magical socket.",
    body: "You need a peer identity model, one or more transports, one channel-security story, stream multiplexing, discovery, request-response or pub-sub protocols, and state-sync rules. Rust helps when each of those becomes explicit state instead of incidental callback glue.",
  },
  {
    title: "libp2p is an architecture for composing behaviours, not only one crate import.",
    body: "The common Rust libp2p shape is a swarm that owns connections and drives one or more behaviours. Behaviours are protocol state machines. The application's job is to translate business commands into network actions and network events back into owned state updates.",
  },
  {
    title: "Connectivity, abuse control, and state convergence are the real production costs.",
    body: "The easy demo is two peers on one laptop. The real work is NAT traversal, relay fallback, queue bounds per peer, peer scoring, versioned state sync, and incident analysis when ten percent of the graph can no longer dial directly.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Your instinct will be to model the network as a graph of connection objects holding pointers to each other and to shared session state. Resist that first move. In Rust the swarm owns transport and connection state, each behaviour owns one protocol's state machine, and the application reacts to owned events that arrive one at a time. The mental shift is from a mutable object web you keep coherent by hand to a single owner you feed owned messages through. The trap is reaching for Arc<Mutex<...>> around shared peer state the moment two parts of the code want to touch it; that usually means the loop boundary was drawn in the wrong place.",
  },
  {
    title: "C# background",
    body: "SignalR hubs and dependency-injected service objects train you to think of the connection as a managed thing the framework keeps alive while your handlers fire on it. libp2p inverts that: there is no ambient hub, only an event loop you poll and a set of typed protocol enums you match on. Traits give you the seams that interfaces gave you, but they do not supply a runtime that owns lifetime for you. The design question is no longer 'which service handles this event' but 'who owns connection state, protocol state, and domain state, and at which boundary does an owned value cross from one to the next'.",
  },
  {
    title: "Go background",
    body: "A Go peer node is often goroutines plus channels, and that instinct is half right: channels are still the clean way to move commands and events inside one node. But a P2P network is more than concurrent message passing. Peer identity, channel encryption, NAT and relay policy, and state convergence are part of the network contract, not implementation details you bolt on. Rust also removes the ambient trust Go gives you around shared state: the compiler will not let two goroutine-style tasks mutate the same peer map unless you have stated, in types, how that sharing is allowed.",
  },
  {
    title: "Python background",
    body: "asyncio and Twisted give you a friendly event loop and protocol classes, and libp2p's shape will feel familiar at that level. The difference is that nothing is implicit or dynamically typed at the boundary: every message is a concrete enum with a known size budget, every peer is a typed identity, and there is no GC to paper over who keeps a buffer alive. Where Python lets you stash mutable state on self and trust the loop to be single-threaded, Rust makes you decide whether state is owned by the loop, borrowed for one event, or moved into a task — and it checks that decision before the program runs.",
  },
]

const networkingCards = [
  {
    title: "Identity",
    body: "Each peer needs a stable cryptographic identity. In libp2p-style systems, the peer ID is normally derived from the node key. That lets connection-level policy, signed records, and peer reputation attach to a real principal instead of a transient socket address.",
  },
  {
    title: "Transport",
    body: "Transport is the path bytes actually travel: TCP, QUIC, relayed paths, or other supported options. Treat transport choice as a deployment fact, not as a protocol fact. The same request-response protocol may run over several transport choices.",
  },
  {
    title: "Secure channel",
    body: "Peer identity does not imply transport secrecy or integrity by itself. The channel still needs authenticated encryption, commonly through well-known libp2p security upgrades such as Noise or TLS variants in the ecosystem.",
  },
  {
    title: "Multiplexing",
    body: "A peer connection often carries several logical streams at once. Stream multiplexing is why a node can keep one secure connection to a peer and still run discovery, request-response, and pub-sub traffic as separate logical conversations.",
  },
  {
    title: "Discovery",
    body: "Discovery answers who exists and how to reach them. That may come from a DHT, static bootstrap peers, mDNS on local networks, relays, or an application-specific rendezvous layer.",
  },
  {
    title: "Protocols",
    body: "The application-level job is still to define protocol contracts clearly: request types, response types, pub-sub topics, versioning, size limits, validation rules, and shutdown behavior.",
  },
]

const architectureCards = [
  {
    title: "Swarm",
    body: "The swarm owns connection management, transport upgrades, polling, and behaviour dispatch. It is the outer network event loop, not the domain model.",
  },
  {
    title: "Behaviours",
    body: "A behaviour is a protocol state machine. One behaviour might handle request-response, another discovery, another identity exchange, and another pub-sub. Compose them deliberately instead of hiding everything in one callback.",
  },
  {
    title: "Events",
    body: "Swarm and behaviour events should become owned Rust values crossing into the application layer. That keeps async boundaries, retries, and testing honest.",
  },
  {
    title: "Protocol composition",
    body: "The right composition is usually one small set of protocols that serve the same product goal: identify, discovery, request-response, pub-sub, and maybe a relay or reachability helper. More protocols increase operational surface area immediately.",
  },
]

const protocolCards = [
  {
    title: "Request-response",
    body: "Use request-response when one peer needs one bounded answer from another: fetch state summary, request chunk, ask for peer-specific capability, or pull one slice of work. The core contract is correlation, timeout, and bounded payload size.",
  },
  {
    title: "Publish-subscribe",
    body: "Use pub-sub when one peer emits updates many peers may care about and eventual propagation matters more than per-peer point queries. The core contract is topic naming, topic authorization, fan-out policy, validation cost, and duplicate tolerance.",
  },
  {
    title: "Separate protocol messages from business state",
    body: "Transport-facing enums and DTOs should stay distinct from domain entities. The same system may validate an inbound request, map it into a domain command, and then produce a separate gossip message as an outbound consequence.",
  },
]

const connectivityCards = [
  {
    title: "Peer discovery is not one mechanism.",
    body: "Bootstrap peers, static known peers, DHT-based discovery, local-network discovery, and relay-assisted rendezvous all answer different questions. Many production systems use more than one at once.",
  },
  {
    title: "NAT traversal is a real product constraint.",
    body: "A peer behind consumer NAT may not accept inbound connections directly. Hole punching, relay fallback, or server-assisted rendezvous are not optional edge topics if your users live on ordinary networks.",
  },
  {
    title: "Relays improve reachability and add cost.",
    body: "A relay can rescue connectivity, but it also adds latency, bandwidth cost, and abuse surface. Measure relay usage explicitly; do not let the relay path become the hidden default path for the whole network.",
  },
  {
    title: "Connectivity needs budgets and fallback policy.",
    body: "Track dial success, hole-punch success, relay usage, reconnect rate, and oldest-pending outbound queue age per peer or peer class. Otherwise the network can be 'connected' on paper while one real product lane is starved.",
  },
]

const securityCards = [
  {
    title: "Peer identity is necessary and not sufficient.",
    body: "A known peer ID tells you who claimed the connection. You still need protocol-level authorization, message validation, and resource limits before trusting large payloads or expensive requests.",
  },
  {
    title: "Signed records and channel encryption solve different problems.",
    body: "Signed peer records help with address or metadata authenticity. Encrypted channels protect the live transport. Neither one should be mistaken for application-level correctness checks.",
  },
  {
    title: "Abuse controls must exist before the network is popular.",
    body: "Bound per-peer inbound and outbound queues, cap message size, cap dial attempts, cap connection count, validate before allocate, and score or quarantine peers that repeatedly violate cheap checks.",
  },
  {
    title: "Do expensive work only after cheap validation.",
    body: "In P2P systems, attackers choose the shape of your inbound workload. Parse headers, check topic and version, enforce size and rate limits, then allocate or decode the heavy payload.",
  },
]

const syncCards = [
  {
    title: "Authoritative sync",
    body: "The calmest model is often one authoritative owner and many requesters. P2P does not force multi-writer state. It only makes it available if the product truly needs it.",
  },
  {
    title: "Multi-writer sync needs explicit conflict rules.",
    body: "If several peers can update the same logical state, you need more than optimism. Version vectors, Merkle comparisons, CRDT-like strategies, append-only logs, or application-specific tie-break rules belong in the design, not only in incident notes.",
  },
  {
    title: "Last-writer-wins is easy and often too weak.",
    body: "A timestamp or scalar version plus peer-ID tie-break can be a useful teaching model or fallback, but many real systems need stronger merge semantics once concurrent edits become common.",
  },
  {
    title: "Partition healing should be observable.",
    body: "Track divergence depth, merge count, rejected updates, and how often nodes reconnect through relays before state converges again.",
  },
]

const observabilityCards = [
  {
    title: "Metrics",
    body: "Measure connected peers, failed dials, relay usage, hole-punch success, per-peer or per-topic queue depth, validation rejects, request latency, and sync lag.",
  },
  {
    title: "Tracing",
    body: "Carry stable IDs such as peer ID, request ID, topic, stream ID, and attempt or retry counters through the swarm loop and application layer. One trace should explain dial, protocol exchange, and completion.",
  },
  {
    title: "Deterministic event-loop tests",
    body: "A small swarm-style state machine over owned commands and network events is often the best first test harness. It proves ownership and protocol sequencing without needing a live network.",
  },
  {
    title: "Simulation and fault injection",
    body: "Model dropped dials, relay fallback, duplicate gossip, reorder, stale peers, slow consumers, and partition healing. P2P systems need failure-mode tests earlier than many client-server systems do.",
  },
]

const libp2pSketch = `// libp2p-style architecture sketch; exact crate APIs evolve over time.
struct Node {
    swarm: /* Swarm<CompositeBehaviour> */,
    app_rx: mpsc::Receiver<LocalCommand>,
    state: NodeState,
}

loop {
    tokio::select! {
        Some(cmd) = node.app_rx.recv() => {
            handle_command(cmd, &mut node.state /*, &mut node.swarm */);
        }
        event = /* next swarm event */ => {
            handle_swarm_event(event, &mut node.state);
        }
    }
}`

const protocolSketch = `#[derive(Debug, Clone)]
enum SyncRequest {
    StateSummary { known_version: u64 },
    FetchChunk { root_hex: String, index: u32 },
}

#[derive(Debug, Clone)]
enum SyncResponse {
    StateSummary { version: u64, head: u64 },
    Chunk { root_hex: String, index: u32, bytes: Vec<u8> },
    Reject { reason: &'static str },
}`

const decisionRows = [
  {
    model: "P2P / libp2p",
    bestFor: "Edge meshes, collaborative sync, decentralized discovery, content or state exchange without one permanent coordinator.",
    strengths: "Direct peer identity, topology flexibility, offline or partial-connectivity resilience, protocol composition.",
    costs: "Discovery, NAT traversal, relay cost, abuse surface, trickier observability, convergence and replay rules.",
    poorFit: "Simple public CRUD APIs, strict centralized authorization, or workflows already happiest behind one service boundary.",
  },
  {
    model: "Brokered messaging",
    bestFor: "Durable async work, replay, fan-out with central pacing, queue-based worker fleets.",
    strengths: "Clear backpressure, durable replay, mature operational tooling, easier slow-consumer containment.",
    costs: "Central infrastructure dependency, less direct peer interaction, eventual consistency still needs app design.",
    poorFit: "Low-latency direct peer-to-peer collaboration or mesh membership discovery.",
  },
  {
    model: "gRPC",
    bestFor: "Typed service-to-service RPC, deadlines, unary or streaming contracts in polyglot backends.",
    strengths: "Strong schema, explicit retry and deadline model, easier auth and observability than open-ended meshes.",
    costs: "Central service endpoints, weaker offline tolerance, not a durable replay boundary by itself.",
    poorFit: "Large decentralized overlays or peer-originated topology changes.",
  },
  {
    model: "HTTP APIs",
    bestFor: "Public APIs, simple control planes, broad compatibility, caching and proxy-friendly request-response.",
    strengths: "Operational simplicity, browser compatibility, straightforward auth and gateway integration.",
    costs: "Mostly centralized, weaker real-time push by default, request-response shape can be too coarse for peer sync.",
    poorFit: "Many-to-many live dissemination or decentralized membership and discovery.",
  },
]

const productionPatterns = [
  "Keep the swarm loop small and move owned commands and network events across explicit boundaries instead of sharing connection state broadly.",
  "Compose only the protocols you actually need: identity, discovery, request-response, pub-sub, relay, and sync are each operational commitments.",
  "Bound per-peer and per-topic queues, cap message size, and validate metadata before allocating or decoding expensive payloads.",
  "Treat discovery, hole punching, relay fallback, and state-sync divergence as first-class metrics and traces, not as debug-only concerns.",
  "Use deterministic event-loop tests and simulated fault sequences before relying on live multi-peer demos as proof of correctness.",
  "Choose P2P only when its topology or availability advantages are real. Many systems still want a broker or service API at the core and P2P only at the edge.",
]

const pitfalls = [
  "Assuming peer identity is enough security. A valid peer ID does not make a large request, gossip payload, or sync update safe to process blindly.",
  "Leaving outbound or inbound per-peer queues effectively unbounded because the first lab used only two peers on localhost.",
  "Treating relays as invisible helpers instead of as a latency, cost, and abuse boundary that deserves its own metrics and quotas.",
  "Building multi-writer sync without explicit conflict rules, then discovering later that 'latest' means something different on different peers.",
  "Testing only the happy path with direct dials and no partitions, no duplicate gossip, and no slow-consumer cases.",
  "Choosing P2P for a product that really wanted durable queues, centralized auth, or standard service APIs, then paying mesh complexity for no real gain.",
]

const summaryPoints = [
  "P2P systems are built from explicit pieces: identity, transport, secure channels, multiplexing, discovery, protocols, and sync policy.",
  "The common Rust libp2p shape is a swarm plus composable behaviours, with owned events crossing into application state.",
  "Request-response and pub-sub solve different product problems and should be designed with size limits, pacing, and validation rules up front.",
  "NAT traversal, relay fallback, signed records, encrypted channels, and abuse controls are production features, not advanced electives.",
  "State convergence needs explicit conflict handling and observability, especially once several peers can write or once partitions are real.",
  "P2P is one architectural choice among brokers, gRPC, and HTTP APIs; choose it only when its topology and resilience advantages justify the extra operational surface.",
]

export function PageCh50Libp2pPeerToPeerRustSystems() {
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

  const pageIndex = getPageIndexById("ch50-libp2p-peer-to-peer-rust-systems")
  const chapter25PageIndex = getPageIndexById("ch25-tokio")
  const chapter30PageIndex = getPageIndexById("ch30-amqp-and-message-brokers")
  const chapter31PageIndex = getPageIndexById("ch31-distributed-task-execution")
  const chapter38PageIndex = getPageIndexById("ch38-merkle-tree-games-and-challenges")
  const chapter42PageIndex = getPageIndexById("ch42-testing-advanced-rust-systems")
  const chapter43PageIndex = getPageIndexById("ch43-observability")
  const chapter47PageIndex = getPageIndexById("ch47-grpc-services-with-protobuf-and-service-api-codegen")
  const chapter48PageIndex = getPageIndexById("ch48-websockets-long-lived-connections")
  const chapter49PageIndex = getPageIndexById("ch49-https-tls-secure-service-boundaries")
  const exercisesPageIndex = getPageIndexById("ch50-libp2p-peer-to-peer-rust-systems-exercises")
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
          Chapter 50 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Peer-to-peer systems need one controlled swarm loop, explicit protocols, connectivity policy, identity
          management, and convergence rules. This chapter covers libp2p from those production requirements.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Builds on Chapters 25, 30, 31, 38, 43, 47, 48, and 49
              </h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 25 covered Tokio task boundaries. Chapter 30 covered brokered delivery and replay. Chapter 31
                covered distributed task execution. Chapter 38 covered Merkle-based verification. Chapter 43 covered
                observability. Chapter 47 covered gRPC transport contracts. Chapter 48 covered long-lived connections.
                Chapter 49 covered secure boundaries and TLS. Peer-to-peer systems sit across all of them.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter25PageIndex)}>
                Chapter 25
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter30PageIndex)}>
                Chapter 30
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter31PageIndex)}>
                Chapter 31
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter38PageIndex)}>
                Chapter 38
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter43PageIndex)}>
                Chapter 43
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter47PageIndex)}>
                Chapter 47
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter48PageIndex)}>
                Chapter 48
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter49PageIndex)}>
                Chapter 49
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Network className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Opening scenario</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            A field-deployed coordination system must keep exchanging state when nodes lose their link to a central
            server or sit behind restrictive home and carrier networks. There is no broker to lean on and no single
            endpoint everyone dials. Each node has to find peers on its own, prove who it is, open an encrypted channel,
            and then run several conversations at once: discovery, request-response fetches, and pub-sub gossip. The
            business requirement is to compose identity, transport, secure channels, discovery, relay policy,
            request-response, pub-sub, and state convergence inside one bounded peer event loop that an on-call engineer
            can reason about at three in the morning.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            That last phrase is the design constraint that matters. The temptation is to spread network state across
            many objects and let callbacks mutate it from everywhere. The calmer shape is a single loop: it waits on two
            sources — commands coming down from your application, and events coming up from the network — and it owns the
            state both sides touch. Everything below is built around that one picture. Read the diagram first, then the
            code sketch, which is the same loop written in Rust-shaped pseudocode.
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  App[Application logic] -->|owned commands| Loop{Peer event loop}\n  Net[(Network / swarm)] -->|owned events| Loop\n  Loop -->|owns| State[(Node state: peers, pending, log)]\n  Loop -->|dial / send| Net\n  Loop -->|results| App`}
            caption="One loop waits on commands from above and events from below, and it alone owns the node state both sides read and write."
          />
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="font-medium text-foreground mb-2">The same loop as a Rust sketch</div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              The <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">select!</code> below is the loop in
              the diagram. The two arms are the two arrows into the loop: one drains application commands, the other
              drains network events. Both hand their value to a function that takes{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&amp;mut node.state</code>, so there is
              exactly one owner of the state and no shared-mutable web to keep coherent.
            </p>
            <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{libp2pSketch}</code>
            </pre>
            <p className="mt-3 text-sm text-muted-foreground leading-6">
              The exact libp2p Rust APIs evolve over time, and crate method names will not match this sketch line for
              line. The architecture is far more stable than the names: one swarm owns the network edge, behaviours own
              protocol state, and your application translates owned commands and owned events through that loop.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Mental model</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            Before any code, three corrections clear up most early confusion. The word &ldquo;peer-to-peer&rdquo; suggests
            a single clever socket that magically connects everyone; it is really a stack of separate protocols you
            assemble on purpose. The word &ldquo;libp2p&rdquo; suggests one crate you import and call; it is really a way
            to compose small protocol state machines. And the demo &mdash; two laptops on one Wi-Fi network &mdash; hides
            the work that actually fills your sprint board, which is connectivity, abuse control, and getting divergent
            state back into agreement.
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
            {mentalModelPoints.map((point) => (
              <div key={point.title} className="rounded-lg border border-border bg-card p-4">
                <h4 className="font-semibold text-foreground mb-2">{point.title}</h4>
                <p className="text-sm text-muted-foreground leading-6">{point.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How this lands by background</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            P2P work pulls hard on instincts you already have, and some of those instincts help while others quietly
            mislead. The useful question is not which crate maps to which library; it is where each language taught you
            to put trust, and how that placement has to move in Rust. Read the card for your background before the rest
            of the chapter, then notice when the text is correcting exactly the habit it names.
          </p>
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {comparisonCallouts.map((comparison) => (
              <div key={comparison.title} className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">{comparison.title}</div>
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

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              The layers a peer connection is built from
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A single connection to a peer is not one thing; it is a short stack of concerns, each solving a different
              problem, layered in a fixed order. You establish who the peer is, you pick a path for the bytes, you
              upgrade that path to an encrypted channel, and only then do you split it into many logical streams so that
              discovery, request-response, and gossip can all run over the one connection at once. Discovery sits beside
              the stack because it answers a prior question &mdash; which peers exist and how to reach them &mdash; that
              you must answer before there is a connection to build at all. The cards below expand each layer in that
              order.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {networkingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              How a libp2p node is wired in Rust: swarm, behaviours, and events
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The Rust libp2p design has one organising idea worth getting right early. The swarm is the outer machine
              that owns connections and does the polling; it does not understand your protocols. Each protocol &mdash;
              identify, discovery, request-response, pub-sub &mdash; lives in its own behaviour, which is a small state
              machine. The swarm drives every behaviour and bubbles up what they produce as a stream of events. Your job
              is to turn each event into an owned value and act on it in the application layer, and to push application
              decisions back down as commands. The cards expand each box in that path.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {architectureCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                One useful correction for engineers coming from framework-heavy networking is this: the swarm is not your
                business object, and a behaviour is not your whole node. Keep network orchestration and domain state
                separate so tests can drive protocol state machines without real sockets first.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Two protocol shapes: a question to one peer, or news for many
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Almost every peer interaction is one of two shapes, and they have different contracts. Request-response is
              a question put to one named peer that expects exactly one bounded answer: fetch a state summary, ask for a
              chunk, pull one slice of work. Its contract is correlation (matching the reply to the request), a timeout,
              and a size cap. Publish-subscribe is news emitted to a topic that any number of peers may have subscribed
              to, where eventual propagation matters more than a precise per-peer reply. Its contract is topic naming,
              who may publish, fan-out policy, validation cost, and tolerating duplicates. Picture the difference before
              reading the message types.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  A[Peer A] -->|FetchChunk index=3| B[Peer B]\n  B -->|Chunk index=3 bytes| A`}
              caption="Request-response: Peer A asks one named peer for one bounded answer, and Peer B returns exactly that reply correlated to the request."
            />
            <p className="text-sm text-muted-foreground leading-6">
              Side by side, the other shape sends one message to many peers at once:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  P[Publisher] -->|publish heads| T(((topic: heads)))\n  T --> S1[Subscriber 1]\n  T --> S2[Subscriber 2]\n  T --> S3[Subscriber 3]`}
              caption="Pub-sub: a publisher emits to a topic and every peer subscribed to that topic receives the message, fanning out to all subscribers."
            />
            <div className="grid gap-4 lg:grid-cols-3">
              {protocolCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground leading-6">
              The request-response message types below are deliberately small. Notice that the request carries only what
              the peer on the wire needs to act &mdash; a known version, a root hash, an index &mdash; and that{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Reject</code> is a first-class
              response, not an exception. A transport message should answer only what the remote peer needs; your domain
              model can stay richer internally, and you map between the two explicitly.
            </p>
            <pre className="mt-3 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{protocolSketch}</code>
            </pre>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Reaching a peer: discovery, NAT, and the relay fallback ladder
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              On a laptop demo, dialing a peer is one step that always succeeds. On real networks it is a ladder of
              attempts, because most users sit behind NAT that refuses unsolicited inbound connections. A node first
              tries to dial the peer directly. If that fails, it can attempt hole punching, where both peers coordinate
              through a third party to open matching ports at the same instant. If hole punching also fails, traffic
              falls back to a relay that forwards bytes for both sides &mdash; which works, but adds latency, costs
              bandwidth, and becomes an abuse target. The diagram is the decision you are really implementing; treat each
              transition as something you measure, not something that just happens.
            </p>
            <MermaidDiagram
              chart={`stateDiagram-v2\n  [*] --> Direct: dial peer\n  Direct --> Connected: succeeds\n  Direct --> HolePunch: blocked by NAT\n  HolePunch --> Connected: succeeds\n  HolePunch --> Relay: punch fails\n  Relay --> Connected: forwarded via relay\n  Relay --> Failed: no relay reachable\n  Connected --> [*]\n  Failed --> [*]`}
              caption="Direct dial, then hole punch, then relay. Each rung is a metric: dial success, punch success, and how much traffic falls through to relays."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {connectivityCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Security: knowing the peer is not the same as trusting the request
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              In a P2P system the attacker is on the inside: any peer can connect, and a valid cryptographic identity
              only tells you who is sending bytes, not that the bytes are safe to act on. Identity, signed records, and
              channel encryption each solve one narrow problem and none of them validate a request. The defensive
              posture that holds up is to do work in increasing order of cost, rejecting as early as possible. Check the
              cheap things first &mdash; size, topic, version, rate &mdash; and only allocate buffers or decode heavy
              payloads once those pass. The pipeline below is the shape of an inbound handler that an adversary cannot
              easily turn into free compute or memory pressure.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  In[Inbound message] --> Sz{size within cap?}\n  Sz -->|no| Drop[Reject, score peer]\n  Sz -->|yes| Tp{topic / version known?}\n  Tp -->|no| Drop\n  Tp -->|yes| Rt{rate limit ok?}\n  Rt -->|no| Drop\n  Rt -->|yes| Heavy[Allocate + decode payload]\n  Heavy --> Handle[Process request]`}
              caption="Cheap checks gate expensive work: size, topic, and rate are verified before any buffer is allocated or any payload decoded."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {securityCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                “Authenticated channel” and “safe application request” are separate claims. Keep size checks, rate limits,
                and protocol authorization even when the remote peer is cryptographically identified.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground mb-3">State synchronization and conflict handling</h4>
                <div className="grid gap-4 lg:grid-cols-2">
                  {syncCards.map((card) => (
                    <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                      <div className="font-medium text-foreground mb-2">{card.title}</div>
                      <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                <Button variant="outline" onClick={() => setCurrentPage(chapter31PageIndex)}>
                  Chapter 31
                </Button>
                <Button variant="outline" onClick={() => setCurrentPage(chapter38PageIndex)}>
                  Chapter 38
                </Button>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground mb-3">
                  Observability, testing, and simulation for P2P networks
                </h4>
                <div className="grid gap-4 lg:grid-cols-2">
                  {observabilityCards.map((card) => (
                    <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                      <div className="font-medium text-foreground mb-2">{card.title}</div>
                      <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                <Button variant="outline" onClick={() => setCurrentPage(chapter43PageIndex)}>
                  Chapter 43
                </Button>
                <Button variant="outline" onClick={() => setCurrentPage(chapter42PageIndex)}>
                  Chapter 42
                </Button>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              When to choose P2P vs client-server, message brokers, or distributed task queues
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The right answer is often hybrid. A system can use HTTP or gRPC for control plane, a broker for durable work
              and replay, and libp2p only where peer discovery, direct data exchange, or partial decentralization are real
              product requirements. The point is to choose from workload shape, not from ideology.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-4 font-semibold text-foreground">Model</th>
                    <th className="py-2 pr-4 font-semibold text-foreground">Best fit</th>
                    <th className="py-2 pr-4 font-semibold text-foreground">Strengths</th>
                    <th className="py-2 pr-4 font-semibold text-foreground">Costs</th>
                    <th className="py-2 font-semibold text-foreground">Poor fit</th>
                  </tr>
                </thead>
                <tbody>
                  {decisionRows.map((row) => (
                    <tr key={row.model} className="border-b border-border/60 align-top">
                      <td className="py-3 pr-4 text-foreground font-medium">{row.model}</td>
                      <td className="py-3 pr-4 text-muted-foreground leading-6">{row.bestFor}</td>
                      <td className="py-3 pr-4 text-muted-foreground leading-6">{row.strengths}</td>
                      <td className="py-3 pr-4 text-muted-foreground leading-6">{row.costs}</td>
                      <td className="py-3 text-muted-foreground leading-6">{row.poorFit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
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
                The most expensive P2P bug is often not a bad packet decode. It is an under-specified operational model:
                no NAT fallback, no bounded queues, no replay-safe sync semantics, or no way to explain a failure once the
                network becomes partially partitioned.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Examples</h3>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The interactive examples stay self-contained and compile as ordinary Rust without a live network. That keeps
              the ownership model stable even if libp2p crate APIs evolve. Treat them as libp2p-style protocol loops and
              state machines rather than as copy-paste setup code.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 1: the swarm loop as one owner with two entry points
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  One owner, <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">SwarmState</code>, keeps
                  all protocol state. Commands and inbound network events are owned enums that can cross async or channel
                  boundaries.
                </p>
              </div>
              {codes.libp2p_swarm_state_machine !== DEFAULT_CODES.libp2p_swarm_state_machine && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("libp2p_swarm_state_machine")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-1">
              What to look at: the state machine has exactly two doors,{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">on_command</code> and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">on_event</code>, and both take{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&amp;mut self</code> &mdash; the same
              single-owner shape as the loop at the top of the chapter. Follow one request through:{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">SendRequest</code> records the request
              id in <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">pending_requests</code>, and the
              matching <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Response</code> event is the
              only thing that removes it. That insert-then-remove pair is why the final{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">pending = 0</code>. The sequence below
              is the exact run in <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">main</code>.
            </p>
            <MermaidDiagram
              chart={`sequenceDiagram\n  participant App\n  participant S as SwarmState\n  App->>S: Dial(peer-b)\n  App->>S: ConnectionEstablished -> connected=1\n  App->>S: SendRequest id=7 -> pending=1\n  App->>S: Response id=7 -> pending=0\n  App->>S: Gossip heads tip=9 -> log\n  Note over S: connected=1, pending=0, last=gossip`}
              caption="Commands and events arrive in order; pending requests rise on SendRequest and fall on the matching Response, ending at zero."
            />
            <RustCodeEditor
              code={codes.libp2p_swarm_state_machine}
              onChange={(newCode) => updateCode("libp2p_swarm_state_machine", newCode)}
              onRun={() => runCode("libp2p_swarm_state_machine")}
              output={outputs.libp2p_swarm_state_machine ?? null}
              isRunning={isRunning === "libp2p_swarm_state_machine"}
              filename="swarm_event_loop.rs"
              expectedOutput={"connected = 1\npending = 0\nlast = gossip heads peer-b tip=9"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.libp2p_swarm_state_machine}
              onRevert={() => resetCode("libp2p_swarm_state_machine")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Ownership</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The swarm-state owner holds the maps and queues. Commands and events move in as owned values.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Protocol bookkeeping</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Pending requests live in one map and are removed only when the matching response arrives.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">App translation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The loop records network events in one application log without requiring a live transport to teach the idea.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 2: merging conflicting updates with one deterministic rule
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  This example is intentionally modest: pick the highest version, then break ties deterministically by
                  author. In real systems you may need stronger CRDT, log, or Merkle-based semantics.
                </p>
              </div>
              {codes.libp2p_state_sync_conflicts !== DEFAULT_CODES.libp2p_state_sync_conflicts && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("libp2p_state_sync_conflicts")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-1">
              What to look at:{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">merge_peer_updates</code> folds the
              updates through <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">pick_newer</code>, so
              the whole merge is just that one comparison applied repeatedly. The comparison is the contract every peer
              must share: higher version wins; on an equal version, the larger author string wins. Trace the inputs
              &mdash; current is version 3, then two version-4 updates from{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">peer-b</code> and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">peer-c</code>. Both beat version 3,
              and the tie between them goes to <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">peer-c</code>.
              The flow below is the body of <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">pick_newer</code>.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Start[compare local vs remote] --> V{remote.version > local.version?}\n  V -->|yes| TakeR[keep remote]\n  V -->|no| V2{remote.version < local.version?}\n  V2 -->|yes| TakeL[keep local]\n  V2 -->|no, tie| A{remote.author > local.author?}\n  A -->|yes| TakeR\n  A -->|no| TakeL`}
              caption="Version decides first; only an exact tie falls through to the author comparison, which makes the merge deterministic across peers."
            />
            <RustCodeEditor
              code={codes.libp2p_state_sync_conflicts}
              onChange={(newCode) => updateCode("libp2p_state_sync_conflicts", newCode)}
              onRun={() => runCode("libp2p_state_sync_conflicts")}
              output={outputs.libp2p_state_sync_conflicts ?? null}
              isRunning={isRunning === "libp2p_state_sync_conflicts"}
              filename="state_sync_conflict_resolution.rs"
              expectedOutput={"version = 4\nauthor = peer-c\nvalue = allow-write+audit"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.libp2p_state_sync_conflicts}
              onRevert={() => resetCode("libp2p_state_sync_conflicts")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Determinism</div>
                <p className="text-xs text-muted-foreground leading-5">
                  A tie-break rule is part of the sync contract. Two peers need the same merge rule to converge.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Limits</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Scalar versions and peer-ID ordering are simple and often insufficient once true concurrent edits matter.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Production translation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  This is the right place to ask whether your real workload wants logs, CRDTs, or Merkle diffing instead.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch50_libp2p_peer_to_peer_rust_systems/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to model a small peer protocol as events and state transitions, identify
            ownership boundaries in a swarm loop, design abuse controls for discovery, and choose when P2P is actually a
            better fit than brokers or service APIs.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 50 Exercises
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
