"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Layers, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "Decide what each test is actually proving",
    body: "Before you reach for a tool, write down the claim in one sentence: “used quota never exceeds the limit,” “a truncated frame is rejected,” “a duplicate delivery has no second effect.” When ownership, time, queues, retries, and unsafe invariants are vague, tests are vague too. The calmest suite follows the real operational boundaries of the system instead of fighting them, and every test names the one fact it defends.",
  },
  {
    title: "Use the cheapest layer that can still prove the claim",
    body: "Tests are not free: the slower and wider the layer, the more flaky and expensive each failure becomes. A unit test around one invariant is cheaper and more stable than a whole-service test, and a property test beats thirty hand-picked examples when the real question is algebraic or state-machine correctness. Spend the heavy layers only on the claims that genuinely need transport, a runtime, or a broker to be true.",
  },
  {
    title: "Determinism is a feature you design in, not a happy accident",
    body: "Advanced systems become testable when the things that wobble are put under your control: fake clocks instead of wall-clock sleeps, stable IDs instead of random UUIDs, bounded queues with explicit capacity, explicit retries, and normalized output. Sleep-heavy tests and incidental randomness do not test more of the system — they mostly hide the real contract behind timing luck, and then get re-labeled “CI noise” when they fail.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You probably already trust sanitizer-heavy integration suites for parser and ABI code, and you should keep them. The shift is that Rust lets you assert invariants directly at the type and ownership boundary before the whole system path is involved, so the unsafe edge gets its own small, named tests rather than being covered only by a happy-path end-to-end run. Miri replaces some of what you would have asked ASan/UBSan to catch, but only inside Rust.",
  },
  {
    title: "C# background",
    body: "There is far less ambient mocking surface and no runtime reflection to lean on, so the wide mock-heavy object graph you might build with Moq does not translate. The Rust win is narrower seams: a small trait you can swap for a typed fake, an injected clock, deterministic state transitions. You design the seam into the type instead of generating a proxy at runtime, which means the test boundary is visible in the signature.",
  },
  {
    title: "Go background",
    body: "Your table-driven instinct carries over almost unchanged and is still excellent for enumerated cases. The new leverage is that Rust’s sharp ownership and parser boundaries pay off even more under property tests, fuzzing, and replay-oriented harnesses: instead of one row per case, you state the invariant once and let proptest or cargo-fuzz hunt for the counterexample, then shrink it down to the minimal failing input for you.",
  },
  {
    title: "Python background",
    body: "Coming from pytest plus monkeypatch and unittest.mock, you are used to patching names at runtime to isolate code. Rust has no monkeypatching — you cannot reach in and replace a function the production code already bound. Substitution happens through generics or trait objects chosen at the call site, so the testable seam must exist in the design. The payoff is that the compiler proves your fake satisfies the same contract as the real implementation.",
  },
]

const unitTestSnippet = `#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_duplicate_order_id() {
        let mut index = OrderIndex::default();
        assert!(index.insert("ord-7"));
        assert!(!index.insert("ord-7"));
    }
}`

const integrationTestSnippet = `use my_service::TestApp;

#[tokio::test]
async fn checkout_persists_and_emits() {
    let app = TestApp::boot().await;
    let response = app.post_checkout("ord-7").await;

    assert_eq!(response.status(), 202);
    assert!(app.outbox_contains("ord-7").await);
}`

const propertySnippet = `proptest! {
    #[test]
    fn usage_never_exceeds_limit(
        limit in 1_u32..64,
        ops in proptest::collection::vec(0_u32..16, 0..32),
    ) {
        let mut quota = Quota::new(limit);

        for qty in ops {
            let _ = quota.try_reserve(qty);
            prop_assert!(quota.used() <= limit);
        }
    }
}`

const fuzzSnippet = `#![no_main]
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    let _ = parse_frame(data);
});`

const asyncTestSnippet = `#[tokio::test(start_paused = true)]
async fn lease_expires_and_redelivers() {
    let clock = TestClock::new();
    let queue = TestQueue::new(clock.clone());

    let first = queue.claim("task-7").await.unwrap();
    clock.advance(Duration::from_secs(31)).await;

    assert_eq!(queue.claim("task-7").await.unwrap().id, first.id);
}`

const goldenSnippet = `let rendered = render_protocol_frame(&fixture);
let expected = std::fs::read("tests/golden/frame_v2.bin").unwrap();

assert_eq!(rendered, expected);`

