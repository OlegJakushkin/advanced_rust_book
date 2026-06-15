"use client"

// Chapter 24 · exercise workbook page (ch24-coroutines-futures-and-async-rust-exercises).
// Exercise data consumed by the workbook PDF builder
// (exports/extract_chapter_prose.py reads the const blocks and the
// RustPracticeCard below). Not yet wired into app navigation; wiring
// requires lockstep edits to types.ts / index.ts / index.tsx.
// Intended component name: PageCh24CoroutinesFuturesAndAsyncRustExercises

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
    title: "Explain what calling an async fn actually does",
    objective: "Confirm the chapter's core claim that an async function produces an inert value and starts no work until an executor polls it.",
    starterPrompt: "Using build_label from Example 1, describe in plain prose what happens between the moment build_label(\"billing\", \"/ready\") is called and the moment block_on returns the finished String.",
    prompts: [
      "State what type the call expression produces before any .await runs.",
      "Identify which component drives the future forward and what method it calls.",
      "Explain why no OS thread is blocked while the future reports Poll::Pending.",
      "Name the two roles a runtime splits into and which one block_on stands in for here.",
    ],
    acceptanceCriteria: [
      "The answer states that calling build_label constructs a future value and runs none of its body yet.",
      "The answer identifies poll as the only way the future advances, and the executor (here block_on) as the caller of poll.",
      "The answer explains that Poll::Pending hands control back to the executor rather than blocking a thread.",
      "The answer distinguishes the executor (scheduler) from the reactor (IO readiness), noting block_on plays the executor role.",
    ],
    hints: [
      "The chapter's one-line summary: calling an async function produces a value and starts nothing.",
      "Look at the block_on loop: it returns on Poll::Ready and prints on Poll::Pending.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Trace the Handshake state machine by hand",
    objective: "Read a manual Future implementation and predict its poll-by-poll output and stage transitions.",
    starterPrompt: "Take the Handshake future from Example 2, constructed with stage = Stage::Start and remaining_polls = 1, and trace every call to poll until it returns Poll::Ready.",
    prompts: [
      "List, in order, the Stage value at the start of each poll call and the Poll result it returns.",
      "Count how many times poll is called before the value \"connected\" is produced.",
      "Explain what remaining_polls represents and what happens when it reaches zero.",
      "State which printed lines the driver loop emits on each Pending result.",
    ],
    acceptanceCriteria: [
      "The trace shows Start returning Pending, then Waiting (with remaining_polls 1) returning Pending, then Waiting returning Ready.",
      "The answer states poll is called three times before Poll::Ready is returned.",
      "The answer explains remaining_polls is the retry budget that keeps the future in Waiting and Pending until it hits zero.",
      "The answer notes each Pending prints the current stage and the remaining retries from the driver loop.",
    ],
    hints: [
      "The match arm Stage::Waiting if self.remaining_polls > 0 fires before the plain Stage::Waiting arm.",
      "Follow the Stage field and the retry counter, exactly as the chapter says.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Write a future that yields N times before completing",
    objective: "Implement the Future trait by hand so a single value reports Pending a fixed number of times before going Ready.",
    starterPrompt: "Generalize YieldOnce into a CountdownYield future whose poll returns Poll::Pending exactly n times and then Poll::Ready(\"done\"), with the signature fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<&'static str>.",
    prompts: [
      "Give the struct a counter field that records how many Pending results remain.",
      "Decrement the counter on each poll and return Pending while it is above zero.",
      "Return Poll::Ready(\"done\") on the poll where the counter reaches zero.",
      "Drive it with a small block_on loop and confirm the number of pending prints matches n.",
    ],
    acceptanceCriteria: [
      "The poll signature is fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<&'static str>.",
      "For n = 3 the future returns Poll::Pending three times and then Poll::Ready(\"done\").",
      "Mutating the counter goes through self after the Pin<&mut Self> receiver, not a separate owned copy.",
      "Output of the driver loop shows exactly three pending iterations before the ready value.",
    ],
    hints: [
      "YieldOnce flips a single bool; you instead count down an integer field.",
      "The receiver self: Pin<&mut Self> still lets you assign to plain fields like self.remaining.",
    ],
  },
  {
    number: 4,
    kind: "implementation",
    title: "Compose two awaits inside one async fn",
    objective: "Build an async function that awaits two subfutures in sequence and observe how the compiler turns it into one combined state machine.",
    starterPrompt: "Write async fn connect_then_call(service: &'static str, route: &'static str) -> String that awaits one YieldOnce for the service and one for the route, then returns format!(\"{}:{}\", service, route), and run it under the chapter's block_on.",
    prompts: [
      "Await the two YieldOnce subfutures one after the other inside the async fn.",
      "Predict how many total Pending results block_on prints for two sequential awaits.",
      "Explain why the locals service and route must survive across the await points.",
      "Relate the resulting future to the enum-shaped state machine the chapter describes.",
    ],
    acceptanceCriteria: [
      "connect_then_call awaits both YieldOnce values in order and returns the formatted \"service:route\" String.",
      "The answer predicts two Pending prints, one per sequential YieldOnce.",
      "The answer explains the awaited locals become fields of the generated future and must outlive each suspension.",
      "The answer connects each .await to a distinct variant of the compiler-generated state machine.",
    ],
    hints: [
      "Each YieldOnce yields exactly one Pending before becoming Ready, so two of them in sequence yield twice.",
      "The chapter's model: each .await becomes a variant holding the locals that must survive that suspension.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Fix a manual future that never yields",
    objective: "Diagnose and repair a poll implementation whose state transitions are wrong so the executor spins or completes too early.",
    starterPrompt: "A colleague's Handshake-style future returns Poll::Ready on its very first poll even though it should pass through a Waiting stage first, and a second variant accidentally returns Pending forever. Repair the match arms so it yields Pending a bounded number of times and then completes.",
    prompts: [
      "Identify the arm that returns Ready before any Pending and explain why that defeats the point of the future.",
      "Identify the arm that never advances the Stage and would make block_on loop forever.",
      "Rewrite the transitions so each Pending advances the stage or decrements a retry counter.",
      "Confirm the corrected future terminates by tracing it under the driver loop.",
    ],
    acceptanceCriteria: [
      "The diagnosis names the early-Ready arm and the non-advancing Pending arm as the two defects.",
      "The fixed poll advances Stage (or decrements remaining_polls) on every Pending so progress is guaranteed.",
      "The fixed future returns Poll::Ready after a finite, predictable number of polls.",
      "The explanation ties the infinite-loop bug to a future that returns Pending without ever changing its own state.",
    ],
    hints: [
      "A future that returns Pending must change something each poll, or the executor never makes progress.",
      "Compare against Example 2, where every Pending either changes the Stage or lowers remaining_polls.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Design a cancellable fan-out for one request",
    objective: "Apply cancellation-by-drop and structured concurrency to a request that fans out to several outbound calls.",
    starterPrompt: "Design the ownership and cancellation story for the chapter's opening service: one request parses input, fans out to several outbound RPCs, joins their results, and writes to a database. Describe how a timeout on the whole request stops the in-flight children.",
    prompts: [
      "Decide which borrowed locals must become owned before any child task is spawned, and which can stay borrowed.",
      "Explain what 'cancel a child' actually means in async Rust and what the parent must do to trigger it.",
      "State the structured-concurrency rule that keeps the children from outliving the parent scope.",
      "Describe what cleanup of partially acquired state requires if a child is dropped mid-flight.",
    ],
    acceptanceCriteria: [
      "The design separates values borrowed only locally from values that must be owned before a task is spawned.",
      "The answer states that cancelling a child means dropping its future, i.e. the parent stops polling it.",
      "The answer asserts the parent owns the fan-out so children cannot outlive it, and surfaces the first failure.",
      "The answer notes that any cleanup of partially acquired state must be explicit in the future's own design, since drop alone will not unwind it.",
    ],
    hints: [
      "The chapter's rule: cancel usually means drop the future, and the ownership rule stays the same across runtimes.",
      "Structured concurrency makes the parent own the whole fan-out and wait for or drop every child.",
    ],
  },
]

const reviewQuestions = [
  "Why does calling an async fn in Rust start no work, and what type does the call expression produce?",
  "What does the compiler build from an async function, and what determines which locals become fields of that state machine?",
  "Why does Future::poll take a Pin<&mut Self> receiver rather than a plain &mut Self?",
  "What are the two cooperating parts of an async runtime, and what does each one do?",
  "In async Rust, what does cancelling a future mean operationally, and what is the future author still responsible for?",
]

const workingLoop = [
  "Restate the exercise goal in terms of ownership, types, and the chapter's core idea.",
  "Write the smallest version that compiles, then make it correct.",
  "Check each acceptance criterion explicitly before moving on.",
  "Name one tradeoff or failure mode your solution accepts.",
]

<RustPracticeCard
  title={"Runnable lab · a hand-written handshake future"}
  filename="handshake_future_lab.rs"
  runKey="ch24_ex_handshake"
  expectedOutput={"poll = pending\npoll = pending\nresult = session-open\npending count = 2"}
  helperText={"Implement the poll state machine so the Handshake future advances one Stage per poll and yields Poll::Pending until it reaches Ready. The driver block_on counts how many times it had to poll while pending."}
  initialCode={`use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll, Wake, Waker};

#[derive(Debug, Clone, Copy, PartialEq)]
enum Stage {
    Connect,
    Authenticate,
    Ready,
}

struct Handshake {
    stage: Stage,
    polls: u32,
}

impl Future for Handshake {
    type Output = &'static str;

    fn poll(mut self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Self::Output> {
        self.polls += 1;
        // TODO: advance \`self.stage\` one step per poll:
        //   Connect      -> Authenticate, return Poll::Pending
        //   Authenticate -> Ready,        return Poll::Pending
        //   Ready        -> return Poll::Ready("session-open")
        // The placeholder below completes immediately and never yields.
        Poll::Ready("not-implemented")
    }
}

struct NoopWake;

impl Wake for NoopWake {
    fn wake(self: Arc<Self>) {}
}

fn block_on<F: Future>(future: F) -> (F::Output, u32) {
    let waker = Waker::from(Arc::new(NoopWake));
    let mut cx = Context::from_waker(&waker);
    let mut future = Box::pin(future);
    let mut pending = 0u32;
    loop {
        match future.as_mut().poll(&mut cx) {
            Poll::Ready(value) => return (value, pending),
            Poll::Pending => {
                pending += 1;
                println!("poll = pending");
            }
        }
    }
}

fn main() {
    let handshake = Handshake {
        stage: Stage::Connect,
        polls: 0,
    };
    let (result, pending_count) = block_on(handshake);
    println!("result = {}", result);
    println!("pending count = {}", pending_count);
}
`}
/>
*/
