"use client"

// Chapter 25 · exercise workbook page (ch25-tokio-exercises).
// Exercise data consumed by the workbook PDF builder
// (exports/extract_chapter_prose.py reads the const blocks and the
// RustPracticeCard below). Not yet wired into app navigation; wiring
// requires lockstep edits to types.ts / index.ts / index.tsx.
// Intended component name: PageCh25TokioExercises

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
    title: "Place each stage on the right Tokio surface",
    objective: "Decide whether a unit of work belongs inline, on tokio::spawn, or on spawn_blocking, and explain why.",
    starterPrompt: "The chapter's ingress service has four stages: awaiting a TCP read, summing a batch of u32 values, ticking a time::interval, and reading a filesystem snapshot. Classify each one against the chapter's decision tree.",
    prompts: [
      "For each stage, say whether it mostly waits on IO or mostly computes.",
      "Map each stage to one of: stays inline, goes to tokio::spawn, or goes to spawn_blocking.",
      "Explain what specifically goes wrong if the CPU sum is left on an IO worker.",
      "State why the interval is a runtime wakeup rather than a background thread or a busy loop.",
    ],
    acceptanceCriteria: [
      "The TCP read and the interval tick are identified as waiting work that stays on the async workers, not blocking work.",
      "The u32 sum is identified as CPU-heavy work that belongs on spawn_blocking, and the filesystem snapshot is identified as blocking work that also belongs on the blocking pool.",
      "The answer states that CPU work left on an IO worker monopolizes that worker between await points and stalls unrelated tasks.",
      "The answer notes that time::interval is driven by the timer driver as a wakeup, so it consumes no thread while idle.",
    ],
    hints: [
      "The chapter's rule: work that mostly waits stays inline or on tokio::spawn; work that mostly computes goes to spawn_blocking.",
      "A task that never reaches an await point holds its worker thread for the whole computation.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Trace the accept loop's select! race",
    objective: "Read the graceful-shutdown accept loop and predict how a normal accept and a shutdown signal each flow through the same select!.",
    starterPrompt: "Study Example 2's server task. Each loop turn is a single select! with two branches: `changed = shutdown_rx.changed() => { if changed.is_err() || *shutdown_rx.borrow() { break accepted; } }` and `result = listener.accept() => { match result { Ok((stream, _peer)) => { accepted += 1; tokio::spawn(handle(stream)); } Err(_e) => break accepted, } }`. Walk through both branches without running the code.",
    prompts: [
      "Describe what the accept branch does when listener.accept() resolves with Ok((stream, _peer)).",
      "Explain why the shutdown branch checks both changed.is_err() and *shutdown_rx.borrow().",
      "State what value the server task breaks with, and what the printed accepted count means.",
      "Explain why per-connection work is handled with tokio::spawn(handle(stream)) rather than awaited inline in the loop.",
    ],
    acceptanceCriteria: [
      "The reader explains that the accept branch increments accepted and spawns a separate task to handle the connection, keeping admission in the listener.",
      "The reader explains that changed() resolving with an error means every sender was dropped, and borrow() re-checks because a watch can carry values other than the stop sentinel.",
      "The reader states the loop breaks with the accepted count and that this count reflects connections admitted before the stop signal won the race.",
      "The reader explains that spawning the handler keeps the accept loop free to race the next connection against the stop signal instead of blocking on one client.",
    ],
    hints: [
      "select! evaluates both branches each turn and proceeds with whichever future resolves first.",
      "A dropped watch sender and an explicit send(true) both need to be treated as 'stop' by the shutdown branch.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Bound the producer with a capacity-one channel",
    objective: "Use a bounded mpsc to turn an unbounded producer into one that paces itself against the consumer.",
    starterPrompt: "Starting from Example 1's shape, write an async producer and consumer connected by mpsc::channel::<Vec<u32>>(1) so that a full queue makes the producer's send().await suspend until the consumer drains an item.",
    prompts: [
      "Create the channel with an explicit capacity of 1 and move tx into the producer task.",
      "Have the producer send two Vec<u32> batches with send().await and unwrap the results.",
      "In the consumer, create a time::interval and call tick().await once per received batch, and offload the per-batch sum to spawn_blocking.",
      "Return (batches, total) from the consumer and print buffer, batches, and total.",
    ],
    acceptanceCriteria: [
      "The channel is constructed with capacity 1 so the second send().await cannot complete until the consumer has received the first batch.",
      "The CPU sum runs inside tokio::task::spawn_blocking and its result is awaited, not computed on the async worker.",
      "The consumer's recv() loop ends when the producer drops tx, after which the consumer returns its accumulated (batches, total).",
      "The program prints batches = 2 and total = 15 for the batches [1,2,3] and [4,5].",
    ],
    hints: [
      "send on a full bounded channel does not error; it awaits until there is room.",
      "The recv loop terminates naturally once every sender handle has been dropped.",
    ],
  },
  {
    number: 4,
    kind: "implementation",
    title: "Add a watch-based stop signal to an accept loop",
    objective: "Wire a watch channel and select! into a server task so the accept loop drains cleanly on a stop signal.",
    starterPrompt: "Given a bound TcpListener, write a server task that loops over tokio::select! racing a watch shutdown receiver against listener.accept(), and have the outer code send the stop signal after its clients finish.",
    prompts: [
      "Create the signal with watch::channel(false) and move the receiver into the server task.",
      "In each loop turn, select! over shutdown_rx.changed() and listener.accept().",
      "On the accept branch, count the connection and spawn the handler; on the shutdown branch, break out of the loop.",
      "After the clients complete, call shutdown_tx.send(true) and await the server task to recover the accepted count.",
    ],
    acceptanceCriteria: [
      "The server task owns the listener and the watch receiver, and the loop body is a single tokio::select! over the two branches.",
      "The shutdown branch breaks on either a changed() error or a true value read through borrow(), and the accept branch spawns connection handling separately.",
      "The outer code sends the stop signal exactly once after its work is done, then awaits the server handle.",
      "The accepted count returned by the server task equals the number of connections admitted before the stop signal won the race.",
    ],
    hints: [
      "watch::channel returns a (Sender, Receiver); the receiver's changed() future completes when the value is updated or all senders drop.",
      "Breaking out of the loop with a value lets the spawned task's JoinHandle yield the accepted count.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Stop a CPU stage from starving the IO workers",
    objective: "Diagnose and fix a service that runs CPU-heavy work directly on a Tokio worker thread.",
    starterPrompt: "A consumer task receives batches over a channel and computes a sum with batch.into_iter().sum() directly inline, then awaits the next item; under load the whole service goes mysteriously slow even though every individual operation looks cheap. Refactor it.",
    prompts: [
      "Identify why running the sum inline holds the worker thread across what should be an await point.",
      "Explain how this interacts with the multithread runtime stealing work across the pool.",
      "Refactor the sum to run behind tokio::task::spawn_blocking and await its JoinHandle.",
      "Argue why simply calling tokio::spawn on the sum would not fix the underlying problem.",
    ],
    acceptanceCriteria: [
      "The diagnosis states that the inline sum runs on an IO worker with no intervening await, so that worker cannot service other ready tasks until it finishes.",
      "The fix moves the CPU step to spawn_blocking and awaits its result, keeping the async workers free for waiting work.",
      "The answer explains that tokio::spawn still schedules the CPU work onto the same IO worker pool, where it runs without an await point and holds its worker for the full duration of the sum, so it does not isolate the CPU cost.",
      "The refactored consumer preserves the original output, computing the same totals as before.",
    ],
    hints: [
      "The chapter calls putting CPU work on IO workers the single most common way to make a Tokio service slow.",
      "spawn_blocking moves work onto a dedicated blocking pool; tokio::spawn does not.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Design backpressure and shutdown for an ingress service",
    objective: "Specify the queue bounds, task ownership, and cancellation policy for a Tokio service so capacity is explicit rather than emergent.",
    starterPrompt: "Design the runtime shape for the chapter's ingress service: it accepts TCP traffic, sends owned jobs through an internal queue to a processing stage, reads filesystem snapshots, and must shut down without losing in-flight work.",
    prompts: [
      "Decide between the multithread and current-thread runtime for this service and justify the choice.",
      "Specify where bounded channels sit and what a full queue should do to the upstream producer.",
      "Describe the shutdown sequence using a watch signal and select! so the accept loop stops admitting and drains in-flight work.",
      "State which stages move to spawn_blocking and why spawning more tasks is not a substitute for concurrency control.",
    ],
    acceptanceCriteria: [
      "The design chooses the multithread runtime for a Send-task service and explains the work-stealing benefit, or justifies current-thread for a small or non-Send case.",
      "Internal queues are bounded so a full queue makes send await and pushes backpressure upstream, with capacity stated as an explicit policy.",
      "The shutdown plan races a watch stop signal against accept in a select!, stops admission first, then lets spawned connection tasks finish before exit.",
      "The CPU-heavy and filesystem stages are placed on the blocking pool, and the design notes that spawning faster than downstream finishes is queue growth, not throughput.",
    ],
    hints: [
      "Bounding the queue makes the slowdown policy explicit instead of discovering it later from a memory graph.",
      "Separating connection tasks from listener ownership keeps admission, draining, and metrics easy to reason about.",
    ],
  },
]

const reviewQuestions = [
  "What are the four moving parts the #[tokio::main] macro hides, and how do the IO driver and timer driver keep the scheduler from blocking on IO or time?",
  "When should a service use the multithread runtime versus the current-thread runtime, and what does work-stealing buy a Send-task workload?",
  "Why does a bounded mpsc with an explicit capacity provide backpressure, and what does send().await do when the channel is full?",
  "What distinguishes work that belongs on tokio::spawn from work that belongs on spawn_blocking, and what happens when CPU-heavy work runs on an IO worker?",
  "In the graceful-shutdown accept loop, why does the shutdown branch treat both a changed() error and a true watch value as a stop, and why is per-connection work spawned rather than awaited inline?",
]

const workingLoop = [
  "Restate the exercise goal in terms of ownership, types, and the chapter's core idea.",
  "Write the smallest version that compiles, then make it correct.",
  "Check each acceptance criterion explicitly before moving on.",
  "Name one tradeoff or failure mode your solution accepts.",
]

<RustPracticeCard
  title={"Runnable lab · bounded-queue backpressure with an isolated CPU stage"}
  filename="bounded_queue_backpressure_lab.rs"
  runKey="ch25_ex_backpressure"
  expectedOutput={"buffer = 1\nbatches = 2\ntotal = 15"}
  helperText={"This models Example 1's pipeline in plain std: a capacity-1 sync_channel couples producer and consumer, and the per-batch sum stands in for the chapter's spawn_blocking CPU step. Fill in cpu_subtotal so the totals are correct."}
  initialCode={`use std::sync::mpsc::sync_channel;
use std::thread;

fn cpu_subtotal(batch: Vec<u32>) -> u32 {
    // TODO: sum the batch and return the subtotal.
    // This stands in for the chapter's spawn_blocking CPU step,
    // which must not run on an async worker.
    let _ = batch;
    0
}

fn main() {
    // A capacity of one couples producer and consumer: the second
    // send cannot complete until the consumer has taken the first batch.
    let capacity = 1;
    let (tx, rx) = sync_channel::<Vec<u32>>(capacity);

    let producer = thread::spawn(move || {
        tx.send(vec![1_u32, 2, 3]).unwrap();
        tx.send(vec![4_u32, 5]).unwrap();
    });

    let consumer = thread::spawn(move || {
        let mut batches = 0_u32;
        let mut total = 0_u32;
        while let Ok(batch) = rx.recv() {
            let subtotal = cpu_subtotal(batch);
            total += subtotal;
            batches += 1;
        }
        (batches, total)
    });

    producer.join().unwrap();
    let (batches, total) = consumer.join().unwrap();

    println!("buffer = {}", capacity);
    println!("batches = {}", batches);
    println!("total = {}", total);
}
`}
/>
*/
