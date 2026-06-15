"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Bug,
  Cpu,
  Gauge,
  Network,
  Repeat,
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
    title: "A broker is a failure and pacing boundary, not only a queue",
    body: "The reason to introduce a broker is to let the producer and the consumer run on different clocks: the producer can publish during a spike while a slower consumer drains the backlog at its own rate, and either side can crash and restart without taking the other down. That decoupling is genuinely useful, but it is not free. The moment you add it, queue depth, redelivery count, duplicate rate, and message age stop being broker internals and become numbers your team has to budget for, watch, and reason about during incidents.",
  },
  {
    title: "Delivery is at-least-once, so plan for duplicates",
    body: "AMQP can redeliver a message any time an ack is lost, a consumer dies mid-handler, or the broker is unsure whether you finished. From the application's point of view that means the same message can arrive more than once, and there is no flag that turns this off. The calm response is to make the consumer idempotent, or to commit a dedupe checkpoint in the same durable step as the side effect, so a second delivery is a no-op rather than a second charge or a second email.",
  },
  {
    title: "Topology is design you own, not plumbing trivia",
    body: "Exchange type, routing-key shape, queue boundaries, dead-letter paths, prefetch limits, and local worker budgets are not configuration you fill in at the end. Together they decide how a failure in one consumer spreads, whether a burst is absorbed or amplified, and where a poison message lands. Designing topology deliberately is the difference between a system that degrades gracefully and one that turns a single bad message into a stuck queue.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You are used to thinking about a queue as a data structure you own inside one address space, where the hard part is locking and lifetime. A broker moves that boundary across processes and machines: the bytes are serialized, the lifetime is the broker's, and the expensive bugs become replay, duplication, and shutdown sequencing rather than aliasing. Model the message the way you would model a stable wire format, not a pointer with nicer packaging.",
  },
  {
    title: "C# background",
    body: "If your instinct from MassTransit, NServiceBus, or Azure Service Bus is that the framework makes delivery 'just work,' Rust will feel barer on purpose. There is no ambient transaction enrolling the message receive, the database write, and the ack into one unit. You decide explicitly when the handler commits state, when it acks, and how poison messages and retries are represented, and the type system makes those decision points visible.",
  },
  {
    title: "Go background",
    body: "A Go channel is in-process coordination: cheap, ordered within the channel, and gone when the program exits. An AMQP queue looks similar in the small but is a durable, distributed reliability boundary with its own storage, routing, redelivery, and backlog. Treat 'send on a channel' and 'publish to a broker' as different reliability tiers, and give the broker boundary the same care you would give a network RPC. AMQP ordering is also weaker than Go channel ordering once retries and dead-letter paths are active: the only safe ordering guarantee is the one your workflow still enforces explicitly.",
  },
  {
    title: "Python background",
    body: "Coming from Celery or Kombu, the broker is the part you usually never see; the decorator and the worker hide acks, retries, and serialization. Rust pushes those back into the open. That is more code up front, but it also means at-least-once delivery, idempotency, and dead-letter routing become things you can read in the handler and test without a live broker, instead of behaviors buried in a task runner's defaults.",
  },
]

const fundamentals = [
  {
    title: "When to reach for a broker",
    body: "Introduce a broker when the producer and consumer genuinely need to fail, scale, deploy, or pace independently: a checkout that must not block on a slow search indexer, or a billing worker you want to restart without dropping orders. Do not reach for one just to avoid a direct function call between two components that already live in the same process; there you are adding a network hop, serialization, and a whole failure surface to dodge a method call.",
  },
  {
    title: "Delivery semantics",
    body: "At-least-once is the assumption to design around: the broker guarantees a message is delivered, not that it is delivered exactly once. Truly exactly-once side effects remain an application-level problem, solved with idempotency keys, the outbox pattern, or committing a dedupe record in the same transaction as the effect. The broker gives you durability and redelivery; it does not give you exactly-once for free.",
  },
  {
    title: "Queue depth is a budget",
    body: "A queue absorbs bursts, which is the point, but the same buffering can mask sustained overload until it becomes an outage. Depth, message age, backlog growth rate, retry amplification, and dead-letter rate are the numbers that distinguish a queue doing its job from one quietly failing. Watch them before you call the system healthy, because a flat dashboard with a deep queue is not health, it is a deferred incident.",
  },
]

