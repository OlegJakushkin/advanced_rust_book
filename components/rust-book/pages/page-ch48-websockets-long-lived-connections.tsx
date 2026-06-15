"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Bug,
  Cpu,
  Gauge,
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
    title: "A WebSocket connection is a long-lived subsystem, not one request handler",
    body: "After the HTTP upgrade succeeds, the connection owns memory, tasks, queues, auth context, and shutdown behavior for minutes or hours. Treat it like a miniature service with a state machine, not like one more JSON endpoint.",
  },
  {
    title: "One reader, one writer, and one application boundary is usually calmer than shared sink access",
    body: "In async Rust, the cleanest shape is often a reader task that owns inbound IO, a writer task that owns outbound IO, and an application task or loop between them using bounded channels.",
  },
  {
    title: "Backpressure is product behavior, not only transport behavior",
    body: "When a browser tab, mobile client, or downstream fan-out consumer falls behind, the server must choose deliberately: drop the client, coalesce updates, send snapshots, or refuse more work. An unbounded queue is already a policy, even if nobody wrote it down.",
  },
]

const lifecycleCards = [
  {
    title: "Upgrade",
    body: "The lifecycle begins as ordinary HTTP. Auth, origin checks, headers, cookies, and rate limits still belong here before the connection becomes long-lived state.",
  },
  {
    title: "Split read and write halves",
    body: "Most Rust WebSocket stacks expose a split or equivalent ownership boundary. One task reads frames. Another owns writes. Avoid many unrelated tasks fighting over the sink with one broad mutex unless you have measured that shape and still want it.",
  },
  {
    title: "Ping and pong",
    body: "Transport heartbeats answer liveness questions. They are not the same thing as application-level keepalives or sequence acknowledgments. Keep the distinction explicit in the protocol.",
  },
  {
    title: "Close frames",
    body: "A close handshake is part of the protocol, not cleanup trivia. Send a reason when appropriate, stop admission into the outbound queue, and let long-lived tasks observe shutdown rather than dropping the process under them abruptly.",
  },
  {
    title: "Reconnects",
    body: "Reconnect is not only a client loop. The server needs a replay, resume, snapshot, or fresh-subscribe policy. Jittered backoff and resume tokens usually matter more than clever socket code.",
  },
]

const ownershipCards = [
  {
    title: "Reader task owns inbound transport",
    body: "The read side decodes frames, updates liveness, and forwards owned protocol messages into the application layer. It should not also own business side effects if you want cancellation and testing to stay clean.",
  },
  {
    title: "Writer task owns outbound transport",
    body: "The write side drains one bounded queue of owned outbound messages. This keeps ping, close, and application events serialized through one owner instead of many callers racing to write.",
  },
  {
    title: "Application task owns protocol state",
    body: "Subscriptions, per-connection permissions, sequence numbers, and resume tokens usually belong in one application loop or per-connection state owner between the reader and writer.",
  },
  {
    title: "Pin and cancellation still matter even if you rarely touch Pin directly",
    body: "Frameworks and runtimes hide most explicit Pin handling, but the operational truth remains: async Rust is still state machines plus cancellation. A spawned connection task that never sees shutdown or backpressure is still a bad state machine.",
  },
]

const backpressureCards = [
  {
    title: "Per-connection outbound queue",
    body: "Give each connection a bounded queue. If the client falls behind, the server should notice it before memory becomes the incident report.",
  },
  {
    title: "Slow consumer policy",
    body: "Choose one policy per message class: disconnect the client, drop newest, drop oldest, coalesce to one latest snapshot, or route heavy fan-out through a broker instead of directly through the socket.",
  },
  {
    title: "Fan-out budget",
    body: "Broadcast to many clients only if each client still has an independent queue budget. One slow browser tab should not pin the whole room or tenant by default.",
  },
  {
    title: "Disconnect storms are their own failure mode",
    body: "A deploy, LB rebalance, or network flap can reconnect thousands of clients at once. Budget handshake rate, auth cache pressure, replay cost, and broker resubscribe traffic explicitly.",
  },
]

