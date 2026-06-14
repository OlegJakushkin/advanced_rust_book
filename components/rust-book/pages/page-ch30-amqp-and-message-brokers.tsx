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
    title: "A broker is a failure and pacing boundary, not only a queue",
    body: "A message broker decouples producer time from consumer time. That helps with resilience and scaling, but it also means queue depth, retries, duplicates, and message age become part of the system's operational budget.",
  },
  {
    title: "AMQP delivery is usually at-least-once from the application's point of view",
    body: "The calm default is to assume duplicates can happen. A consumer should be idempotent or should commit a dedupe checkpoint together with its side effect before it acks.",
  },
  {
    title: "Topology is design, not plumbing trivia",
    body: "Exchange type, routing key shape, queue boundaries, dead-letter paths, prefetch, and local worker budgets all change how failure and overload move through the system.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Treat the broker as an ownership boundary between processes rather than as a pointer handoff with better serialization. The expensive bugs are usually replay, duplication, and shutdown sequencing, not syntax.",
  },
  {
    title: "C# background",
    body: "A broker is not a magical durable event bus that removes consistency questions. The important decision is still when the handler commits state, when it acks, and how retries and poison messages are modeled explicitly.",
  },
  {
    title: "Go background",
    body: "An AMQP queue is not an in-process channel with extra latency. Channels are memory-local coordination. A broker is a distributed reliability boundary with storage, routing, redelivery, and operational backlog.",
  },
]

const fundamentals = [
  {
    title: "Broker fundamentals",
    body: "Use a broker when the producer and consumer should fail, scale, deploy, or pace independently. Do not use one just to avoid a direct function call between components already in one process.",
  },
  {
    title: "Delivery semantics",
    body: "At-least-once is the sane default assumption. Exactly-once side effects are still an application-level design problem, usually solved with idempotency keys, outbox patterns, or transactional checkpoints.",
  },
  {
    title: "Queue depth is a budget",
    body: "A queue can absorb bursts, but it can also hide overload. Message age, backlog growth, retry amplification, and dead-letter rate should be visible before the system is called healthy.",
  },
]

const amqpConceptCards = [
  {
    title: "Exchange",
    body: "The producer usually publishes to an exchange, not directly to a queue. The exchange decides which queues should receive the message.",
  },
  {
    title: "Queue",
    body: "A queue stores deliveries until a consumer receives and acknowledges them, or until another policy such as expiry or dead-letter routing moves them elsewhere.",
  },
  {
    title: "Binding",
    body: "A binding connects an exchange to a queue. The binding rule usually uses exchange-specific matching logic such as an exact direct key or a topic pattern.",
  },
  {
    title: "Routing key",
    body: "The producer chooses a routing key. The exchange interprets it under the binding rules. Stable routing-key design is part of the contract, not a late config detail.",
  },
]

const rabbitMqCards = [
  {
    title: "RabbitMQ with Rust",
    body: "Keep the AMQP client code in an adapter layer. Deserialize at the edge, convert into owned domain messages, and keep domain handlers free of connection and channel mechanics.",
  },
  {
    title: "Connection and channel policy",
    body: "A few long-lived connections and role-specific channels are calmer than connect-per-message or one giant globally shared mutable transport object.",
  },
  {
    title: "Confirms and prefetch",
    body: "Publisher confirms make the publish boundary observable. Consumer prefetch keeps unacked work bounded so one consumer does not pull more than it can process responsibly.",
  },
]

const producerConsumerCards = [
  {
    title: "Producers",
    body: "A producer should publish a stable wire DTO or event envelope, not a half-internal aggregate dump. It should also treat the publish path as a failure boundary with retries or confirms chosen deliberately.",
  },
  {
    title: "Consumers",
    body: "A consumer owns the side effect boundary: deserialize, validate, run the handler, commit state, then ack. If that order is wrong, redelivery behavior will expose it eventually.",
  },
]