const amqpConceptCards = [
  {
    title: "Exchange",
    body: "A producer publishes to an exchange, never directly to a queue. The exchange is the routing brain: it looks at the routing key and the bindings that have been declared against it and decides which queues, if any, should receive a copy. Because the producer only knows the exchange and a key, you can add, remove, or re-route consumers by changing bindings without touching publisher code. The exchange type (direct, topic, fanout, headers) chooses the matching rule.",
  },
  {
    title: "Queue",
    body: "A queue is the durable buffer that actually holds messages. A delivery sits in the queue until a consumer receives and acknowledges it, at which point the broker drops it, or until a policy such as a TTL or a dead-letter rule moves it elsewhere. A queue can have several competing consumers, in which case the broker load-balances deliveries across them, which is how you scale a consumer horizontally.",
  },
  {
    title: "Binding",
    body: "A binding is the link you declare from an exchange to a queue, together with the rule that decides which messages flow across it. For a direct exchange the rule is an exact routing-key match; for a topic exchange it is a pattern with wildcards. Bindings are where the routing topology actually lives, and they can be changed at runtime, which is what keeps publishers decoupled from the set of consumers.",
  },
  {
    title: "Routing key",
    body: "The routing key is the short string the producer attaches to each message, such as orders.created. It carries no behavior on its own; the exchange interprets it against the bindings. Because every consumer's subscription is expressed in terms of these keys, the routing-key vocabulary is part of your system's public contract. Treat it like an API: design it early, keep it stable, and version it deliberately rather than renaming keys under live consumers.",
  },
]

const rabbitMqCards = [
  {
    title: "Keep AMQP in an adapter layer",
    body: "The async clients (lapin, amqprs) speak the protocol fluently, but their types should not leak into your domain. Deserialize and validate at the edge, turn the bytes into owned domain messages, and pass those into ordinary handlers. Connection and channel mechanics stay in the adapter, which keeps your business logic testable without a live broker and lets you swap transports later.",
  },
  {
    title: "Connection and channel policy",
    body: "AMQP multiplexes many lightweight channels over one TCP connection. The calm pattern is a small number of long-lived connections with role-specific channels per task, not a fresh connection per message and not one giant shared mutable channel. Channels are not thread-safe to share across tasks, so give each consumer or publisher its own.",
  },
  {
    title: "Confirms and prefetch",
    body: "Publisher confirms turn a fire-and-forget publish into an observable one: the broker acknowledges it has the message durably, so a failed publish becomes a value you can act on. Consumer prefetch (basic.qos) caps how many unacked messages the broker will hand a consumer at once, which is your first and cheapest backpressure lever.",
  },
]

const producerConsumerCards = [
  {
    title: "Producers",
    body: "A producer's job is to put a stable, self-describing message on the wire, not to dump whatever its internal aggregate happens to hold today. Publish a versioned envelope with a message ID and the fields consumers actually contracted for, so an internal refactor does not silently break a downstream service. The publish itself is a failure boundary too: the network can drop, the broker can be busy, so decide up front whether a failed publish is retried, buffered in an outbox, or surfaced as an error to the caller.",
  },
  {
    title: "Consumers",
    body: "A consumer owns the order in which things become real, and that order is the whole game. The safe sequence is deserialize, validate, run the handler, commit the durable side effect, and only then ack. Ack first and a crash loses the work; commit first and a crash at worst redelivers work you can absorb idempotently. Whenever the steps drift out of this order, redelivery will eventually find the gap and turn it into a production incident.",
  },
]

