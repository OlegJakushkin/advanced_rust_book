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
    title: "Testing advanced Rust systems is mostly about boundary design",
    body: "If ownership, time, queues, retries, and unsafe invariants are vague, tests become vague too. The calmest test suite follows the real operational boundaries instead of fighting them.",
  },
  {
    title: "Use the cheapest layer that can prove the claim",
    body: "A unit test around one invariant is usually cheaper and more stable than a whole service test. A property test is better than thirty ad hoc examples when the real question is algebraic or state-machine correctness.",
  },
  {
    title: "Determinism is a feature, not a convenience",
    body: "Fake clocks, stable IDs, bounded queues, explicit retries, and normalized outputs make advanced systems testable. Sleep-heavy tests and incidental randomness mostly hide the real contract.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You may already trust sanitizer-heavy integration suites for parser and ABI code. Rust still benefits from those, but it also wants explicit invariant tests around ownership and unsafe boundaries before the whole system path is involved.",
  },
  {
    title: "C# background",
    body: "Rust has fewer ambient mocking surfaces and less runtime reflection. The usual win is narrower seams, typed fakes, and deterministic state transitions rather than wide mock-heavy object graphs.",
  },
  {
    title: "Go background",
    body: "Table-driven tests translate well, but Rust often gains even more from property tests, fuzzing, and replay-oriented async or distributed harnesses because ownership and parser boundaries are sharper.",
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
          Advanced Rust testing protects invariants across parsers, concurrency, IO, time, and failure modes. This chapter
          organizes tests around production risk rather than command coverage.
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
            A service combines an unsafe parser fast path, async workers, distributed replay, generated reports, and
            latency budgets. The business requirement is a deterministic test strategy that proves local invariants,
            hostile input handling, retry safety, output stability, and performance budgets at the cheapest reliable layer.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground leading-6">
              In a real Cargo repository, this chapter commonly translates into a mix of unit-test modules,
              <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px] mx-1">tests/</code>
              integration suites, property-testing crates such as
              <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px] mx-1">proptest</code>,
              fuzz targets such as
              <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px] mx-1">cargo-fuzz</code>,
              snapshot tooling, and separate benchmark lanes.
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
            <h4 className="font-semibold text-foreground mb-3">Unit tests</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Unit tests are the right layer for local invariants, pure helpers, edge conditions, and typed domain rules.
              They should prove things like “quota never exceeds limit,” “state transition rejects duplicate submission,” or
              “parser header length is checked before decoding.” This is usually the cheapest place to keep failures
              precise.
            </p>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{unitTestSnippet}</code>
            </pre>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Integration tests</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Integration tests should exercise public seams the way another crate or another deployment unit does. That
              means HTTP handlers through a test app, adapter plus store round-trips, or queue consumer shells around owned
              envelopes. They are not the place to prove every tiny invariant from scratch again.
            </p>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{integrationTestSnippet}</code>
            </pre>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Property-based testing</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Property-based tests are best when the important claim is general: no negative balance, output always sorted,
              parser round-trip is lossless, resource accounting never exceeds limit, or retry bookkeeping remains
              idempotent under repeated inputs. The interesting part is not random data by itself. The interesting part is
              the invariant plus shrinking when the invariant fails.
            </p>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{propertySnippet}</code>
            </pre>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Fuzzing</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Fuzzing is for hostile input spaces: parsers, decoders, compression wrappers, protocol frames, unsafe byte
              walkers, and FFI boundaries. Target the smallest boundary that still reproduces the failure. Save crashing
              inputs into a corpus and keep the harness boring enough that the crash cause is diagnosable.
            </p>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{fuzzSnippet}</code>
            </pre>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Testing unsafe code</h4>
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
              Async tests should control time, queueing, cancellation, and task ownership deliberately. If a test depends
              on sleeps, real clock delays, or lucky scheduler timing, it is usually asserting the wrong thing. For highly
              concurrent state machines, ecosystem tools such as loom can also be useful for exploring interleavings, but
              the first step is still a deterministic boundary.
            </p>
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
              Distributed tests need to prove replay, duplicate suppression, retry classification, queue age, and durable
              completion more than they need to prove that one broker connection opens successfully. Put the transport
              reality in a small top layer, then test lease expiry, retry windows, and idempotent completion with fake time
              and owned envelopes below it.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {distributedTestingChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Golden files</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Golden files are best for fixed externally meaningful outputs. They work well for protocol frames, normalized
              CLI output, compiler-like diagnostics, and rendering layers where humans need to review exact changes across
              revisions.
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
              Snapshot testing is useful when the output is too large for hand-written assertions but still small enough for
              human review. It is not a replacement for semantic checks. It is a review tool for structured output shape.
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
              Keep them coarse, stable, and obviously tied to one service budget.
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

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">How this compares to C++, C#, and Go</h4>
            <div className="grid gap-3 lg:grid-cols-3">
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