const snapshotSnippet = `let report = render_error_report(&event);
insta::assert_snapshot!(report);`

const benchmarkSnippet = `#[test]
#[ignore = "perf-lane: run via \`cargo test -- --ignored\` on a dedicated benchmark runner"]
fn encode_batch_regression_budget() {
    let stats = run_encode_fixture();
    assert!(stats.p95_us <= 250, "encode budget exceeded: {:?}", stats);
}`

const unsafeTestingChecklist = [
  "Write the unsafe invariant down before the test strategy. If the code depends on pointer validity, aliasing, initialization, or lifetime bounds, the test harness should name those constraints explicitly.",
  "Keep a safe reference implementation when possible. The fastest unsafe parser is easiest to validate against a slower obviously-correct version on shared fixtures and fuzz cases.",
  "Hit boundary sizes and bad layouts on purpose: zero bytes, one byte, truncated header, maximum header, misaligned or malformed encodings where relevant.",
  "Use more than one tool: ordinary assertions for contract behavior, Miri for undefined-behavior checks inside Rust, and native sanitizers where the boundary touches FFI or lower-level runtime code.",
]

const asyncTestingChecklist = [
  "Prefer explicit fake time, deterministic queues, and bounded concurrency over `sleep`-based hopes.",
  "Handle the join layer and the inner task layer separately. A task panic or cancellation is not the same event as a typed inner failure.",
  "Own values across spawned-task boundaries so the harness tests the real runtime contract instead of a borrow-only local approximation.",
  "Add cancellation and shutdown tests deliberately: what happens to in-flight work, delayed timers, and queue drain paths when the system stops?",
]

const distributedTestingChecklist = [
  "Test replay first: same message twice, same lease completion twice, same graph node discovered twice. Duplicate-safe behavior is usually the real contract.",
  "Use fake clocks or deterministic schedulers for queue age, lease expiry, retry windows, and backoff policy.",
  "Keep one end-to-end smoke path on the real transport if the repository already supports it, but prove idempotency and timeout logic in smaller deterministic harnesses first.",
  "Assert trace and correlation fields too: request ID, task ID, attempt, queue name, and durable checkpoint identity are part of whether the incident is debuggable later.",
]

const goldenFileNotes = [
  "Golden files are best when the expected output is a stable external artifact: rendered config, protocol frame bytes, compiler-style diagnostics, or normalized textual output another team already consumes.",
  "Normalize nondeterministic fields before comparing: timestamps, UUIDs, file paths, queue offsets, and ordering noise should not make the fixture meaningless.",
  "Review golden-file updates like API changes. An automatically rewritten golden file can still hide a real regression if the semantic expectation was not discussed.",
]

const snapshotNotes = [
  "Snapshot testing is strongest when the output is large, structured, and human-reviewable: CLI reports, error trees, code generation, or formatted documents.",
  "Pair snapshots with semantic assertions. A snapshot alone is usually too weak for critical invariants such as 'duplicate deliveries are ignored' or 'unsafe parser rejects truncated frames'.",
  "Prefer small focused snapshots over giant catch-all snapshots. The more unrelated surface one snapshot covers, the noisier every review becomes.",
]

const benchmarkRegressionNotes = [
  "Benchmark regression tests are budget guards, not proof of universal speed. Keep them separate from correctness tests and expect looser thresholds than ordinary assertions.",
  "Use stable workloads and representative input sizes. A benchmark budget that only passes on one developer laptop or one random CI runner is not an operational contract.",
  "Track the same boundary categories you care about in production: p95 latency, allocations, bytes processed, queue depth, and launch count where relevant.",
]

const productionPatterns = [
  "Build a deliberate test stack: unit tests for invariants, integration tests for public seams, property tests for algebra and state machines, fuzzing for hostile inputs, and a small number of end-to-end checks for transport reality.",
  "Remove nondeterminism early with fake clocks, fixed seeds, normalized IDs, deterministic temp paths, and explicit queue capacities.",
  "Make unsafe code auditable before it is 'well tested.' A small unsafe surface plus a written invariant is better than a giant unsafe surface with many vague tests.",
  "Keep async and distributed harnesses close to the real ownership model: owned task messages, explicit retries, explicit cancellation, and durable duplicate suppression.",
  "Treat golden files, snapshots, and benchmark budgets as contracts that need review discipline, not only convenience tooling.",
]