const ackRetryCards = [
  {
    title: "Acknowledge after the real work",
    body: "Send the ack only after the state change, local transaction, or outbox write that makes the message safe to forget has actually committed. Acking on receipt feels tidy and is one of the most common ways to lose work silently: the handler crashes a line later, the broker has already dropped the message, and nothing redelivers it.",
  },
  {
    title: "Retry only transient failures",
    body: "Distinguish failures that a second attempt might fix from failures that never will. A network blip, a dependency timeout, or a momentary capacity problem are worth retrying. A schema mismatch, an invalid payload, or an unsupported command will fail identically every time, so they belong in rejection or dead-lettering rather than a requeue that just burns capacity.",
  },
  {
    title: "Keep retry policy visible",
    body: "The attempt cap, the backoff between attempts, and the eventual dead-letter destination should be written down in code and reflected in metrics, not left to a broker default nobody remembers setting. An unbounded requeue loop is not resilience; it is overload wearing a disguise, often the proximate cause of a queue that will not drain.",
  },
]

const deadLetterCards = [
  {
    title: "Dead-letter queues",
    body: "A DLQ isolates poison messages and terminal failures so the main queue can keep moving. That separation is operational gold during incidents and replay work.",
  },
  {
    title: "Use DLQ as an investigation boundary",
    body: "The first question after a dead-letter event is usually whether the failure was transient, contract drift, or a true permanent business rejection. Keep enough envelope metadata to answer that later.",
  },
  {
    title: "Do not treat DLQ as a trash can",
    body: "A dead-letter path needs ownership too: alerting, replay tooling, retention, and an explicit policy for discard versus manual repair.",
  },
]

const idempotencyCards = [
  {
    title: "Store a stable message or operation key",
    body: "The consumer needs a durable way to say 'I already applied this effect.' That key might be a broker message ID, an application event ID, or a domain operation key.",
  },
  {
    title: "Commit the dedupe checkpoint with the side effect",
    body: "If the handler writes business state and then separately records message completion, a crash between those steps still leaves a replay hole. The safe design commits them together or makes the operation itself naturally repeat-safe.",
  },
  {
    title: "Idempotency is broader than de-duplication",
    body: "A duplicate may still be harmless if the handler is naturally repeat-safe, such as upserting one exact state or recording one outbox event with a uniqueness constraint.",
  },
]

const backpressureCards = [
  {
    title: "Broker-side backpressure",
    body: "Prefetch and queue policy limit how much work a consumer admits before acking. That keeps the broker from becoming an invisible unacked-work reservoir.",
  },
  {
    title: "Local backpressure",
    body: "Do not drain a queue into an unbounded in-process task flood. Bounded worker queues and explicit consumer concurrency caps are part of the handler contract.",
  },
  {
    title: "Retry traffic counts as traffic",
    body: "A retry queue can amplify overload if it shares no budget with normal work. Count retries, bound them, and observe them as a first-class load source.",
  },
]

const observabilityChecklist = [
  "Queue depth and message age by queue or routing domain.",
  "Unacked message count and consumer prefetch pressure.",
  "Publish confirm latency and publish failure rate.",
  "Handler duration, success rate, retry rate, and dead-letter rate.",
  "Idempotency hit rate or duplicate-ack count.",
  "Connection or channel churn, reconnect rate, and shutdown drain time.",
]

const productionPatterns = [
  "Treat AMQP messages as explicit transport DTOs with a versioned envelope, a stable message ID, and enough metadata for replay and incident work.",
  "Ack after the durable effect or durable checkpoint, not after mere receipt.",
  "Separate transient retry paths from permanent dead-letter paths. They answer different operational questions.",
  "Keep consumer concurrency bounded twice: broker prefetch plus local worker or task budget.",
  "Make idempotency ordinary domain logic instead of a late broker-specific patch. That keeps replay and testing calmer.",
  "Log and metric the broker boundary like any other dependency: queue age, redelivery, DLQ growth, and confirm latency are production signals, not transport trivia.",
]

const pitfalls = [
  "Acking too early because the handler looked small in code. The missing state update only appears when the process crashes between receipt and durable commit.",
  "Requeueing every failure forever. Poison messages and permanent contract mismatches deserve a terminal path.",
  "Treating one process-wide queue drain as permission to spawn unbounded local work. That only moves overload from the broker into your heap.",
  "Using the broker message as the domain model directly, then discovering schema evolution, optional fields, and transport-only metadata infected core business code.",
  "Skipping idempotency because 'the broker is reliable.' Reliable delivery and exactly-once side effects are different problems.",
  "Treating queue order as global business order once several consumers, retries, and dead-letter paths exist. The only safe ordering guarantee is the one your workflow still enforces explicitly.",
]