const ackRetryCards = [
  {
    title: "Acknowledge after the real work",
    body: "Ack after the state change, local transaction, or outbox write that makes the message safe to forget. Acking before the durable side effect is one of the easiest ways to lose work silently.",
  },
  {
    title: "Retry only transient failures",
    body: "Network blips, temporary dependency timeouts, and capacity issues may justify retry. Validation failure, malformed payloads, or unsupported domain commands usually want rejection or dead-lettering, not blind requeue.",
  },
  {
    title: "Keep retry policy visible",
    body: "Retry count, delay policy, and final dead-letter path should be visible in code and metrics. An infinite requeue loop is not resilience. It is hidden overload.",
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
    setShowToc,
  } = useBook()
  const pageIndex = getPageIndexById("ch30-amqp-and-message-brokers")
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
          Message-broker systems need reliable routing, redelivery handling, idempotent consumers, dead-letter policy, and
          local backpressure. This chapter covers AMQP as an operational contract.
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
              <li>Ack only after the durable effect or durable checkpoint.</li>
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
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`producer -> exchange -> queue -> consumer`}</code>
            </pre>
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
              <p className="text-sm text-muted-foreground leading-6">
                In a real Cargo service, the transport adapter typically holds the AMQP client connection and channel
                setup, then hands owned envelopes or commands into ordinary Rust handlers. Keep the transport edge narrow so
                the retry, idempotency, and serialization logic remains testable without a live broker.
              </p>
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
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Acknowledgments and retries</h4>
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
                  Broker payloads age better when they use an explicit envelope: schema version, message ID, optional trace
                  metadata, and a tagged payload. Keep the wire DTO calmer than the internal aggregate, and prefer additive
                  evolution over field redefinition.
                </p>
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{messageEnvelopeSnippet}</code>
                </pre>
              </div>
              <Button variant="outline" onClick={() => setCurrentPage(36)} className="shrink-0">
                Revisit Chapter 19
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Observability in broker-based systems</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              {observabilityChecklist.map((item) => (
                <div key={item} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Comparison callout</h4>
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
                A broker can decouple services, but it will not decouple you from consistency. It merely changes where the
                consistency work must be done.
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
````

### File: `components/rust-book/pages/page-ch30-amqp-and-message-brokers-exercises.tsx`
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
    title: "Choose the acknowledge point from the real side effect",
    objective: "Practice deciding when a consumer should ack from the true durability boundary instead of from convenience.",
    starterPrompt:
      "A consumer validates a message, writes a database row, emits an integration event, and updates an in-memory cache. Decide where the ack belongs.",
    prompts: [
      "Which step makes the message safe to forget?",
      "Would your answer change if the integration event is written to an outbox table instead of published immediately?",
      "Which failure modes still cause redelivery, and why is that acceptable only if the handler is idempotent?",
    ],
    acceptanceCriteria: [
      "You place the ack after the durable effect or durable checkpoint rather than immediately after receipt.",
      "You explain one case where an outbox write is the real boundary instead of the downstream publish itself.",
      "You describe redelivery as a normal part of the design, not as an impossible edge case.",
    ],
    hints: [
      "Ask when the system can crash without losing already-claimed business work.",
      "Ack placement is a consistency decision before it is a transport detail.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Spot the infinite requeue loop and poison-message bug",
    objective: "Read a consumer path and identify where retries, duplicates, and terminal failure are being modeled dishonestly.",
    starterPrompt:
      "A handler catches every error, calls `nack(requeue = true)`, and has no dedupe key, no retry budget, and no DLQ path.",
    prompts: [
      "Why can one malformed or permanently invalid message now cycle forever?",
      "Which failures deserve retry and which deserve dead-lettering or rejection?",
      "What state would you record to make duplicate delivery harmless after a crash?",
    ],
    acceptanceCriteria: [
      "You explain the poison-message loop concretely.",
      "You separate transient retryable failures from permanent terminal failures.",
      "You propose both an idempotency mechanism and a retry budget or DLQ path.",
    ],
    hints: [
      "A retry loop without a budget is not resilience. It is delayed overload.",
      "The fix needs both transport policy and application state.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Model an idempotent consumer with retries and a DLQ",
    objective: "Implement a small consumer that counts duplicates, retries transient failure, and stops after a bounded attempt count.",
    starterPrompt:
      "Build `Consumer::on_delivery` so successful messages record completion, duplicate messages are counted and ignored, transient failures are retried up to two times, and the final failed attempt moves to a DLQ.",
    prompts: [
      "Keep the dedupe state as a set of completed message IDs.",
      "Increment a retry counter whenever work is requeued locally.",
      "Push terminal failure into a DLQ collection.",
      "Do not use shared mutable global state outside the consumer object.",
    ],
    acceptanceCriteria: [
      "The consumer records successful message IDs and treats later repeats as duplicates.",
      "Retries stop at a visible attempt cap instead of continuing forever.",
      "Terminal failure is isolated in a DLQ structure.",
      "The runnable lab prints the expected processed, duplicate, retry, and DLQ counts.",
    ],
    hints: [
      "Completed-message tracking is the core of the exercise.",
      "The cleanest design keeps the retry queue and counters inside one owner.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Refactor retry and dead-letter handling into one visible policy",
    objective: "Move retry count, classification, and terminal routing out of scattered handler branches and into one reviewable layer.",
    starterPrompt:
      "You inherit three consumers with ad hoc retry logic copied into each one. Refactor the design so failure classification and retry budgeting live in one visible policy module or component.",
    prompts: [
      "Which facts should the shared policy own: max attempts, retryable error classes, terminal error classes?",
      "Where should the consumer-specific business logic end and the transport retry policy begin?",
      "How would you keep the policy testable without a live broker?",
    ],
    acceptanceCriteria: [
      "You centralize at least retry classification and max-attempt policy.",
      "You keep business handling separate from transport-level retry bookkeeping.",
      "You describe one testing strategy such as table-driven failure classification or DLQ routing tests.",
    ],
    hints: [
      "If three handlers copied the same retry rules, the rules probably want one home.",
      "A policy object or small module is often enough.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Design message serialization for schema evolution",
    objective: "Model an AMQP message envelope that can evolve without forcing one big-bang rollout.",
    starterPrompt:
      "You currently publish `{ order_id, total_cents }` and now want to add `trace_id` plus an optional `source` field while keeping old readers alive.",
    prompts: [
      "Which fields belong in a stable envelope versus in the payload?",
      "How will you mark schema version and message kind explicitly?",
      "Which fields should use defaults or optional semantics?",
      "What compatibility test would you add before rollout?",
    ],
    acceptanceCriteria: [
      "You define a versioned envelope or equivalent explicit contract boundary.",
      "You use optionality or defaults for an additive field instead of redefining an old field in place.",
      "You mention at least one golden-payload or mixed-version compatibility test.",
    ],
    hints: [
      "Additive evolution is usually calmer than reinterpretation.",
      "Keep the wire DTO narrower than the internal aggregate when their evolution pressure differs.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose topology, backpressure, and observability for a brokered service",
    objective: "Make the full production design explicit: routing, prefetch, local queue budgets, retries, and metrics.",
    starterPrompt:
      "You are designing `checkout -> billing -> search -> notification` over RabbitMQ, with bursty order creation, one occasionally slow downstream dependency, and strict operator requirements around poison-message isolation.",
    prompts: [
      "Which exchange and routing-key shape keeps publisher code simple while letting consumers subscribe selectively?",
      "Which queues deserve their own DLQ rather than one giant shared terminal queue?",
      "What prefetch and local worker budget would you choose to stop one consumer from hoarding unacked work?",
      "Which metrics and alarms would you require before rollout?",
    ],
    acceptanceCriteria: [
      "You choose a plausible topology and routing-key strategy with a reason tied to consumer boundaries.",
      "You isolate poison-message handling with at least one explicit DLQ design choice.",
      "You define both broker-side and local backpressure limits.",
      "You mention at least three observability hooks such as queue age, retry rate, DLQ rate, confirm latency, or dedupe-hit rate.",
    ],
    hints: [
      "One queue per everything is as unhelpful as one queue for everything.",
      "Backpressure needs a budget at both the broker and consumer layers.",
    ],
  },
]

const reviewQuestions = [
  "Why is at-least-once delivery the sane default assumption for AMQP consumer design?",
  "What does a dead-letter queue solve that endless requeue does not solve?",
  "Why should idempotency be treated as a first-class domain concern instead of a broker trick?",
  "What is the difference between broker prefetch and a bounded in-process worker queue?",
  "Why is a versioned envelope calmer than redefining an old message field in place?",
]

const workingLoop = [
  "Name the durable side effect first, then place the ack after it.",
  "Decide which failures are transient and which are terminal before writing retry code.",
  "Add a dedupe key before you trust redelivery behavior.",
  "Make queue budgets and DLQ policy visible in configuration, tests, and metrics.",
]

export function PageCh30AmqpAndMessageBrokersExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = 59
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 30 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice AMQP design the way it behaves in production: explicit ack timing, idempotent consumers, bounded retry,
          DLQ policy, schema evolution, and queue budgets that another engineer can review quickly.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a delivery-contract review. The strongest answer explains where the ack belongs, who
                owns retry policy, how poison messages stop circulating, and what state makes duplicates harmless.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(58)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 30
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
                  Broker design drill
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
          title="Runnable lab · Idempotent consumer with retry and DLQ"
          description={
            <>
              Repair the starter so successful messages record completion, duplicates are counted once, transient failure
              retries only up to attempt <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">3</code>, and
              the final failed attempt lands in the DLQ. The checker expects the exact counters below.
            </>
          }
          filename="idempotent_consumer_lab.rs"
          runKey="ch30_ex_idempotent_consumer"
          expectedOutput={"processed = 2\nduplicates = 1\nretried = 2\ndlq = 1"}
          helperText={
            <>
              Tip: add the duplicate guard first, then record successful IDs, then cap retries with a terminal DLQ path.
              The whole point is that replay becomes safe and poison messages stop circulating.
            </>
          }
          initialCode={`use std::collections::{HashSet, VecDeque};

#[derive(Debug, Clone)]
struct Delivery {
    message_id: &'static str,
    order_id: &'static str,
    attempt: u8,
}

#[derive(Default)]
struct Consumer {
    processed_ids: HashSet<String>,
    retry_queue: VecDeque<Delivery>,
    dlq: Vec<Delivery>,
    processed: usize,
    duplicates: usize,
    retried: usize,
}

impl Consumer {
    fn on_delivery(&mut self, delivery: Delivery) {
        if delivery.order_id == "ord-fail" {
            self.retry_queue.push_back(Delivery {
                attempt: delivery.attempt + 1,
                ..delivery
            });
            return;
        }

        self.processed += 1;
    }
}

fn main() {
    let mut consumer = Consumer::default();

    consumer.on_delivery(Delivery {
        message_id: "msg-1",
        order_id: "ord-1",
        attempt: 1,
    });
    consumer.on_delivery(Delivery {
        message_id: "msg-1",
        order_id: "ord-1",
        attempt: 1,
    });
    consumer.on_delivery(Delivery {
        message_id: "msg-2",
        order_id: "ord-fail",
        attempt: 1,
    });

    let mut spins = 0;
    while let Some(delivery) = consumer.retry_queue.pop_front() {
        spins += 1;
        if spins > 8 {
            break;
        }
        consumer.on_delivery(delivery);
    }

    consumer.on_delivery(Delivery {
        message_id: "msg-3",
        order_id: "ord-3",
        attempt: 1,
    });

    println!("processed = {}", consumer.processed);
    println!("duplicates = {}", consumer.duplicates);
    println!("retried = {}", consumer.retried);
    println!("dlq = {}", consumer.dlq.len());
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
            By the end of this page, you should be able to explain ack timing from the durable side effect, build a small
            idempotent consumer, distinguish retryable from terminal failure, and evolve a message contract without
            hand-waving about mixed producers and consumers.
          </p>
        </section>
      </div>
    </div>
  )
}
````

### File: `examples/ch30_amqp_and_message_brokers/direct_exchange_routing.rs`
````
use std::collections::HashMap;

#[derive(Debug, Default)]
struct DirectExchange {
    bindings: HashMap<String, Vec<String>>,
}

impl DirectExchange {
    fn bind(&mut self, routing_key: &str, queue: &str) {
        self.bindings
            .entry(routing_key.to_string())
            .or_default()
            .push(queue.to_string());
    }

    fn route(&self, routing_key: &str) -> Vec<String> {
        self.bindings
            .get(routing_key)
            .cloned()
            .unwrap_or_default()
    }
}

fn main() {
    let mut exchange = DirectExchange::default();

    exchange.bind("orders.created", "billing");
    exchange.bind("orders.created", "search");
    exchange.bind("orders.cancelled", "billing");

    let created = exchange.route("orders.created");
    let cancelled = exchange.route("orders.cancelled");

    println!("created = {}", created.join(","));
    println!("cancelled = {}", cancelled.join(","));
    println!("unrouted = {}", exchange.route("orders.refunded").len());
}
````

### File: `examples/ch30_amqp_and_message_brokers/idempotent_consumer_retry_dlq.rs`
````
use std::collections::{HashSet, VecDeque};

#[derive(Debug, Clone)]
struct Delivery {
    message_id: &'static str,
    order_id: &'static str,
    attempt: u8,
}

#[derive(Default)]
struct Consumer {
    processed_ids: HashSet<String>,
    retry_queue: VecDeque<Delivery>,
    dlq: Vec<Delivery>,
    processed: usize,
    duplicates: usize,
    retried: usize,
}

impl Consumer {
    fn on_delivery(&mut self, delivery: Delivery) {
        if self.processed_ids.contains(delivery.message_id) {
            self.duplicates += 1;
            return;
        }

        if delivery.order_id == "ord-fail" {
            if delivery.attempt < 3 {
                self.retried += 1;
                self.retry_queue.push_back(Delivery {
                    attempt: delivery.attempt + 1,
                    ..delivery
                });
            } else {
                self.dlq.push(delivery);
            }
            return;
        }

        self.processed += 1;
        self.processed_ids.insert(delivery.message_id.to_string());
    }
}

fn main() {
    let mut consumer = Consumer::default();

    consumer.on_delivery(Delivery {
        message_id: "msg-1",
        order_id: "ord-1",
        attempt: 1,
    });
    consumer.on_delivery(Delivery {
        message_id: "msg-1",
        order_id: "ord-1",
        attempt: 1,
    });
    consumer.on_delivery(Delivery {
        message_id: "msg-2",
        order_id: "ord-fail",
        attempt: 1,
    });

    while let Some(delivery) = consumer.retry_queue.pop_front() {
        consumer.on_delivery(delivery);
    }

    consumer.on_delivery(Delivery {
        message_id: "msg-3",
        order_id: "ord-3",
        attempt: 1,
    });

    println!("processed = {}", consumer.processed);
    println!("duplicates = {}", consumer.duplicates);
    println!("retried = {}", consumer.retried);
    println!("dlq = {}", consumer.dlq.len());
}
````

### File: `examples/ch30_amqp_and_message_brokers/message_envelope_versioning.rs`
````
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum OrderEvent {
    Created {
        order_id: String,
        total_cents: u64,
    },
    Cancelled {
        order_id: String,
        reason: Option<String>,
    },
}

#[derive(Debug, Serialize, Deserialize)]
struct MessageEnvelope<T> {
    schema_version: u16,
    message_id: String,
    #[serde(default)]
    trace_id: Option<String>,
    payload: T,
}

fn main() {
    let envelope = MessageEnvelope {
        schema_version: 2,
        message_id: String::from("msg-100"),
        trace_id: Some(String::from("trace-9")),
        payload: OrderEvent::Created {
            order_id: String::from("ord-7"),
            total_cents: 4200,
        },
    };

    let json = serde_json::to_string(&envelope).unwrap();
    let decoded: MessageEnvelope<OrderEvent> = serde_json::from_str(&json).unwrap();

    let kind = match &decoded.payload {
        OrderEvent::Created { .. } => "created",
        OrderEvent::Cancelled { .. } => "cancelled",
    };

    println!("version = {}", decoded.schema_version);
    println!("kind = {}", kind);
}
````

### File: `components/rust-book/pages/index.ts`
````diff
--- components/rust-book/pages/index.ts
+++ components/rust-book/pages/index.ts
@@ -56,3 +56,5 @@ export { PageCh28CppIntegration } from "./page-ch28-cpp-integration"
 export { PageCh28CppIntegrationExercises } from "./page-ch28-cpp-integration-exercises"
 export { PageCh29JsAndCppIntegrationForWasm } from "./page-ch29-js-and-cpp-integration-for-wasm"
 export { PageCh29JsAndCppIntegrationForWasmExercises } from "./page-ch29-js-and-cpp-integration-for-wasm-exercises"
+export { PageCh30AmqpAndMessageBrokers } from "./page-ch30-amqp-and-message-brokers"
+export { PageCh30AmqpAndMessageBrokersExercises } from "./page-ch30-amqp-and-message-brokers-exercises"
````

### File: `components/rust-book/index.tsx`
````diff
--- components/rust-book/index.tsx
+++ components/rust-book/index.tsx
@@ -67,6 +67,8 @@ import {
   PageCh28CppIntegrationExercises,
   PageCh29JsAndCppIntegrationForWasm,
   PageCh29JsAndCppIntegrationForWasmExercises,
+  PageCh30AmqpAndMessageBrokers,
+  PageCh30AmqpAndMessageBrokersExercises,
 } from "./pages"
 
 const PAGE_COMPONENTS = [
@@ -128,6 +130,8 @@ const PAGE_COMPONENTS = [
   PageCh28CppIntegrationExercises,
   PageCh29JsAndCppIntegrationForWasm,
   PageCh29JsAndCppIntegrationForWasmExercises,
+  PageCh30AmqpAndMessageBrokers,
+  PageCh30AmqpAndMessageBrokersExercises,
 ]
 
 function BookContent() {
````

### File: `components/rust-book/rust-simulator.ts`
````diff
--- components/rust-book/rust-simulator.ts
+++ components/rust-book/rust-simulator.ts
@@ -1,3 +1,4 @@
+import { simulateCh30Output } from "./rust-simulator-ch30"
 import { simulateCh29Output } from "./rust-simulator-ch29"
 import { simulateCh28Output } from "./rust-simulator-ch28"
 import { simulateCh27Output } from "./rust-simulator-ch27"
@@ -1007,6 +1008,9 @@ function findCompilationError(code: string, filename: string): string | null {
 export function simulateRustExecution(code: string, key?: string, filename = "main.rs"): string {
   const compilationError = findCompilationError(code, filename)
   if (compilationError) return compilationError
+
+  const ch30Output = simulateCh30Output(code, key)
+  if (ch30Output !== null) return ch30Output
 
   const ch29Output = simulateCh29Output(code, key)
   if (ch29Output !== null) return ch29Output
````

### File: `components/rust-book/types.ts`
````diff
--- components/rust-book/types.ts
+++ components/rust-book/types.ts
@@ -19,6 +19,7 @@ import { DEFAULT_CODES_CH26 } from "./default-codes-ch26"
 import { DEFAULT_CODES_CH27 } from "./default-codes-ch27"
 import { DEFAULT_CODES_CH28 } from "./default-codes-ch28"
 import { DEFAULT_CODES_CH29 } from "./default-codes-ch29"
+import { DEFAULT_CODES_CH30 } from "./default-codes-ch30"
 
 export interface PageConfig {
   id: string
@@ -734,6 +735,29 @@ export const CHAPTERS: ChapterConfig[] = [
         description:
           "Export Rust to JavaScript with wasm-bindgen, choose serialization and memory boundaries, and reason about JS/WASM copying costs",
         icon: "trophy",
+      },
+    ],
+  },
+  {
+    id: "ch30-amqp-and-message-brokers",
+    title: "Chapter 30 · AMQP and Message Brokers",
+    icon: "book",
+    pages: [
+      {
+        id: "ch30-amqp-and-message-brokers",
+        title: "AMQP and Message Brokers",
+        shortTitle: "AMQP and Brokers",
+        description:
+          "Broker fundamentals, AMQP exchanges and queues, RabbitMQ with Rust, acknowledgments, retries, dead-letter queues, idempotency, backpressure, serialization, and observability",
+        icon: "book",
+        codeKeys: ["amqp_direct_exchange_routing", "amqp_idempotent_consumer"],
+      },
+      {
+        id: "ch30-amqp-and-message-brokers-exercises",
+        title: "Chapter 30 Exercises",
+        shortTitle: "Exercises",
+        description:
+          "Model an idempotent consumer, add retry and dead-letter handling, and design versioned message contracts",
+        icon: "trophy",
       },
     ],
   },
@@ -1181,6 +1205,7 @@ export const DEFAULT_CODES: Record<string, string> = {
   ...DEFAULT_CODES_CH27,
   ...DEFAULT_CODES_CH28,
   ...DEFAULT_CODES_CH29,
+  ...DEFAULT_CODES_CH30,
 }
 
 export interface BookState {
````