const disconnectStormChecklist = [
  "Jitter reconnect advice on the client side so every tab or device does not reconnect at once.",
  "Keep handshake and auth rate limits separate from normal message rate limits.",
  "Expose connection_accept_rate, reconnect_rate, handshake_error_rate, and auth_latency as first-class metrics.",
  "Prefer resume or snapshot-on-reconnect over replaying an unbounded event backlog directly through the socket.",
  "Keep one fast path for immediate reject when the system is already overloaded instead of buffering doomed reconnect work.",
]

const messageEnvelopeSnippet = `#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ClientMessage {
    Subscribe { stream: String },
    Ack { seq: u64 },
    Ping { nonce: u64 },
    Close { reason: Option<String> },
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(bound = "T: Serialize + DeserializeOwned")]
struct Envelope<T> {
    version: u16,
    trace_id: String,
    session_id: String,
    payload: T,
}`

const protocolCards = [
  {
    title: "Version the envelope, not only the deploy note",
    body: "Long-lived protocols evolve badly when versioning is implicit. Put protocol version, message kind, and trace identity in the envelope so mixed clients and servers stay debuggable.",
  },
  {
    title: "Separate transport frames from domain messages",
    body: "Transport events such as ping, pong, close, subscribe, ack, and resume are not the same thing as domain events such as invoice_created or task_completed. Keep those layers separate in code.",
  },
  {
    title: "Sequence numbers and resume are operational features",
    body: "If clients reconnect, you need a rule for replay or catch-up. Sequence numbers, cursor IDs, or snapshot version IDs belong in the protocol contract early if you will ever need replay.",
  },
  {
    title: "Prefer additive evolution",
    body: "New optional fields, new event kinds, or explicit feature flags age better than redefining old message meaning in place. WebSocket protocols drift just as badly as HTTP APIs when contracts are sloppy.",
  },
]

const securityCards = [
  {
    title: "Authenticate before or at upgrade",
    body: "Use the same discipline as HTTP: verify caller identity before the connection starts doing meaningful work. Do not assume the socket being open means every later message is allowed.",
  },
  {
    title: "Authorize per operation, not only per connection",
    body: "A connection may be authenticated and still not allowed to subscribe to every stream or send every command. Keep transport auth and message-level authorization distinct.",
  },
  {
    title: "Validate Origin for browser clients",
    body: "If browsers initiate the WebSocket, origin checks are part of the security surface. A non-browser native client has a different trust story, so be explicit about which handshake assumptions apply to which client family.",
  },
  {
    title: "Rate limit both handshakes and messages",
    body: "Connection floods and command floods are different failure modes. Track them separately and budget them separately.",
  },
]

const shutdownSteps = [
  "Stop accepting new upgrades first.",
  "Mark the connection or hub as draining so new outbound work is rejected or coalesced.",
  "Send close frames or one terminal event where the product contract requires it.",
  "Bound drain time with a timeout and log what remained queued.",
  "Cancel background tasks only after the writer and application loop have had one chance to observe shutdown.",
]

const testingCards = [
  {
    title: "Protocol state machine tests",
    body: "Unit-test subscribe, ack, resume, ping, pong, close, and authorization logic as plain Rust state transitions before a real socket is involved.",
  },
  {
    title: "Integration tests with a real client",
    body: "Use one real WebSocket client harness in integration tests for upgrade, close handshake, and reconnect behavior. Keep it small and deterministic.",
  },
  {
    title: "Failure-mode tests",
    body: "Exercise half-open sockets, slow consumers, disconnect storms, replay after reconnect, and server shutdown during in-flight work. These paths define production quality more than the happy path does.",
  },
  {
    title: "Backpressure assertions",
    body: "Assert queue capacity, eviction policy, and disconnect behavior directly. If slow-consumer handling is a product decision, it deserves explicit tests.",
  },
]

