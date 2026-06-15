"use client"

// Chapter 30 · exercise workbook page (ch30-amqp-and-message-brokers-exercises).
// Exercise data consumed by the workbook PDF builder
// (exports/extract_chapter_prose.py reads the const blocks and the
// RustPracticeCard below). Not yet wired into app navigation; wiring
// requires lockstep edits to types.ts / index.ts / index.tsx.
// Intended component name: PageCh30AmqpAndMessageBrokersExercises

export {}

/*
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
    title: "Separate routing-key choice from routing policy",
    objective: "Explain who owns each decision in the publish path so the producer stays decoupled from queue topology.",
    starterPrompt: "The chapter insists that a producer publishes to an exchange with a routing key such as orders.created and never names a queue, while the exchange owns bindings and decides which queues receive a copy. Describe this split in your own words.",
    prompts: [
      "State what the producer controls and what the exchange controls when a message is published.",
      "Explain why a new team can add a search-indexing queue for orders.created without editing any publisher.",
      "Describe what happens to a message whose routing key matches no binding, and why that is counted rather than silently dropped.",
    ],
    acceptanceCriteria: [
      "The answer says the producer chooses only the routing key and the exchange owns binding state and routing policy.",
      "The answer explains that adding a binding for an existing key reaches new queues without changing the producer.",
      "The answer states that an unbound key produces zero deliveries and is tracked as unrouted, not delivered anywhere.",
    ],
    hints: [
      "Reread the line that a producer never names a queue; it publishes to an exchange with a routing key.",
      "The exchange is the one place routing topology lives, so publishers do not need to be queue-aware.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Trace the idempotent consumer's decision machine",
    objective: "Predict the processed, duplicate, retried, and dead-letter counts by reading the on_delivery state transitions.",
    starterPrompt: "Read the Consumer type from Example 2, whose on_delivery first checks processed_ids, then routes a delivery for order ord-fail through a bounded retry, and finally records successful unique work. Hand-trace the four messages that main feeds it, including the retry-queue drain loop.",
    prompts: [
      "Walk through msg-1 sent twice and say which branch each delivery takes.",
      "Follow msg-2 with order_id ord-fail through every attempt until the drain loop empties the retry_queue, and say where it lands.",
      "State the final values of processed, duplicates, retried, and dlq printed by main.",
    ],
    acceptanceCriteria: [
      "The trace identifies the second msg-1 as a duplicate that is counted and returns without redoing the work.",
      "The trace shows ord-fail being retried at attempts 1 and 2, then moved to the DLQ once attempt reaches 3.",
      "The predicted output is processed = 2, duplicates = 1, retried = 2, dlq = 1.",
    ],
    hints: [
      "A successful unique delivery is the only path that inserts into processed_ids and increments processed.",
      "The retry branch fires only while attempt is below 3; the third arrival of ord-fail takes the dlq branch.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Add a wildcard topic match to the exchange",
    objective: "Extend the routing lookup so a single binding pattern can match a family of routing keys.",
    starterPrompt: "Starting from DirectExchange in Example 1, add a method that supports a single trailing wildcard segment, so binding orders.* reaches a queue for both orders.created and orders.cancelled. Keep the exact-match route method working unchanged.",
    prompts: [
      "Decide how to store wildcard bindings so an exact lookup is still cheap.",
      "Implement matching by splitting the routing key on '.' and comparing segments, treating '*' as matching exactly one segment.",
      "Return the union of exact-match queues and wildcard-match queues, with no duplicate queue names.",
    ],
    acceptanceCriteria: [
      "Binding orders.* to a queue makes that queue appear for both orders.created and orders.cancelled.",
      "An exact binding such as orders.created to billing still resolves through the unchanged route path.",
      "A routing key matching both an exact binding and a wildcard binding lists each target queue only once.",
      "A key matching no binding still returns an empty Vec<String>.",
    ],
    hints: [
      "Split on '.' and compare segment by segment; '*' covers exactly one segment, not several.",
      "Collect results into a structure that rejects duplicates, or check membership before pushing.",
    ],
  },
  {
    number: 4,
    kind: "implementation",
    title: "Make the consumer ack only after the durable effect",
    objective: "Encode the commit-then-ack ordering so a crash between the two cannot lose acknowledged work.",
    starterPrompt: "Model a consumer with a durable store (a Vec or HashMap standing in for the database) and an explicit ack list. Implement handle so it writes the durable effect first and only then records the ack, mirroring the chapter's rule that an ack promises the work is safely done.",
    prompts: [
      "Define functions for the durable write and for sending the ack as two separate steps.",
      "Order them so the durable effect is committed before the ack is recorded.",
      "Add a duplicate guard so re-handling an already-committed message id acks without writing twice.",
      "Describe what the broker does to a message that was committed but crashed before the ack.",
    ],
    acceptanceCriteria: [
      "The code commits the durable effect strictly before appending to the ack list.",
      "A message id already present in the durable store is acked again without a second write.",
      "The answer explains that a crash after commit but before ack yields a redelivery, which the idempotency guard absorbs.",
      "No code path records an ack for a message whose durable effect was not committed.",
    ],
    hints: [
      "An ack is a promise the work is safely done and the broker may forget the message.",
      "At-least-once delivery means commit-then-crash is a redelivery, so the handler must tolerate seeing the id again.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Fix an ack-before-commit consumer",
    objective: "Diagnose and correct a consumer that loses work by acknowledging before its side effect is durable.",
    starterPrompt: "A consumer acks the broker first and then performs the durable write, and it also retries malformed payloads forever. Identify both defects against the chapter's guidance and refactor the handler.",
    prompts: [
      "Explain the data-loss window created when ack happens before the durable commit.",
      "Reorder the steps so the durable effect is committed before the ack.",
      "Replace the unbounded retry with a bounded attempt count that sends terminal failures to a DLQ.",
      "Distinguish which failures deserve a retry and which should go straight to the dead-letter queue.",
    ],
    acceptanceCriteria: [
      "The diagnosis names ack-before-commit as the cause of silently lost work on a mid-handler crash.",
      "The refactor commits the durable effect before sending the ack.",
      "Retries become counted and bounded, and a message exceeding the cap is routed to a DLQ.",
      "A malformed or unsupported payload is sent to the DLQ instead of being retried, since it fails identically every time.",
    ],
    hints: [
      "If the consumer acks first and then crashes before the durable effect, the broker has already forgotten the message.",
      "Requeuing a message that can never succeed just blocks the queue behind it; that is what the DLQ is for.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Design a versioned envelope for mixed deployments",
    objective: "Specify a message contract and consumer policy that survive replay across deploys and version skew.",
    starterPrompt: "The order pipeline must let a message sit in a queue across a deploy, be replayed weeks later, and be consumed by a service running an older version. Design the envelope and the consumer rules that keep this safe, building on the chapter's idempotency and DLQ work.",
    prompts: [
      "List the envelope fields that travel alongside the payload, including a schema version and a stable message id.",
      "Specify how a consumer handles a version it does not recognize without blocking the queue.",
      "State how the message id ties into idempotency so replay is harmless.",
      "Name the queue-health signals you would expose so a pile-up does not stay invisible.",
    ],
    acceptanceCriteria: [
      "The envelope carries an explicit schema version, a stable unique message id, and the payload, rather than a bare struct dump.",
      "The design keeps the message id as the idempotency key so duplicate or replayed deliveries are deduplicated, not reprocessed.",
      "An unrecognized version is routed to a DLQ or held for a newer consumer rather than crashing or blocking the queue.",
      "The answer lists at least queue depth, message age, retry rate, and dead-letter count as the minimum health signals.",
    ],
    hints: [
      "A message often outlives the code that produced it, so the version belongs in the envelope, not in tribal knowledge.",
      "A broker is a place work can pile up invisibly; depth, age, retry rate, and DLQ count are what reveal it.",
    ],
  },
]

const reviewQuestions = [
  "In the publish path, which decisions belong to the producer and which belong to the exchange, and why does that split let teams change routing topology without editing publishers?",
  "Why must a consumer commit its durable side effect before sending the ack, and what does the broker do with a message that stays unacknowledged?",
  "Since AMQP delivery is at-least-once, what does it mean for a handler to be idempotent, and how does a recorded message id make replay harmless?",
  "When should a failed message be retried versus sent to a dead-letter queue, and what goes wrong if a poison message is requeued forever?",
  "What does backpressure protect against in a broker-based system, and which signals tell you a queue is piling up rather than merely quiet?",
]

const workingLoop = [
  "Restate the exercise goal in terms of ownership, types, and the chapter's core idea.",
  "Write the smallest version that compiles, then make it correct.",
  "Check each acceptance criterion explicitly before moving on.",
  "Name one tradeoff or failure mode your solution accepts.",
]

<RustPracticeCard
  title={"Runnable lab · direct exchange routing with an unrouted counter"}
  filename="direct_exchange_routing_lab.rs"
  runKey="ch30_ex_routing"
  expectedOutput={"orders.created -> billing,search\norders.cancelled -> billing\nunrouted total = 2"}
  helperText={"Model the chapter's direct exchange: producers publish a routing key, the exchange owns bindings, and a key with no binding is counted as unrouted instead of vanishing. Fill in route so it returns the bound queues for a key and bumps the unrouted counter when nothing matches."}
  initialCode={`use std::collections::HashMap;

#[derive(Default)]
struct DirectExchange {
    bindings: HashMap<String, Vec<String>>,
    unrouted: usize,
}

impl DirectExchange {
    fn bind(&mut self, routing_key: &str, queue: &str) {
        self.bindings
            .entry(routing_key.to_string())
            .or_default()
            .push(queue.to_string());
    }

    fn route(&mut self, routing_key: &str) -> Vec<String> {
        // TODO: return the queues bound to routing_key.
        // If the key has no binding, increment self.unrouted and return an empty Vec.
        Vec::new()
    }
}

fn main() {
    let mut exchange = DirectExchange::default();
    exchange.bind("orders.created", "billing");
    exchange.bind("orders.created", "search");
    exchange.bind("orders.cancelled", "billing");

    let created = exchange.route("orders.created");
    let cancelled = exchange.route("orders.cancelled");
    let _ = exchange.route("orders.refunded");
    let _ = exchange.route("orders.archived");

    println!("orders.created -> {}", created.join(","));
    println!("orders.cancelled -> {}", cancelled.join(","));
    println!("unrouted total = {}", exchange.unrouted);
}`}
/>
*/