const lapinSketchSnippet = `// Cargo.toml: lapin = "2", tokio = { version = "1", features = ["full"] }
use lapin::{options::*, types::FieldTable, BasicProperties, Connection, ConnectionProperties};

// Connect once, then open a channel per task.
let conn = Connection::connect(&amqp_url, ConnectionProperties::default()).await?;
let channel = conn.create_channel().await?;

// Publish: producer names the exchange and a routing key, never a queue.
channel
    .basic_publish(
        "orders",            // exchange
        "orders.created",    // routing key
        BasicPublishOptions::default(),
        &payload_bytes,      // the serialized envelope
        BasicProperties::default(),
    )
    .await?
    .await?;                 // second await waits for the publisher confirm

// Consume: ack only after the durable effect has committed.
let mut consumer = channel
    .basic_consume("orders.billing", "billing-worker", BasicConsumeOptions::default(), FieldTable::default())
    .await?;
while let Some(delivery) = consumer.next().await {
    let delivery = delivery?;
    // ... deserialize, validate, run handler, commit durable effect ...
    delivery.ack(BasicAckOptions::default()).await?;
}`

const messageEnvelopeSnippet = `#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum OrderEvent {
    Created { order_id: String, total_cents: u64 },
    Cancelled { order_id: String, reason: Option<String> },
}

#[derive(Debug, Serialize, Deserialize)]
struct MessageEnvelope<T> {
    schema_version: u16,
    message_id: String,
    #[serde(default)]
    trace_id: Option<String>,
    payload: T,
}`

const summaryPoints = [
  "A broker is a reliability and pacing boundary. Queue depth, retry policy, and message age are part of the design.",
  "AMQP topology matters: exchange, queue, binding, and routing key shape drive routing and failure isolation.",
  "RabbitMQ integration in Rust should stay in an adapter layer, while producers and consumers exchange owned DTOs and domain messages.",
  "Manual acknowledgments, retry budgets, DLQs, and idempotency are not optional polish. They are the core of a production consumer design.",
  "Backpressure is both broker-side and local. Prefetch without bounded local work still hides overload.",
  "Observability around confirms, retries, dead letters, duplicates, and queue age is what turns a broker deployment into an operable system.",
]