const pitfalls = [
  "Relying on a few slow integration tests while leaving core invariants untested at the unit or property layer.",
  "Using wall-clock sleeps in async tests and then calling the resulting flakiness 'CI noise.'",
  "Fuzzing a parser without first making the parser boundary small enough to diagnose failures or without saving crashing inputs into a corpus.",
  "Testing unsafe code only through success-path integration tests instead of checking the explicit invariant edges where UB risk actually lives.",
  "Snapshotting timestamps, random IDs, or unordered maps without normalization and then teaching the team to ignore diffs.",
  "Turning benchmark budgets into nanosecond-precise correctness tests on noisy shared CI hardware.",
  "Calling a distributed harness 'good enough' before replay, retry, and queue-age behavior are asserted directly.",
]

const summaryPoints = [
  "Use unit tests for local invariants, integration tests for public seams, property tests for general invariants, and fuzzing for hostile input spaces.",
  "Unsafe, async, and distributed Rust systems become testable when invariants, ownership, and time are explicit enough to control deterministically.",
  "Golden files and snapshots solve different review problems; both need normalization and semantic discipline.",
  "Benchmark regression tests are budget guards, not replacements for profiling or production observability.",
  "The best advanced test suite is layered, deterministic where possible, and explicit about which claim each layer proves.",
]