const transportChoiceCards = [
  {
    title: "WebSockets",
    bestFor: "Two-way interactive state",
    body: "Use when both client and server speak over one long-lived session and client commands matter, not only server push.",
  },
  {
    title: "SSE",
    bestFor: "One-way server push to browsers",
    body: "Use when the client only listens and normal HTTP auth or infra simplicity matters more than bidirectional messaging.",
  },
  {
    title: "Polling",
    bestFor: "Coarse freshness and simple infrastructure",
    body: "Use when updates are infrequent, scale is modest, or the operational cost of a long-lived connection is not justified.",
  },
  {
    title: "gRPC streaming",
    bestFor: "Typed service-to-service streams",
    body: "Use when protobuf contracts, deadlines, and polyglot service tooling matter more than browser-native websocket support.",
  },
  {
    title: "Message brokers",
    bestFor: "Decoupled fan-out and durable replay",
    body: "Use when producer and consumer lifecycle should decouple in time, and let the WebSocket layer become only the edge fan-out consumer if needed.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "The raw socket mechanics will feel familiar, but the instinct to share one write end behind a mutex and let any thread touch it is exactly what Rust pushes back on. Model the connection as one owner per direction instead, and the borrow checker turns close-ordering and error-propagation races into compile-time questions rather than 3 a.m. ones.",
  },
  {
    title: "C# background",
    body: "Stop reaching for a single SignalR-style ambient connection object that hides the reader, writer, and dispatcher behind one facade. In Rust the three responsibilities become three explicit owners joined by bounded channels, and cancellation stops being a CancellationToken you remember to thread through and becomes the shape of the code.",
  },
  {
    title: "Go background",
    body: "The goroutine-per-direction reflex is right; the unstated parts are the trap. Go lets you spawn a writer and feed it from an unbounded channel without thinking about it. Rust makes you name the channel bound, the owned payload type, and the shutdown signal up front, so a slow client surfaces as backpressure instead of a quietly growing heap.",
  },
  {
    title: "Python background",
    body: "Coming from asyncio or FastAPI, the temptation is to await ws.send() from many coroutines and trust the event loop to interleave them. Rust will not let two tasks hold the write half at once, so you serialize sends through one writer task on purpose. The payoff is that backpressure and ordering are decisions you can see, not behavior you discover under load.",
  },
]

const productionPatterns = [
  "Keep each connection small: one reader, one writer, one bounded outbound queue, and one application-state owner when the protocol is non-trivial.",
  "Version the protocol envelope and keep transport message types separate from domain events and commands.",
  "Authenticate at upgrade, authorize per operation, and validate browser Origin when the client family requires it.",
  "Budget slow consumers explicitly with bounded queues, coalescing rules, or disconnect policy instead of letting memory choose the policy for you.",
  "Treat reconnect and disconnect storms as normal capacity-planning cases, not as rare accidents.",
  "Instrument active connections, queue depth, oldest pending age, evictions, reconnect rate, ping or pong failures, and close reasons before the first incident.",
]

const pitfalls = [
  "Writing directly to one shared socket sink from many unrelated tasks and discovering later that ordering, close, and error propagation are now a race.",
  "Keeping outbound queues unbounded because the first demo had only a few clients.",
  "Treating ping or pong traffic as the whole liveness story while application replay or ack state is still ambiguous.",
  "Authenticating at upgrade and then forgetting that message-level authorization still exists.",
  "Reconnecting clients without a replay or snapshot policy, which turns every network flap into stale state or load amplification.",
  "Choosing WebSockets by default when SSE, polling, gRPC streaming, or a broker-backed edge fan-out would have been operationally simpler.",
]

const summaryPoints = [
  "A WebSocket connection is a long-lived subsystem with its own ownership, pacing, auth, and shutdown rules.",
  "In async Rust, one reader task, one writer task, and one bounded application queue is often the calmest ownership model.",
  "Backpressure, slow-consumer handling, and reconnect storms are design decisions that need explicit product and operational policy.",
  "Versioned envelopes, sequence numbers, and additive evolution matter for WebSocket protocols just as much as for HTTP or broker contracts.",
  "Testing should cover protocol state, slow consumers, reconnects, close handshake, and shutdown, not only happy-path echo traffic.",
  "WebSockets are powerful, but they are only one long-lived transport option among SSE, polling, gRPC streaming, and durable brokers.",
]