export function PageCh30AmqpAndMessageBrokers() {
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
  const pageIndex = getPageIndexById("ch30-amqp-and-message-brokers")
  const chapter31PageIndex = getPageIndexById("ch31-distributed-task-execution")
  const chapter19PageIndex = getPageIndexById("ch19-serialization-and-data-contracts")
  const chapter22PageIndex = getPageIndexById("ch22-multithreading-in-rust")
  const chapter23PageIndex = getPageIndexById("ch23-synchronization-primitives")
  const chapter25PageIndex = getPageIndexById("ch25-tokio")
  const chapter26PageIndex = getPageIndexById("ch26-task-libraries-and-parallel-execution")
  const exercisesPageIndex = getPageIndexById("ch30-amqp-and-message-brokers-exercises")
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
          Chapter 30 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          A message broker lets services hand work to each other without being online at the same time. That convenience
          comes with a bill: routing, redelivery, idempotent consumers, dead-letter policy, and backpressure all become
          your responsibility. This chapter treats AMQP not as a library to call but as an operational contract to design.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 19, 22, 23, 25, and 26</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 19 covered wire DTOs and versioned envelopes. Chapters 22 and 23 covered ownership across threads,
                message passing, and synchronization. Chapters 25 and 26 covered Tokio, bounded queues, retries, and
                task orchestration. AMQP systems sit across all of that.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter19PageIndex)}>
                Chapter 19
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter22PageIndex)}>
                Chapter 22
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter23PageIndex)}>
                Chapter 23
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter25PageIndex)}>
                Chapter 25
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
            An order pipeline is being split into checkout, billing, search indexing, and notification services. The
            business requirement is reliable asynchronous handoff: route messages by contract, preserve idempotency, ack
            only after durable effects, isolate poison messages, and expose queue depth and retry pressure.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Pick the broker boundary only when producer and consumer should truly decouple in time or failure.</li>
              <li>Design topology second: exchange, routing key, queue boundaries, dead-letter flow.</li>
              <li>Design the acknowledgment contract third: the chapter covers exactly when and why to acknowledge below.</li>
              <li>Cap consumer admission both in the broker and in the local worker pool.</li>
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
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Message broker fundamentals</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {fundamentals.map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{item.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{item.body}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              The shape worth memorizing is a one-way pipeline with the broker sitting in the middle. A producer never
              names a queue; it publishes to an exchange with a routing key. The exchange consults its bindings, copies
              the message into every matching queue, and each queue feeds its own consumers at their own pace. Everything
              between the publish call and the ack is the broker's responsibility, which is exactly why it can buffer a
              burst or survive a consumer restart.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  P[Producer] -->|publish key| X{Exchange}\n  X -->|binding match| Q1[(orders queue)]\n  X -->|binding match| Q2[(search queue)]\n  Q1 --> C1[Billing consumer]\n  Q2 --> C2[Search consumer]\n  C1 -->|ack| Q1\n  C2 -->|ack| Q2`}
              caption="The producer talks only to the exchange; bindings fan one message out to the queues that subscribed, and each consumer acks its own queue."
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              AMQP concepts: exchanges, queues, bindings, and routing keys
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {amqpConceptCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The critical operational point is this: the producer chooses a routing key, but the exchange owns routing
                policy. That lets teams change routing topology without turning every publisher into a queue-aware special
                case.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">RabbitMQ with Rust</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {rabbitMqCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6 mb-3">
                In a real Cargo service, the transport adapter typically holds the AMQP client connection and channel
                setup, then hands owned envelopes or commands into ordinary Rust handlers. Keep the transport edge narrow so
                the retry, idempotency, and serialization logic remains testable without a live broker. The sketch below
                shows the shape of that edge with <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">lapin</code>:
                a connection, a channel, a confirmed publish keyed by exchange and routing key, and a consume loop that
                acks only after the work is done. It is illustrative rather than runnable here, but it is the real API
                surface the runnable examples below simulate in pure std.
              </p>
              <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{lapinSketchSnippet}</code>
              </pre>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Producers and consumers</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {producerConsumerCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              The single most important sequence in this chapter is the order in which a consumer commits its side effect
              and sends its ack. The broker holds the message as unacknowledged until the consumer says it is done. If the
              consumer commits the durable effect first and then acks, a crash in between costs you only a redelivery,
              which an idempotent handler absorbs. If it acks first, the broker forgets the message and a crash loses the
              work for good.
            </p>
            <MermaidDiagram
              chart={`sequenceDiagram\n  participant B as Broker\n  participant C as Consumer\n  participant D as Database\n  B->>C: deliver message\n  C->>C: deserialize and validate\n  C->>D: commit side effect\n  D-->>C: committed\n  C->>B: ack\n  Note over B,C: crash before ack to redelivery, safe if idempotent`}
              caption="Commit the durable effect, then ack. A crash before the ack only causes a safe redelivery; acking first would lose the work."
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Repeat className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-foreground">Acknowledgments and retries</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              An ack is a promise that the work is safely done and the broker may forget the message. A retry is a
              decision that the work is not done yet and deserves another attempt. Both are choices the consumer makes
              explicitly, and getting them right is most of what separates a robust consumer from one that quietly drops
              or endlessly reprocesses work.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {ackRetryCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Dead-letter queues</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Once the retry cap is exhausted, the message needs a final resting place. Not every failure should be
              retried in the first place: a malformed payload or an unsupported command will fail the same way on
              every attempt, and requeuing it forever just blocks the queue behind a message that can never succeed. A
              dead-letter queue is the escape hatch: the broker moves a message there after it has exhausted its retries
              or been explicitly rejected, so the main queue keeps flowing and a human can inspect the casualties later.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {deadLetterCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Idempotency</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              At-least-once delivery makes idempotency a requirement, not a feature. Because the broker can always
              redeliver, the only way to make duplicates harmless is to make the handler
              idempotent: applying the same message twice must leave the system in the same state as applying it once.
              Sometimes that is free, when the operation is naturally a set-it-to-this upsert. More often you need a
              durable record of which message IDs have already been applied, committed in the same step as the effect, so
              a second delivery sees the record and does nothing.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {idempotencyCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                A duplicate delivery is not a surprising edge case. In broker-based systems, it is the design center.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Backpressure</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A queue is a shock absorber, but a shock absorber with no limit just hides the fact that you are
              overloaded. Backpressure is how the system says no gracefully instead of falling over. It has two layers
              that are easy to confuse: the broker side, which caps how many unacked messages a consumer may hold at once,
              and the local side, which caps how much in-process work those messages can spawn. Set one without the other
              and you have only moved the overload from the broker into your own heap.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {backpressureCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground mb-3">Serialization for messages</h4>
                <p className="text-sm text-muted-foreground leading-6 mb-4">
                  A message often outlives the code that produced it: it can sit in a queue across a deploy, be replayed
                  weeks later, or be consumed by a service on an older version. That is why broker payloads earn their keep
                  when they travel inside an explicit envelope rather than as a bare struct dump. The envelope carries a
                  schema version so consumers can branch on format, a message ID so they can deduplicate, and optional
                  trace metadata for debugging, while the tagged payload keeps the wire shape stable. Evolve it additively
                  with optional fields rather than redefining what existing fields mean, and old and new consumers can keep
                  reading the same stream.
                </p>
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{messageEnvelopeSnippet}</code>
                </pre>
              </div>
              <Button variant="outline" onClick={() => setCurrentPage(chapter19PageIndex)} className="shrink-0">
                Revisit Chapter 19
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Observability in broker-based systems</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A broker is a place work can pile up invisibly, so you cannot run one on faith. The signals below are the
              minimum set that tells you whether the system is healthy or merely quiet because nothing is being processed.
              A growing queue with rising message age, a climbing retry rate, or a dead-letter queue that keeps filling
              are early warnings; treat them as first-class production metrics rather than transport trivia you only look
              at during an incident.
            </p>
            <div className="grid gap-3 lg:grid-cols-2">
              {observabilityChecklist.map((item) => (
                <div key={item} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{item}</p>
                </div>
              ))}
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
                <h4 className="font-semibold text-foreground">Example 1: direct exchange routing</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The example keeps the routing model tiny: producers publish one routing key, the exchange owns binding
                  policy, and queues receive only what their bindings match.
                </p>
              </div>
              {codes.amqp_direct_exchange_routing !== DEFAULT_CODES.amqp_direct_exchange_routing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("amqp_direct_exchange_routing")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the exchange holds a map from routing key to the set of bound queues, and
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">publish</code>
              is just a lookup that copies the message into each match. The key
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">orders.created</code>
              is bound to two queues, so one publish produces two deliveries; an unbound key produces zero and is counted
              as unrouted instead of silently vanishing. Trace one message through the diagram below, then read the same
              path in code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Pub[publish orders.created] --> Ex{direct exchange}\n  Pub2[publish orders.cancelled] --> Ex\n  Ex -->|orders.created| Bill[(billing)]\n  Ex -->|orders.created| Search[(search)]\n  Ex -->|orders.cancelled| Bill`}
              caption="Bound keys: created fans out to billing and search, cancelled goes to billing only."
            />
            <p className="text-sm text-muted-foreground leading-6">
              An unbound key takes the other exit instead of silently vanishing:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Pub3[publish orders.refunded] --> Ex{direct exchange}\n  Ex -->|no binding| Drop[unrouted count]`}
              caption="The refunded key matches no binding, so the exchange charges it to the unrouted counter."
            />
            <RustCodeEditor
              code={codes.amqp_direct_exchange_routing}
              onChange={(newCode) => updateCode("amqp_direct_exchange_routing", newCode)}
              onRun={() => runCode("amqp_direct_exchange_routing")}
              output={outputs.amqp_direct_exchange_routing ?? null}
              isRunning={isRunning === "amqp_direct_exchange_routing"}
              filename="direct_exchange_routing.rs"
              expectedOutput={"created = billing,search\ncancelled = billing\nunrouted = 0"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.amqp_direct_exchange_routing}
              onRevert={() => resetCode("amqp_direct_exchange_routing")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Exchange</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The exchange owns routing policy and binding state.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Routing key</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Producers publish one semantic key such as <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">orders.created</code>.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Queues</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Queue selection stays declarative instead of being hard-coded into every publisher.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: idempotent consumer with retries and a DLQ</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The handler only acks successful unique work. Duplicates are counted and ignored, transient failure
                  retries are capped, and terminal failures move to a DLQ.
                </p>
              </div>
              {codes.amqp_idempotent_consumer !== DEFAULT_CODES.amqp_idempotent_consumer && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("amqp_idempotent_consumer")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: every delivery flows through one small decision machine. First the handler checks whether
              the message ID is already in the seen set; if so it is a duplicate and is acked without doing the work
              again. Otherwise it runs the handler, and the outcome routes it: success records the ID and acks, a
              transient failure under the attempt cap goes back for a counted retry, and a failure that exhausts the cap
              is sent to the dead-letter queue rather than requeued forever. The diagram is that state machine; the four
              output counters are just tallies of which path each message took.
            </p>
            <MermaidDiagram
              chart={`stateDiagram-v2\n  [*] --> Check\n  Check --> Duplicate: id already recorded\n  Check --> Handle: new id\n  Handle --> Done: success\n  Handle --> Retry: transient, attempts left\n  Handle --> DeadLetter: attempts exhausted\n  Retry --> Handle: redeliver\n  Done --> [*]: record id and ack\n  Duplicate --> [*]: ack, no work\n  DeadLetter --> [*]: park for inspection`}
              caption="One delivery, four exits: duplicate, done, retry, or dead-letter. The counters in the output map directly to these edges."
            />
            <RustCodeEditor
              code={codes.amqp_idempotent_consumer}
              onChange={(newCode) => updateCode("amqp_idempotent_consumer", newCode)}
              onRun={() => runCode("amqp_idempotent_consumer")}
              output={outputs.amqp_idempotent_consumer ?? null}
              isRunning={isRunning === "amqp_idempotent_consumer"}
              filename="idempotent_consumer_retry_dlq.rs"
              expectedOutput={"processed = 2\nduplicates = 1\nretried = 2\ndlq = 1"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.amqp_idempotent_consumer}
              onRevert={() => resetCode("amqp_idempotent_consumer")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Idempotency</div>
                <p className="text-xs text-muted-foreground leading-5">
                  A completed message ID is recorded so replay becomes harmless.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Retry</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Retry remains explicit, counted, and bounded by attempt number.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">DLQ</div>
                <p className="text-xs text-muted-foreground leading-5">
                  After the last allowed attempt, the delivery stops cycling and moves to a terminal bucket.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Observability</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Processed, duplicate, retry, and DLQ counts become ordinary metrics, not incident archaeology.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch30_amqp_and_message_brokers/
              </code>{" "}
              including a small versioned message-envelope example alongside the two runnable worked examples.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How this lands by background</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            Most engineers do not arrive at message brokers as a blank slate; they arrive with a mental model from another
            ecosystem. The useful thing to know is which part of that model transfers and which part will quietly mislead
            you. The shift is almost never about API names. It is about where reliability and consistency work has to
            happen now that a durable, distributed boundary sits between your services.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
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
                A broker can decouple services, but it will not decouple you from consistency. It merely changes where the
                consistency work must be done.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to choose ack timing, model an idempotent consumer, add retry and DLQ
            handling, and design a versioned message contract that can survive mixed deployments.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 30 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Next chapter</h3>
              <p className="text-sm text-muted-foreground leading-6">
                A broker hands single messages between services. Chapter 31 scales that idea up to distributed task
                execution: dispatching units of work across many workers, tracking their state, and recovering when a
                worker dies mid-task. The acknowledgment, retry, and idempotency habits from this chapter become the
                foundation for that work.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(chapter31PageIndex)} className="gap-2 shrink-0">
              Continue to Chapter 31
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
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