export function PageCh42TestingAdvancedRustSystems() {
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
  const pageIndex = getPageIndexById("ch42-testing-advanced-rust-systems")
  const chapter08PageIndex = getPageIndexById("ch08-undefined-behavior-and-unsafe-rust")
  const chapter19PageIndex = getPageIndexById("ch19-serialization-and-data-contracts")
  const chapter24PageIndex = getPageIndexById("ch24-coroutines-futures-and-async-rust")
  const chapter25PageIndex = getPageIndexById("ch25-tokio")
  const chapter31PageIndex = getPageIndexById("ch31-distributed-task-execution")
  const chapter41PageIndex = getPageIndexById("ch41-error-handling-in-large-systems")
  const exercisesPageIndex = getPageIndexById("ch42-testing-advanced-rust-systems-exercises")
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
          Chapter 42 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Testing an advanced Rust system is less about test count and more about defending the right invariants at the
          cheapest layer that can still prove them — across parsers, concurrency, IO, time, and failure. This chapter
          organizes a test suite around production risk and determinism rather than line or command coverage.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 08, 19, 24, 25, 31, and 41</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 08 covered unsafe invariants and FFI boundaries. Chapter 19 covered stable wire contracts and
                fixture-friendly DTOs. Chapters 24 and 25 covered async and Tokio. Chapter 31 covered replay, leases, and
                distributed work. Chapter 41 separated domain, infrastructure, and transport error contracts. This chapter
                uses all of them.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter08PageIndex)}>
                Chapter 08
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter19PageIndex)}>
                Chapter 19
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter24PageIndex)}>
                Chapter 24
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter25PageIndex)}>
                Chapter 25
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter31PageIndex)}>
                Chapter 31
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter41PageIndex)}>
                Chapter 41
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            Picture one service that has accumulated every hard-to-test ingredient at once. It has an unsafe parser fast
            path that walks raw bytes, async workers that process those frames, distributed replay where the same message
            can arrive twice, generated reports that another team reviews byte-for-byte, and a latency budget that the
            product has promised to customers. A single end-to-end suite that boots the whole thing and pokes it from the
            outside would be slow, flaky, and almost useless when it fails: a red build would tell you something broke,
            not which contract broke.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            The job for the rest of this chapter is to take that one tangled service and break its risks apart into
            separate, mostly deterministic claims — local invariants, hostile-input handling, retry safety, output
            stability, and performance budgets — and then prove each claim at the cheapest layer where it can be proven
            reliably. The diagram below shows that mapping: a single risk in the system on the left, the test layer that
            owns it on the right.
          </p>
          <div className="mt-4">
            <MermaidDiagram
              chart={`flowchart TD
  subgraph Risks1 ["Where the system can break"]
    Inv[Local invariant]
    Hostile[Hostile bytes]
    Replay[Duplicate delivery]
  end
  subgraph Layers1 ["Cheapest layer that proves it"]
    Unit["Unit / property test"]
    Fuzz[Fuzz target]
    Async[Deterministic async harness]
  end
  Inv --> Unit
  Hostile --> Fuzz
  Replay --> Async`}
              caption="Part 1 — invariants, hostile input, and duplicate delivery each push down to a cheap, deterministic layer."
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground leading-6">
            The same mapping continues for output stability and performance:
          </p>
          <div className="mt-4">
            <MermaidDiagram
              chart={`flowchart TD
  subgraph Risks2 ["Where the system can break"]
    Out[Generated output]
    Budget[Latency budget]
  end
  subgraph Layers2 ["Cheapest layer that proves it"]
    Snap["Golden / snapshot"]
    Bench[Benchmark lane]
  end
  Out --> Snap
  Budget --> Bench`}
              caption="Part 2 — generated output and latency budgets move to snapshot review and an isolated benchmark lane, instead of being tested only through one slow end-to-end path."
            />
          </div>
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground leading-6">
              In a real Cargo repository this layering is not abstract — it shows up as concrete files and crates: ordinary
              unit-test modules next to the code, an
              <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px] mx-1">tests/</code>
              directory for integration suites, a property-testing crate such as
              <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px] mx-1">proptest</code>,
              fuzz targets driven by
              <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px] mx-1">cargo-fuzz</code>,
              snapshot tooling such as
              <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px] mx-1">insta</code>,
              and a benchmark lane kept well away from the correctness suite.
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">At a glance</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Choose the cheapest test layer that can prove the real claim.</li>
              <li>Use property tests for invariants, fuzzing for hostile inputs, and integration tests for public seams.</li>
              <li>Make time, retries, cancellation, and queueing deterministic before calling async or distributed tests “done.”</li>
              <li>Keep snapshots, golden files, and benchmark budgets disciplined enough that reviewers can still trust them.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">Proof questions for the suite</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Which invariant can be proven below the transport layer?</li>
              <li>Which boundary is hostile enough to deserve fuzzing or unsafe-edge tests?</li>
              <li>What nondeterminism must be removed before the result is reviewable?</li>
              <li>Which claims belong in performance lanes rather than in correctness assertions?</li>
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Mental model</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Three ideas carry most of the weight in this chapter. Name the claim each test defends, prove it at the
            cheapest layer that can, and engineer determinism instead of hoping for it. Everything else — which crate,
            which macro, which directory — is downstream of getting these three right.
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

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <article className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-foreground">The shape of a layered suite</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-6">
              The familiar “test pyramid” is really a statement about cost and stability. Cheap, fast, deterministic tests
              live at the bottom and there are many of them; expensive, slower, more fragile tests live at the top and
              there are few. Property tests and fuzzing sit off to the side: they are not a separate altitude so much as a
              different way of generating inputs for the bottom and middle layers. Read the next diagram as a budget — most
              of your assertions should be near the base, and each step up should be justified by a claim that genuinely
              needs that much machinery to be true.
            </p>
            <div className="mt-4">
              <MermaidDiagram
                chart={`flowchart TD
  E2E["End-to-end / transport smoke"] --> Integ[Integration tests at public seams]
  Integ --> Unit[Unit tests for local invariants]
  Gen[Property tests and fuzzing] -.feed inputs into.-> Unit
  Gen -.feed inputs into.-> Integ`}
                caption="Most assertions live at the cheap base; property tests and fuzzing feed generated inputs into the lower layers rather than forming a separate top tier."
              />
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Unit tests</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Unit tests are the right layer for local invariants, pure helpers, edge conditions, and typed domain rules.
              They should prove things like “quota never exceeds limit,” “state transition rejects duplicate submission,” or
              “parser header length is checked before decoding.” This is usually the cheapest place to keep a failure
              precise: when a unit test goes red, the blast radius is one function or one type, so the message points
              almost directly at the broken line instead of at incidental wiring.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mt-3">
              In the snippet below, look at the two assertions on the same ID. The first insert must succeed and the second
              must fail — that pair is the entire contract of a duplicate-rejecting index, stated without booting anything
              around it.
            </p>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{unitTestSnippet}</code>
            </pre>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Integration tests</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Integration tests should exercise public seams the way another crate or another deployment unit does: HTTP
              handlers driven through a test app, an adapter and its store doing a real round-trip, or a queue-consumer
              shell wrapped around an owned envelope. The discipline that keeps them useful is restraint. They are not the
              place to re-prove every tiny invariant from scratch — that work belongs in the cheap layers below. An
              integration test should assert the things that only become true once the pieces are wired together, such as
              “a successful checkout returns 202 and the outbox now contains the order.”
            </p>
            <p className="text-sm text-muted-foreground leading-6 mt-3">
              In the example, the interesting lines are the two assertions after the request. The status code proves the
              public HTTP contract; the
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">outbox_contains</code>
              check proves the side effect crossed the seam. Everything before them is just enough setup to make those two
              claims meaningful.
            </p>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{integrationTestSnippet}</code>
            </pre>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Property-based testing</h4>
            <p className="text-sm text-muted-foreground leading-6">
              A property test inverts how you normally write assertions. Instead of supplying a specific input and
              checking a specific output, you state a rule that must hold for <em>every</em> input in some range, and the
              framework generates hundreds of cases trying to break it. Properties shine when the important claim is
              general: no negative balance, output always sorted, a parser round-trip is lossless, resource accounting
              never exceeds the limit, or retry bookkeeping stays idempotent under repeated input.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mt-3">
              The random data is not the valuable part on its own — thirty random runs that all pass prove little. The
              valuable part is <strong>shrinking</strong>: when a property fails,
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">proptest</code>
              automatically reduces the failing case to a minimal counterexample, so you get the smallest input that
              violates the rule rather than a 4 KB blob you still have to debug. In the snippet, the loop body is the whole
              test: after every reservation, used quota must stay at or below the limit, no matter which sequence of
              quantities the generator picked.
            </p>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{propertySnippet}</code>
            </pre>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Fuzzing</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Fuzzing is property testing pointed at openly hostile input. It is the right tool for parsers, decoders,
              compression wrappers, protocol frames, unsafe byte walkers, and FFI boundaries — anywhere arbitrary bytes
              from outside cross into your code. A coverage-guided fuzzer such as
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">cargo-fuzz</code>
              mutates inputs and watches which branches they reach, steadily steering toward the paths your hand-written
              cases never thought to exercise. The implicit property is usually the simplest one possible: “whatever bytes
              arrive, this function must not panic, hang, or trigger undefined behavior.”
            </p>
            <p className="text-sm text-muted-foreground leading-6 mt-3">
              Two habits make fuzzing pay off. Target the smallest boundary that still reproduces the failure, so a crash
              points at one parser rather than the whole service. And save crashing inputs into a corpus so each fix comes
              with a permanent regression case. The harness below is deliberately tiny — that minimalism is the point,
              because a boring target keeps the crash cause diagnosable.
            </p>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{fuzzSnippet}</code>
            </pre>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Testing unsafe code</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Unsafe code is different because the bug you fear may not be observable from a passing test. A use of an
              invalid pointer or a violated aliasing rule is undefined behavior: the program might return the right answer
              today and corrupt memory next week after the optimizer makes a different choice. So testing unsafe code is
              not about throwing more inputs at it — it is about pinning down the invariant the unsafe block relies on, and
              then checking that invariant with tools that can see undefined behavior even when ordinary assertions cannot.
              The checklist below is the order that tends to work: write the invariant first, then keep a safe reference,
              then hammer the boundaries, then bring in Miri and sanitizers.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {unsafeTestingChecklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                  Unsafe code is not “well tested” because one happy-path integration test passed. It is well tested only
                  when the test suite covers the invariant edges where UB risk actually lives.
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Testing async code</h4>
            <p className="text-sm text-muted-foreground leading-6">
              The recurring temptation in async tests is to express “after some time, X should happen” with a real
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">sleep</code>.
              That makes the test slow and, worse, makes it depend on scheduler luck, so it passes on a fast laptop and
              flakes in CI. The fix is to take time out of the operating system’s hands and put it in the test’s hands.
              Tokio’s
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">start_paused = true</code>
              freezes the clock so it only advances when you advance it, which turns “wait 31 seconds for a lease to
              expire” into an instantaneous, exact, repeatable step. The same instinct applies to queueing, cancellation,
              and task ownership: control them deliberately rather than hoping the runtime cooperates. For genuinely
              concurrent state machines, loom can later explore interleavings, but a deterministic boundary comes first.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mt-3">
              The test below exercises a lease that should expire and let the task be reclaimed. The behavior under test is
              a small state machine, so it is worth seeing the states before the code. Watch how the test never sleeps for
              real: it claims the task, advances the fake clock past the lease, and then claims again, expecting the same
              task to come back.
            </p>
            <div className="mt-4">
              <MermaidDiagram
                chart={`stateDiagram-v2
  [*] --> Available
  Available --> Leased: claim(task)
  Leased --> Available: lease expires (clock advanced)
  Leased --> Done: ack before expiry
  Available --> Leased: re-claim after expiry
  Done --> [*]`}
                caption="A leased task returns to Available when the (fake) clock passes the lease deadline, so a re-claim redelivers the same task — the exact path the test drives."
              />
            </div>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{asyncTestSnippet}</code>
            </pre>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {asyncTestingChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Testing distributed systems</h4>
            <p className="text-sm text-muted-foreground leading-6">
              In a distributed system the connection opening is the boring part. What actually keeps you up at night is
              everything that happens because most brokers deliver at least once: the same message can arrive twice, a
              lease can expire and redeliver mid-flight, a retry can re-run work that already half-succeeded. So the claims
              worth testing are replay safety, duplicate suppression, retry classification, queue age, and durable
              completion — not “a broker connection opened.” Keep the transport reality in one small top layer if the repo
              already supports it, and prove the hard behavior below it with fake time and owned envelopes, where it is
              deterministic.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mt-3">
              The single most important property is usually idempotency under duplicate delivery. The sequence below is the
              one your test should drive directly: the same message ID is delivered twice, but the durable effect happens
              exactly once because the worker checks a completion record before acting. If your harness can produce this
              flow and assert “one effect, one duplicate suppressed,” you have tested the contract that matters.
            </p>
            <div className="mt-4">
              <MermaidDiagram
                chart={`sequenceDiagram
  participant B as Broker
  participant W as Worker
  participant S as Durable store
  B->>W: deliver msg id=7
  W->>S: seen id=7?
  S-->>W: no
  W->>S: commit effect, mark id=7 done
  B->>W: deliver msg id=7 (duplicate)
  W->>S: seen id=7?
  S-->>W: yes
  W-->>B: ack, no second effect`}
                caption="At-least-once delivery means id=7 can arrive twice; the completion check in the durable store makes the second delivery a no-op. This is the flow a distributed test should reproduce."
              />
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {distributedTestingChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Golden files</h4>
            <p className="text-sm text-muted-foreground leading-6">
              A golden-file test compares the program’s output against a known-good artifact checked into the repository.
              It shines when the output is an external contract someone actually cares about byte-for-byte: a protocol
              frame, a normalized CLI dump, compiler-style diagnostics, or a rendered document another team consumes. The
              point is that a change to that output should be a deliberate, reviewable event — a diff against the golden
              file in a pull request — rather than something that drifts silently.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mt-3">
              The snippet is the whole pattern in three lines: render the artifact, read the committed golden bytes,
              compare. The only subtlety lives in what you render — anything nondeterministic (timestamps, UUIDs, paths)
              must be normalized before the comparison, or the test becomes noise the team learns to ignore.
            </p>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{goldenSnippet}</code>
            </pre>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {goldenFileNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Snapshot testing</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Snapshot testing is the ergonomic cousin of golden files. A crate such as
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">insta</code>
              captures the output on the first run, stores it next to the test, and on later runs shows you a diff and lets
              you accept or reject the change with a review command. It is the right tool when the output is too large to
              hand-write assertions for but still small enough that a human can eyeball the diff: CLI reports, error trees,
              generated code, formatted documents.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mt-3">
              The one-line call in the snippet hides the workflow, not the risk. A snapshot proves “the output looks like
              this,” which is weaker than “the output is correct.” Treat it as a review aid for shape and pair it with a
              real semantic assertion for any load-bearing invariant — accepting a snapshot diff without thinking is how a
              genuine regression slips through.
            </p>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{snapshotSnippet}</code>
            </pre>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {snapshotNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Benchmark regression tests</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Benchmark regressions belong in their own lane. They are less deterministic than correctness tests, more
              sensitive to hardware and build profile, and only useful when the budget itself is meaningful to the product.
              Keep them coarse, stable, and obviously tied to one service budget. When a budget guard is expressed as an
              ordinary <code className="font-mono text-foreground">#[test]</code>, mark it
              <code className="font-mono text-foreground"> #[ignore]</code> (or gate it behind a feature flag) so it runs
              in an isolated performance job on a dedicated runner, not in the shared correctness suite. A Criterion or
              <code className="font-mono text-foreground"> [[bench]]</code> harness is the cleaner home once the budget
              earns one.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mt-3">
              In the snippet, the two things to notice are the
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">#[ignore]</code>
              attribute that keeps this out of the normal correctness run, and the comparison against a single coarse
              budget (<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">p95_us &lt;= 250</code>) rather
              than an exact timing. That looseness is intentional: it is a guard against regressions large enough to matter
              operationally, not a precise measurement.
            </p>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{benchmarkSnippet}</code>
            </pre>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {benchmarkRegressionNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <h4 className="font-semibold text-foreground mb-2">How testing thinking shifts by background</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The hardest part of testing advanced Rust is rarely the syntax of
              <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px] mx-1">#[test]</code>
              — it is unlearning the substitution and isolation habits your previous language made cheap. Each card below
              names the mental-model shift, not a crate-for-library mapping.
            </p>
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
              {comparisonCallouts.map((comparison) => (
                <div key={comparison.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
                </div>
              ))}
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
                The most expensive advanced-testing mistake is usually not “too few tests.” It is too much of the wrong
                test layer and too little control over time, replay, unsafe invariants, and output stability.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Examples</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Both runnable examples below are deliberately deterministic so they execute in the browser, but each is shaped
            like the production test it stands in for. The first is a quota invariant — the seed of a property test. The
            second is a duplicate-delivery harness — the seed of a distributed idempotency test. Run each once to see the
            baseline output, then change an input and watch which assertion moves.
          </p>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 1: deterministic invariant harness you can later lift into a property test</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The browser example stays deterministic, but the shape is the same one you would lift into a
                  property-testing crate: many generated scenarios, one invariant, zero ambiguity about the contract.
                </p>
              </div>
              {codes.testing_property_invariant_harness !== DEFAULT_CODES.testing_property_invariant_harness && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("testing_property_invariant_harness")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.testing_property_invariant_harness}
              onChange={(newCode) => updateCode("testing_property_invariant_harness", newCode)}
              onRun={() => runCode("testing_property_invariant_harness")}
              output={outputs.testing_property_invariant_harness ?? null}
              isRunning={isRunning === "testing_property_invariant_harness"}
              filename="property_invariant_harness.rs"
              expectedOutput={"cases = 5\nall valid = true\nlimit = 8"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.testing_property_invariant_harness}
              onRevert={() => resetCode("testing_property_invariant_harness")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Invariant</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The claim is simple and load-bearing: used quota never exceeds limit, even when some reservations are
                  rejected.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Cheap layer</div>
                <p className="text-xs text-muted-foreground leading-5">
                  This stays below the transport and runtime layers, so failures point straight at the state rule rather
                  than at incidental integration noise.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Lift path</div>
                <p className="text-xs text-muted-foreground leading-5">
                  In a real project, the same invariant becomes a property test by replacing the fixed scenarios with a
                  generator and a shrinker.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: deterministic async idempotency harness for a service boundary</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The important property is not “Tokio works.” The important property is that duplicate deliveries are
                  harmless and the async boundary keeps that rule explicit.
                </p>
              </div>
              {codes.testing_async_idempotent_delivery_harness !== DEFAULT_CODES.testing_async_idempotent_delivery_harness && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("testing_async_idempotent_delivery_harness")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.testing_async_idempotent_delivery_harness}
              onChange={(newCode) => updateCode("testing_async_idempotent_delivery_harness", newCode)}
              onRun={() => runCode("testing_async_idempotent_delivery_harness")}
              output={outputs.testing_async_idempotent_delivery_harness ?? null}
              isRunning={isRunning === "testing_async_idempotent_delivery_harness"}
              filename="async_idempotent_delivery_harness.rs"
              expectedOutput={"processed = 2\nduplicates = 1\ndeliveries = 3"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.testing_async_idempotent_delivery_harness}
              onRevert={() => resetCode("testing_async_idempotent_delivery_harness")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Async boundary</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The state is still one owned set behind an async lock, so the harness tests the real contract instead of a
                  mock-only approximation.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Replay</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Duplicate delivery is part of the design center. The harness counts it and proves it does not duplicate the
                  durable effect.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Distributed translation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The same pattern scales into a queue worker or lease-based consumer once the event ID becomes a durable
                  checkpoint key.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch42_testing_advanced_rust_systems/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to choose test layers deliberately, design a property test for a domain
            invariant, plan fuzz targets for unsafe parsing code, sketch async integration tests for a service boundary,
            and build one production-ready test matrix.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 42 Exercises
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