export function PageCh48WebsocketsLongLivedConnections() {
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

  const pageIndex = getPageIndexById("ch48-websockets-long-lived-connections")
  const chapter23PageIndex = getPageIndexById("ch23-synchronization-primitives")
  const chapter24PageIndex = getPageIndexById("ch24-coroutines-futures-and-async-rust")
  const chapter25PageIndex = getPageIndexById("ch25-tokio")
  const chapter30PageIndex = getPageIndexById("ch30-amqp-and-message-brokers")
  const chapter42PageIndex = getPageIndexById("ch42-testing-advanced-rust-systems")
  const chapter43PageIndex = getPageIndexById("ch43-observability")
  const chapter47PageIndex = getPageIndexById("ch47-grpc-services-with-protobuf-and-service-api-codegen")
  const exercisesPageIndex = getPageIndexById("ch48-websockets-long-lived-connections-exercises")
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
          Chapter 48 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          A request handler lives for milliseconds; a WebSocket lives for hours. That single change of timescale is what
          this chapter is really about. Once a connection sticks around, it acquires a lifecycle, its own memory and tasks,
          a pace it can be pushed faster than, and a way it has to shut down. We treat each connection as a small
          long-lived subsystem and work through who owns what, how to keep slow clients from sinking the server, and how
          to retire a socket cleanly.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Builds on Chapters 23, 24, 25, 30, 42, 43, and 47
              </h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 23 covered channels and synchronization choices. Chapter 24 explained futures, Pin, and cancellation.
                Chapter 25 covered Tokio runtime behavior. Chapter 30 covered broker-based fan-out and retry pressure.
                Chapter 42 covered deterministic failure-mode testing. Chapter 43 covered tracing and queue-age metrics.
                Chapter 47 compared streaming transport options on the gRPC side.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter23PageIndex)}>
                Chapter 23
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter24PageIndex)}>
                Chapter 24
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter25PageIndex)}>
                Chapter 25
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter30PageIndex)}>
                Chapter 30
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter42PageIndex)}>
                Chapter 42
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter43PageIndex)}>
                Chapter 43
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter47PageIndex)}>
                Chapter 47
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            An operations team runs an admin console that shows live task progress and pushes operator notifications. The
            naive version is an afternoon of work: open a socket, loop over events, write them out. It demos beautifully.
            Then real usage arrives. Operators leave the console open in five tabs across two monitors. A deploy bounces
            the load balancer and every browser reconnects in the same second. One operator is on hotel Wi-Fi and reads
            messages slower than the server produces them. A new release adds a field to an event and older tabs start
            choking on it.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            None of those are exotic failures. They are the ordinary weather of long-lived connections, and the afternoon
            prototype has no answer for any of them. What the team actually needs is a connection model that survives many
            tabs, reconnect storms, slow consumers, bounded fan-out, protocol versioning, and graceful shutdown. The rest
            of this chapter builds that model one decision at a time.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A useful design order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Decide who owns read IO, write IO, and protocol state before you write handler code.</li>
              <li>Put a bound on outbound buffering before the first slow client appears.</li>
              <li>Version the message envelope before mixed client releases force the issue.</li>
              <li>Write reconnect, shutdown, and observability policy as part of the transport design, not after it.</li>
            </ol>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Mental model</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Before the details, fix the picture. A WebSocket connection is not a function that returns; it is a small
            running machine with three internal jobs. One job reads inbound frames off the wire. One job writes outbound
            frames to the wire. A third job in the middle holds the application state and decides what to send. The two
            transport jobs are the only code that ever touches the socket, and they talk to the application through bounded
            channels rather than shared locks. Keep that shape in mind; almost every recommendation in this chapter is a
            consequence of it.
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Net((network)) -->|frames in| Reader[reader task]\n  Reader -->|owned messages| App[app task: protocol state]\n  App -->|outbound queue| Writer[writer task]\n  Writer -->|frames out| Net\n  App -.->|subscribes to| Hub[(broadcast hub)]`}
            caption="One reader, one application owner, one writer. Only the reader and writer touch the socket; everything else flows through owned messages on bounded channels."
          />
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
          <p className="text-sm text-muted-foreground leading-6">
            The work divides into five recurring concerns: the lifecycle the connection moves through, who owns which part
            of it, how the server protects itself when a client falls behind, how the message protocol survives being
            changed under live traffic, and how to authenticate and shut down without leaving sockets dangling. We take
            them in that order, because each one assumes the previous one is already settled.
          </p>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              The connection lifecycle: upgrade, split, heartbeat, close, reconnect
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A connection moves through a small set of phases, and each phase has different rules about what is allowed.
              The thing to watch in the diagram below is where ordinary HTTP discipline ends and long-lived state begins:
              everything to the left of the split, authentication, origin checks, headers, rate limits, is normal request
              handling, and it must finish before the socket starts carrying application traffic. After the split, you are
              in a steady state that only two events can leave: an explicit close handshake, or a drop that the client
              answers with a reconnect.
            </p>
            <MermaidDiagram
              chart={`stateDiagram-v2\n  [*] --> HttpUpgrade\n  HttpUpgrade --> Open: auth and origin ok\n  HttpUpgrade --> [*]: rejected\n  Open --> Open: ping / pong / messages\n  Open --> Closing: close frame sent\n  Closing --> [*]: close handshake done\n  Open --> Dropped: network failure\n  Dropped --> HttpUpgrade: client reconnects`}
              caption="The upgrade is the last moment normal HTTP auth applies. Once Open, only a close handshake or a drop-then-reconnect leaves the steady state."
            />
            <div className="grid gap-4 lg:grid-cols-3 mt-4">
              {lifecycleCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                One practical correction is worth keeping in mind: ping or pong is transport liveness. Resume cursors,
                application acknowledgments, or last-seen sequence numbers are product liveness. Keep both, and do not let
                one pretend to be the other.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Who owns the read side, the write side, and the protocol state
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              In most async Rust WebSocket stacks the first thing you do after the upgrade is split the connection into a
              read half and a write half. That split is not an implementation detail; it is the ownership boundary the rest
              of the design hangs on. The read half goes to exactly one task, the write half goes to exactly one task, and
              any application logic that needs to react to messages or push updates sits in a third owner that never touches
              the socket directly. The cards below assign each responsibility to a single owner; the reason this matters is
              that the alternative, many tasks sharing the write half behind a lock, makes ordering, close, and error
              handling into a race that Rust would rather you not write in the first place.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {ownershipCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The calm default is usually{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">reader -&gt; app -&gt; writer</code>.
                A broad shared writer lock often looks simpler at first and becomes harder to cancel, order, and test later.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <h4 className="font-semibold text-foreground mb-2">How this lands if you come from another language</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The one-reader, one-writer, one-application-owner shape is the same in any language. What differs is the
              habit you arrive with, and which of those habits Rust quietly refuses to let you keep. Each card below is the
              mental-model shift, not an API mapping.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {comparisonCallouts.map((comparison) => (
                <div key={comparison.title} className="rounded-lg border border-border bg-card p-4">
                  <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Keeping a slow client from sinking the server
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Backpressure is the question of what happens when you produce messages faster than a client can read them.
              The honest framing is that you are always answering it, even when you never wrote the answer down: an
              unbounded queue is a policy that says grow memory until the process dies. The diagram traces the decision
              every push makes. The fork that matters is the one in the middle, when the per-connection queue is full,
              you are forced to choose between dropping data, coalescing it, or dropping the client, and that choice is a
              product decision, not a transport detail.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Push[new outbound message] --> Q{queue full?}\n  Q -->|no| Enqueue[enqueue, writer drains]\n  Q -->|yes| Policy[slow-consumer policy<br/>continues below]`}
              caption="The entry fork: with room in the queue, enqueue and the writer drains it. When the queue is full, control passes to the slow-consumer policy."
            />
            <p className="text-sm text-muted-foreground leading-6">
              When the queue is full, the policy you chose ahead of time decides which of four things to sacrifice:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Policy{slow-consumer policy}\n  Policy -->|drop newest| DropNew[discard this message]\n  Policy -->|drop oldest| DropOld[evict head, enqueue]\n  Policy -->|coalesce| Snap[replace with latest snapshot]\n  Policy -->|disconnect| Evict[close the connection]`}
              caption="The four slow-consumer outcomes. Each one sacrifices something different: the new data, the old data, freshness across updates, or the client itself."
            />
            <div className="grid gap-4 lg:grid-cols-2 mt-4">
              {backpressureCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <h5 className="font-medium text-foreground mb-2">Disconnect storm checklist</h5>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                {disconnectStormChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                An unbounded broadcast path is not “more reliable.” It simply delays the moment you discover which client or
                tenant is too slow for the current policy.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Designing a message protocol that survives being changed
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A WebSocket protocol drifts exactly the way an HTTP API or a broker envelope drifts, and for the same reason:
              old clients and new servers run side by side for as long as someone keeps a tab open. The defense is to make
              the contract explicit in the envelope rather than implicit in the deploy. Two ideas carry most of the weight.
              First, every message carries a version, a kind, and a stable identity, so a mixed fleet stays debuggable.
              Second, transport-level messages, ping, pong, close, subscribe, ack, are a different layer from domain events
              like <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">invoice_created</code>, and keeping
              them separate in the type system keeps them separate in your head.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              In the sketch below, look at the two derives. The <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">#[serde(tag = &quot;type&quot;)]</code>{" "}
              on the client message turns the enum into a tagged union on the wire, so adding a new variant is additive and
              old clients simply never send it. The generic <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Envelope&lt;T&gt;</code>{" "}
              wraps any payload with the version and trace fields so routing and logging never have to parse the body first.
            </p>
            <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{messageEnvelopeSnippet}</code>
            </pre>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {protocolCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Authentication, authorization, origin checks, and rate limiting
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The dangerous assumption with a long-lived connection is that proving who you are once, at the upgrade, also
              settles what you are allowed to do for the next several hours. It does not. Authentication happens at the
              handshake, where you still have ordinary HTTP cookies, headers, and origin to work with. Authorization
              happens on every message, because a connection can be perfectly authenticated and still have no business
              subscribing to a particular stream or issuing a particular command. Keep those two as separate checks, and
              remember that flooding handshakes and flooding messages are different attacks that need separate rate limits.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {securityCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Shutting down without dropping sockets on the floor</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Graceful shutdown is an ordering problem, and the order is the same one TCP services and brokers use: stop
              admitting new work, drain what is already in flight, then cancel the rest with a deadline. The sequence below
              shows why the order is not negotiable. If you cancel the connection tasks first, the close frames never go
              out and clients see an abrupt drop; the entire close policy you wrote simply did not run. The signal flows
              from a supervisor through a watch or cancellation channel that the writer and application loop are already
              watching, so shutdown is something they observe rather than something done to them.
            </p>
            <MermaidDiagram
              chart={`sequenceDiagram\n  participant S as Supervisor\n  participant L as Listener\n  participant A as App loop\n  participant W as Writer\n  S->>L: stop accepting upgrades\n  S->>A: mark draining\n  A->>W: enqueue close frames\n  W-->>S: drained or timeout\n  S->>A: cancel remaining tasks`}
              caption="Stop admission, drain through the writer, then cancel with a timeout. Cancelling first would skip the close frames entirely."
            />
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside mt-4">
              {shutdownSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The important sequencing rule is the same as in TCP services and brokers: stop admission first, drain or
                close second, then cancel the rest with a timeout. If you drop the runtime underneath active sockets, your
                close policy never actually ran.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Testing WebSocket protocols and failure modes</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {testingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter42PageIndex)}>
                Revisit Testing
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter43PageIndex)}>
                Revisit Observability
              </Button>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              When to reach for something other than a WebSocket
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Everything above is the cost of running a WebSocket well, which is the best argument for checking whether you
              need one. The deciding question is almost always direction. If the client only ever listens, a
              server-sent-events stream gives you push over plain HTTP with none of the bidirectional ceremony. If updates
              are rare, polling is genuinely simpler infrastructure. gRPC streaming wins for typed service-to-service
              traffic, and a message broker wins when producers and consumers should be decoupled in time. Pick a
              WebSocket when both sides truly need to talk over one long-lived session, not by reflex.
            </p>
            <div className="grid gap-4 lg:grid-cols-5">
              {transportChoiceCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-1">{card.title}</div>
                  <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">{card.bestFor}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter30PageIndex)}>
                Revisit Brokers
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter47PageIndex)}>
                Revisit gRPC Streaming
              </Button>
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
                The most expensive WebSocket bug is often not a parser failure. It is one connection model that never stated
                who owns writes, how slow consumers are handled, or what happens when thousands of clients reconnect at once.
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
                <h4 className="font-semibold text-foreground">
                  Example 1: separate reader, writer, and application logic with channels
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  This example models the whole connection with Tokio channels and a watch shutdown signal: one reader
                  task, one app task, one writer task. A real WebSocket crate hands you the transport halves instead of
                  channels, but the ownership shape is identical, and the shape is the lesson. As you read it, watch the
                  direction of data: nothing ever reaches the writer except by way of the app task, and the reader never
                  writes. Follow one inbound message through the diagram first, then find the same hops in the code.
                </p>
              </div>
              {codes.websocket_connection_io_split !== DEFAULT_CODES.websocket_connection_io_split && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("websocket_connection_io_split")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <MermaidDiagram
              chart={`sequenceDiagram\n  participant R as Reader\n  participant A as App\n  participant W as Writer\n  R->>A: inbound message (owned)\n  A->>A: update protocol state\n  A->>W: outbound message (owned)\n  W->>W: drain queue, write frame\n  Note over R,W: shutdown signal closes channels, writer finishes last`}
              caption="Inbound flows reader to app to writer; outbound never skips the app. On shutdown the channels close in order so the writer drains before the connection ends."
            />
            <div className="mt-4">
            <RustCodeEditor
              code={codes.websocket_connection_io_split}
              onChange={(newCode) => updateCode("websocket_connection_io_split", newCode)}
              onRun={() => runCode("websocket_connection_io_split")}
              output={outputs.websocket_connection_io_split ?? null}
              isRunning={isRunning === "websocket_connection_io_split"}
              filename="channel_separated_connection_loop.rs"
              expectedOutput={"inbound = 3\noutbound = 3\nclosed = true"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.websocket_connection_io_split}
              onRevert={() => resetCode("websocket_connection_io_split")}
            />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Read ownership</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Only the reader task consumes inbound frames from the transport boundary.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Write ownership</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Only the writer task drains outbound messages, which keeps close and pong ordering explicit.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">App seam</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The app task owns protocol reactions without needing broad shared socket access.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 2: bounded fan-out with slow-consumer eviction
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  This is the slow-consumer policy from the diagram above, made concrete and runnable. It keeps the queue
                  logic crate-light with a{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">VecDeque</code> per client, but the
                  decision is the same one a bounded channel makes in a real async service. The line to focus on is the
                  capacity check before each enqueue: the broadcast walks every subscriber, and any client already at its
                  bound is evicted rather than allowed to grow memory. The diagram shows that fork from the broadcast's
                  point of view; in the run, client <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">beta</code>{" "}
                  is the one over its limit, so it is the one that disappears.
                </p>
              </div>
              {codes.websocket_bounded_fanout_slow_consumers !== DEFAULT_CODES.websocket_bounded_fanout_slow_consumers && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("websocket_bounded_fanout_slow_consumers")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <MermaidDiagram
              chart={`flowchart TD\n  Bcast[broadcast event] --> Loop{for each subscriber}\n  Loop --> Cap{at queue bound?}\n  Cap -->|no| Deliver[enqueue, delivered++]\n  Cap -->|yes| Evict[evict subscriber]\n  Deliver --> Loop\n  Evict --> Loop\n  Loop -->|done| Out[active and evicted counts]`}
              caption="One broadcast visits every subscriber. Those with room receive the event; those already at the bound are evicted, which is why the run reports active = 2 and evicted = beta."
            />
            <div className="mt-4">
            <RustCodeEditor
              code={codes.websocket_bounded_fanout_slow_consumers}
              onChange={(newCode) => updateCode("websocket_bounded_fanout_slow_consumers", newCode)}
              onRun={() => runCode("websocket_bounded_fanout_slow_consumers")}
              output={outputs.websocket_bounded_fanout_slow_consumers ?? null}
              isRunning={isRunning === "websocket_bounded_fanout_slow_consumers"}
              filename="bounded_fanout_slow_consumers.rs"
              expectedOutput={"active = 2\nevicted = beta\ndelivered = 2"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.websocket_bounded_fanout_slow_consumers}
              onRevert={() => resetCode("websocket_bounded_fanout_slow_consumers")}
            />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Bound</div>
                <p className="text-xs text-muted-foreground leading-5">
                  One max pending value makes the slow-consumer rule mechanically testable.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Eviction</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The server notices the client at the limit before the next push grows memory again.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Production translation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  In a real room or tenant hub, this policy combines with metrics, reconnect advice, and optional snapshot
                  coalescing.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch48_websockets_long_lived_connections/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor, including a small
              versioned envelope sketch alongside the two runnable examples.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to design one explicit read/write ownership loop, replace unbounded
            broadcast with a bounded slow-consumer policy, design a versioned authenticated protocol, and test reconnect
            and shutdown failure modes deliberately.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 48 Exercises
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
