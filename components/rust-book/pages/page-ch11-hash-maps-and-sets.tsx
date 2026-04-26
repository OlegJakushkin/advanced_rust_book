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
    title: "The table owns keys and values",
    body: "A map or set is an owner. Inserting a key or value moves that data into the collection unless the type is Copy. Reads usually borrow; removal or consumption moves data back out.",
  },
  {
    title: "Lookup shape and ownership shape are separate",
    body: "A `HashMap<String, V>` often stores owned `String` keys but supports borrowed `&str` lookup. That is one of the most useful Rust collection patterns in service code.",
  },
  {
    title: "Ordering is a first-class tradeoff",
    body: "`HashMap` and `HashSet` optimize expected constant-time membership and lookup. `BTreeMap` and `BTreeSet` trade that for ordered iteration, range-friendly behavior, and deterministic output.",
  },
]

const traitRequirements = [
  {
    collection: "HashMap<K, V>",
    requirement: "K: Eq + Hash",
    note: "Equality and hashing must agree. If two keys are equal, they must hash the same way.",
  },
  {
    collection: "HashSet<T>",
    requirement: "T: Eq + Hash",
    note: "A set is membership plus deduplication under the same equality and hashing rules.",
  },
  {
    collection: "BTreeMap<K, V>",
    requirement: "K: Ord",
    note: "A total key order drives tree placement and sorted iteration.",
  },
  {
    collection: "BTreeSet<T>",
    requirement: "T: Ord",
    note: "The ordered-set variant gives stable iteration and range-friendly semantics.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "`HashMap` is closest to `std::unordered_map`, `HashSet` to `std::unordered_set`, and the B-tree variants to `std::map` and `std::set`. The Rust difference is that borrowed lookup and ownership transfer are part of ordinary API design, not only a convention.",
  },
  {
    title: "C# background",
    body: "`Dictionary<TKey, TValue>` and `HashSet<T>` will feel familiar, but Rust makes ownership visible. Inserting a `String` key moves it. Looking up by `&str` borrows. Deterministic output is a separate choice, not something hash iteration promises.",
  },
  {
    title: "Go background",
    body: "Go maps are easy to reach for, but iteration order is not something you should depend on. Rust asks the same discipline and adds one more explicit question: who owns the key and value after this call?",
  },
]

const productionPatterns = [
  "Own normalized keys at collection boundaries. Borrow on the read path. That keeps storage independent while avoiding unnecessary lookup allocations.",
  "Use `entry`, `or_insert`, `or_default`, and `and_modify` when the workload is a read-modify-write update on one key path.",
  "Use `HashSet<T>` for deduplication and fast membership checks instead of simulating a set with `HashMap<T, bool>`.",
  "Use `BTreeMap` or `BTreeSet` when tests, logs, API output, config dumps, or range-oriented logic need deterministic key order.",
  "Keep the default randomized hasher on public or untrusted boundaries unless you have a measured reason to do otherwise.",
]

const pitfalls = [
  "Writing `contains_key` and then `get_mut` or `insert` on the same key path. That repeats lookup work and usually obscures the intent. Reach for the Entry API instead.",
  "Forgetting that `entry` on a `String` key path still needs an owned `String`. On stable ordinary std APIs, it removes duplicate table lookups, not the need for an owned key.",
  "Allocating `route.to_string()` on every read lookup when `get(route)` or `contains(route)` would have worked through borrowed lookup.",
  "Depending on `HashMap` iteration order in snapshot tests, JSON rendering, CLI output, or config comparison. If order matters, choose an ordered structure or sort explicitly.",
  "Switching to a faster custom hasher on an internet-facing or attacker-controlled path without accounting for collision behavior and denial-of-service risk.",
  "Mutating key fields that participate in `Eq`, `Hash`, or `Ord` while the key is inside the collection. That breaks the collection's logical contract even if the type system cannot always stop you.",
]

export function PageCh11HashMapsAndSets() {
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
  const pageIndex = getPageIndexById("ch11-hash-maps-and-sets")
  const chapter06PageIndex = getPageIndexById("ch06-ownership-inside-vectors")
  const chapter07PageIndex = getPageIndexById("ch07-copying-data-vs-cloning-data")
  const chapter10PageIndex = getPageIndexById("ch10-arrays-slices-and-vectors")
  const exercisesPageIndex = getPageIndexById("ch11-hash-maps-and-sets-exercises")

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
          Chapter 11 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Maps and sets look familiar on the surface. In Rust, the interesting part is ownership of keys and values,
          borrowed lookup, deterministic output choices, and how hashing policy changes production behavior.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 06, 07, and 10</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 06 explained durable handles versus temporary borrows in collections. Chapter 07 separated moves,
                copies, and clones. Chapter 10 covered contiguous storage and allocation-aware API shape. This chapter
                applies those same design instincts to hashed and ordered associative collections.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter06PageIndex)}>
                Chapter 06
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter07PageIndex)}>
                Chapter 07
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter10PageIndex)}>
                Chapter 10
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            You are reviewing an ingress service that tracks per-route counters, deduplicates active feature flags,
            enriches requests from in-memory indexes, and emits deterministic config dumps for operators. In one place,
            the code allocates a fresh `String` on every lookup. In another, it uses `contains_key` and `insert` on the
            same key path. In a third, test failures come from assuming hash iteration order is stable. Rust does not make
            these issues mysterious. It makes them visible: who owns the key, how the lookup is borrowed, and whether
            order is even part of the contract.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A reliable review order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Does this call path own keys and values, or only borrow them temporarily?</li>
              <li>Is the collection unordered membership, unordered key-value lookup, or ordered key traversal?</li>
              <li>Is the hot update path doing one lookup or several?</li>
              <li>Does the boundary need denial-of-service resilience more than raw hash speed?</li>
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
            <h4 className="font-semibold text-foreground mb-3">{`HashMap<K, V> fundamentals`}</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Use <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">{`HashMap<K, V>`}</code> when
                  you want expected fast key lookup and update, and key order is not part of the external contract. Use{" "}
                  <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">{`HashSet<T>`}</code> when the
                  value is really membership and deduplication rather than key-value association.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Sets are not a secondary topic. In production code they often replace improvised boolean maps, duplicate
                  filtering passes, or repeated linear searches over vectors. If the question is “have I seen this key
                  already?”, a set is usually the right structure.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {traitRequirements.map((item) => (
                <div key={item.collection} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <code className="px-2 py-1 rounded bg-card font-mono text-xs text-foreground">{item.collection}</code>
                    <span className="text-xs uppercase tracking-[0.2em] text-primary">{item.requirement}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">{item.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Ownership of keys and values</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>
                    <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">insert</code> moves owned keys and
                    values into the collection.
                  </li>
                  <li>
                    <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">get</code> and{" "}
                    <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">contains</code> usually borrow.
                  </li>
                  <li>
                    <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">remove</code> moves the removed
                    value back out.
                  </li>
                  <li>
                    <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">iter</code> borrows;{" "}
                    <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">into_iter</code> consumes the
                    collection and moves items out.
                  </li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  That ownership story matters operationally. If your parser already produced an owned route key, the map
                  can take it directly. If your request path only has a borrowed `&str`, you can often look up by borrow
                  without allocating, but storing a new entry still requires some owned key to live in the table.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Borrowed lookups</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  One of Rust's best collection features is borrowed lookup. A{" "}
                  <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">{`HashMap<String, V>`}</code> can be
                  queried by <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">{"&str"}</code>. A{" "}
                  <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">{`HashSet<String>`}</code> can test
                  membership with <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">{"&str"}</code>.
                </p>
                <pre className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`let mut counts: HashMap<String, usize> = HashMap::new();
counts.insert(String::from("api"), 2);

assert_eq!(counts.get("api"), Some(&2));

let mut active: HashSet<String> = HashSet::new();
active.insert(String::from("worker"));
assert!(active.contains("worker"));`}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  This is usually what you want on the read path. Store owned strings once. Query them by borrowed slices.
                  That avoids allocating just to answer a membership or lookup question. For standard string keys, the
                  equality and hashing behavior line up the way you expect.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Entry API</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  The Entry API is the right tool when one key path does read-modify-write work: counters, last-seen
                  timestamps, aggregation, or “initialize if absent, then mutate.” It removes duplicate table lookups and
                  makes the intent obvious.
                </p>
                <pre className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`let slot = counts.entry(route).or_insert(0);
*slot += 1;`}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  There is one nuance worth keeping explicit: with ordinary stable std Entry APIs, the entry key itself is
                  owned. If your key path is a borrowed `&str`, `entry(route.to_owned())` still allocates the owned key.
                  That can still be the right design, but do not pretend the allocation disappeared. What disappeared is the
                  second hash-table lookup.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                The practical rule is simple: Entry is perfect when the caller already owns the key. Borrowed lookup is
                perfect when you only need to read. Treat those as two different fast paths.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Custom hashers</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  A standard library hash map has a third type parameter for the build hasher. In ordinary code you rarely
                  need to name it. The default choice uses randomized state and is a strong default for public or untrusted
                  inputs because collision behavior is part of your operational risk surface.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Faster non-randomized or domain-specific hashers can be a good fit for trusted internal workloads with
                  measured hot paths, especially when keys are small and frequent. But that is an engineering decision, not
                  a reflex. Benchmark first. Document the trust boundary. Keep security posture in view.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">{`BTreeMap vs HashMap`}</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">{`HashMap / HashSet`}</div>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>Expected fast lookup, insert, and membership checks.</li>
                  <li>No stable iteration order guarantee.</li>
                  <li>Good default for caches, counters, indexes, and dedup sets.</li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium text-foreground mb-2">{`BTreeMap / BTreeSet`}</div>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>Ordered keys and deterministic iteration.</li>
                  <li>Natural fit for sorted output and range-oriented logic.</li>
                  <li>Often simpler than “use HashMap, then sort later” when ordering is always required.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Stable ordering considerations</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  If operators, tests, logs, snapshots, or downstream systems care about output order, plain hash iteration
                  is the wrong boundary contract. Choose an ordered structure or sort at the render edge.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  A common production pattern is this: keep the hot mutable index in a{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">{`HashMap`}</code>, then project
                  into a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">{`BTreeMap`}</code> or a
                  sorted vector only when you emit deterministic output. If ordering is needed everywhere, start ordered.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Hashing performance and denial-of-service tradeoffs</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Hash cost is real work. Key size, equality cost, and cardinality all matter in hot paths.</li>
              <li>Collision behavior is also real work. Public endpoints should treat adversarial keys as part of the design.</li>
              <li>Ordered trees may win operationally when they remove a later sort pass or simplify deterministic behavior.</li>
              <li>
                Capacity planning still matters here too. Use{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">with_capacity</code> when the bound is
                real, not guessed.
              </li>
              <li>Benchmark workload shapes, not only microbenchmarks on one synthetic key distribution.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Comparison callout: translating prior instincts</h4>
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
                The collection choice is not only about asymptotic lookup speed. In real systems it also shapes ownership,
                determinism, test stability, memory pressure, and how resilient the service is to hostile key patterns.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Worked examples</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 1: owned key handoff plus Entry API</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  When the caller already owns the key, Entry is the clean update path: one table lookup, direct mutation,
                  and no extra duplicate logic.
                </p>
              </div>
              {codes.hash_maps_sets_entry_api !== DEFAULT_CODES.hash_maps_sets_entry_api && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("hash_maps_sets_entry_api")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.hash_maps_sets_entry_api}
              onChange={(newCode) => updateCode("hash_maps_sets_entry_api", newCode)}
              onRun={() => runCode("hash_maps_sets_entry_api")}
              output={outputs.hash_maps_sets_entry_api ?? null}
              isRunning={isRunning === "hash_maps_sets_entry_api"}
              filename="entry_api_owned_keys.rs"
              expectedOutput={"api = 2\nbilling = 1\nroutes = 2"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.hash_maps_sets_entry_api}
              onRevert={() => resetCode("hash_maps_sets_entry_api")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Operational model</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The route key is moved into the map. The returned entry reference mutates the stored counter in place.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Why this is calm</div>
                <p className="text-xs text-muted-foreground leading-5">
                  No duplicated `contains_key` branch, no second hash-table lookup, and no ambiguity about who owns the key.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 2: borrowed lookup for reads, ordered projection for output
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Store owned strings once. Query them by borrow. Project into an ordered structure only when stable render
                  order matters.
                </p>
              </div>
              {codes.hash_maps_sets_borrowed_lookup_ordered !== DEFAULT_CODES.hash_maps_sets_borrowed_lookup_ordered && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("hash_maps_sets_borrowed_lookup_ordered")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.hash_maps_sets_borrowed_lookup_ordered}
              onChange={(newCode) => updateCode("hash_maps_sets_borrowed_lookup_ordered", newCode)}
              onRun={() => runCode("hash_maps_sets_borrowed_lookup_ordered")}
              output={outputs.hash_maps_sets_borrowed_lookup_ordered ?? null}
              isRunning={isRunning === "hash_maps_sets_borrowed_lookup_ordered"}
              filename="borrowed_lookup_and_ordered_output.rs"
              expectedOutput={"api count = 2\nhas worker = true\nordered = api=2,billing=1,worker=3"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.hash_maps_sets_borrowed_lookup_ordered}
              onRevert={() => resetCode("hash_maps_sets_borrowed_lookup_ordered")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Borrowed read path</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">get("api")</code> and{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">contains("worker")</code> do not
                  need fresh owned strings.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Set semantics</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The set answers membership directly. There is no need for a parallel boolean map when membership is the only question.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Stable render</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Converting to a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">{`BTreeMap`}</code>{" "}
                  gives deterministic output without pretending hash iteration order was stable all along.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground leading-6">
            The repository also includes standalone Rust source under{" "}
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
              examples/ch11_hash_maps_and_sets/
            </code>{" "}
            so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
          </p>
        </div>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The exercise page asks you to remove duplicate lookups with the Entry API, implement borrowed lookups for
            `String` keys, compare `HashMap` and `BTreeMap` for deterministic output, and reason about hasher choices at
            production boundaries.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 11 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Maps and sets are ownership boundaries. Insert moves owned data in; lookups usually borrow.</li>
            <li>Borrowed lookup is one of the strongest Rust-native patterns for string-keyed indexes and membership sets.</li>
            <li>The Entry API removes duplicate table lookups on update paths, but ordinary stable entry still needs an owned key.</li>
            <li>`HashMap` and `HashSet` are about expected fast lookup; `BTreeMap` and `BTreeSet` are about ordered traversal and deterministic behavior.</li>
            <li>Hasher choice is a production tradeoff involving speed, key shape, and denial-of-service posture, not just a benchmark number.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
````

### File: `components/rust-book/pages/page-ch11-hash-maps-and-sets-exercises.tsx`
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
    title: "Choose map, set, or tree from the contract",
    objective: "Practice choosing `HashMap`, `HashSet`, `BTreeMap`, or `BTreeSet` from semantics rather than familiarity.",
    starterPrompt:
      "Pick one structure for each case: a request counter keyed by route, a dedup list of active feature flags, a config renderer that must emit stable sorted output, and an ordered allow-list that supports range-like prefix reviews.",
    prompts: [
      "Which workload is really key-value association?",
      "Which workload is only membership and deduplication?",
      "Which workload needs deterministic iteration order as part of the external contract?",
      "Which choice is about ordering rather than expected lookup speed?",
    ],
    acceptanceCriteria: [
      "You choose `HashMap` for the unordered key-value counter.",
      "You choose `HashSet` for membership and deduplication.",
      "You choose an ordered tree variant when stable sorted iteration is part of the boundary contract.",
      "You justify the structure in operational terms rather than only by naming the type.",
    ],
    hints: [
      "Ask whether order is part of the job before defaulting to a hash table.",
      "If the value is just “present or absent,” a set is usually the clearer structure.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Remove duplicate lookups with Entry API",
    objective: "Read a read-modify-write path and replace repeated lookup logic with a single-entry update path.",
    starterPrompt:
      "You inherit a counter update that does `contains_key`, then `get_mut`, then `insert` on the same `HashMap<String, usize>` key path. Refactor the logic conceptually before touching syntax.",
    prompts: [
      "What duplicate work is the original shape doing?",
      "Which `entry` helper best fits: `or_insert`, `or_default`, or `and_modify`?",
      "What changes if the caller already owns the key versus only borrows it?",
    ],
    acceptanceCriteria: [
      "You explain that the original code repeats key hashing and bucket lookup work.",
      "You choose an Entry API shape that expresses the update in one path.",
      "You call out the difference between an owned insert path and a borrowed read path precisely.",
    ],
    hints: [
      "Think in terms of “one key, one update path.”",
      "Entry API is especially valuable when mutation depends on presence or absence.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Implement borrowed lookup for owned string keys",
    objective: "Use borrowed lookup on a string-keyed map or set without allocating a fresh `String` on the read path.",
    starterPrompt:
      "Implement one or both helpers: `fn route_count(counts: &HashMap<String, usize>, route: &str) -> usize` and `fn is_active(active: &HashSet<String>, route: &str) -> bool`.",
    prompts: [
      "Keep the lookup parameter as `&str`.",
      "Do not allocate `route.to_string()` in the lookup path.",
      "Return a copied numeric result or a boolean result, not a borrowed reference from the helper.",
    ],
    acceptanceCriteria: [
      "The lookup parameter stays borrowed as `&str`.",
      "The implementation uses borrowed lookup such as `get(route)` or `contains(route)`.",
      "The helper does not allocate a fresh owned string just to read the collection.",
    ],
    hints: [
      "String-keyed maps and sets usually already support the borrowed lookup you want.",
      "The return type can stay small and owned even when the lookup itself borrows.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Make output deterministic on purpose",
    objective: "Repair a test or operator-facing render path that accidentally depends on hash iteration order.",
    starterPrompt:
      "A snapshot test iterates a `HashMap<String, usize>` directly and intermittently changes order across runs. Refactor the render path.",
    prompts: [
      "Should the internal storage stay hashed while the render path sorts or projects?",
      "Would `BTreeMap` be simpler if every caller wants stable order anyway?",
      "What tradeoff are you accepting between update behavior and output behavior?",
    ],
    acceptanceCriteria: [
      "You stop treating hash iteration order as stable.",
      "You propose either sorting at the boundary or using `BTreeMap` as the primary representation when order is always required.",
      "You justify the tradeoff in terms of contract clarity, not only test appeasement.",
    ],
    hints: [
      "Stable order is a data-structure choice or a render-step choice. Pick one deliberately.",
      "If the only place that needs order is output, a projection step is often enough.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Separate owned update paths from borrowed read paths",
    objective: "Explain the stable standard-library tradeoff between Entry API and borrowed string lookup.",
    starterPrompt:
      "You are counting borrowed request routes as `&str`. A teammate writes `counts.entry(route.to_string()).or_insert(0)`. Review whether that is correct, what it optimizes, and what it still costs.",
    prompts: [
      "What duplicate work does Entry remove?",
      "What cost remains on the borrowed string path?",
      "When is that still the right design, and when would you revisit it?",
    ],
    acceptanceCriteria: [
      "You explain that Entry removes duplicate table lookups on the update path.",
      "You explicitly note that `route.to_string()` still allocates an owned key.",
      "You describe at least one case where the design is acceptable and one case where the remaining allocation may matter enough to revisit.",
    ],
    hints: [
      "This is a good senior-level distinction: fewer lookups is not the same thing as zero allocation.",
      "Do not answer with slogans like “Entry is always faster.”",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose a hasher and threat model deliberately",
    objective: "Practice the performance-versus-resilience tradeoff behind custom hashers.",
    starterPrompt:
      "You are reviewing two systems: an internal analytics worker keyed by trusted numeric IDs, and an internet-facing API gateway keyed by client-controlled strings. Decide whether either should move away from the default hasher.",
    prompts: [
      "Which workload is trusted and measured enough to justify experimentation?",
      "Which workload should treat collision behavior as part of its threat model?",
      "What benchmark or observability data would you require before approving a hasher change?",
      "What documentation note belongs in the code review if the hasher changes?",
    ],
    acceptanceCriteria: [
      "You keep the public, attacker-controlled path conservative unless there is a very strong reason not to.",
      "You describe the trusted internal path as a candidate for measurement rather than automatic change.",
      "You name at least one production signal such as CPU profile, allocation profile, p99 latency, or collision-sensitive behavior.",
      "You document the trust boundary and tradeoff clearly.",
    ],
    hints: [
      "Hasher choice is partly a security decision and partly a performance decision.",
      "A faster internal benchmark is not enough if the public threat model changed underneath it.",
    ],
  },
]

const reviewQuestions = [
  "Why is `get(\"key\")` on a `HashMap<String, V>` often better than `get(&\"key\".to_string())`?",
  "What does the Entry API optimize, and what does it not magically optimize away?",
  "When is a `HashSet<T>` clearer than `HashMap<T, bool>`?",
  "Why is `HashMap` iteration order the wrong thing to rely on for stable output?",
  "What extra question appears the moment you consider a custom hasher on a public boundary?",
]

const workingLoop = [
  "State whether the operation is an owned update path or a borrowed read path.",
  "Ask whether ordering is part of the contract or only an output concern.",
  "Remove duplicate lookups before you chase smaller micro-optimizations.",
  "If hashing policy changes, document both the benchmark reason and the trust boundary.",
]

export function PageCh11HashMapsAndSetsExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = 21
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 11 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice choosing the right associative collection, separating owned updates from borrowed reads, and making
          determinism and hashing policy explicit rather than accidental.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a collection-design review. The answer is rarely just “use a map.” The better
                answer explains ownership of keys, read-path borrowing, update-path lookup count, and whether ordering or
                denial-of-service posture belongs in the contract.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(20)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 11
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
                  Associative collection drill
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
          title="Runnable lab · Entry update, borrowed lookup, stable render"
          description={
            <>
              Fix the starter so the owned update path uses the Entry API, the lookup path borrows{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">&str</code> directly, and the final
              render is deterministic through an ordered projection.
            </>
          }
          filename="hash_maps_lab.rs"
          runKey="ch11_ex_hash_maps_lab"
          expectedOutput={"api = Some(2)\nsorted = api=2,billing=1"}
          helperText={
            <>
              Tip: on stable standard-library APIs, Entry is the right tool for an owned-key update path. Borrowed lookup
              is the right tool for reads. The ordered render can be a{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">{`BTreeMap`}</code> projection.
            </>
          }
          initialCode={`use std::collections::{BTreeMap, HashMap};\n\nfn record_owned(counts: &mut HashMap<String, usize>, route: String) {\n    if counts.contains_key(&route) {\n        let next = counts[&route] + 1;\n        counts.insert(route, next);\n    } else {\n        counts.insert(route, 1);\n    }\n}\n\nfn lookup(counts: &HashMap<String, usize>, route: &str) -> Option<usize> {\n    counts.get(&route.to_string()).copied()\n}\n\nfn render_sorted(counts: &HashMap<String, usize>) -> String {\n    counts\n        .iter()\n        .map(|(route, count)| format!(\"{}={}\", route, count))\n        .collect::<Vec<_>>()\n        .join(\",\")\n}\n\nfn main() {\n    let mut counts = HashMap::new();\n    record_owned(&mut counts, String::from(\"api\"));\n    record_owned(&mut counts, String::from(\"billing\"));\n    record_owned(&mut counts, String::from(\"api\"));\n\n    println!(\"api = {:?}\", lookup(&counts, \"api\"));\n    println!(\"sorted = {}\", render_sorted(&counts));\n}`}
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
            By the end of this page, you should be able to read a map or set API in ownership terms, use Entry API where
            the key path is truly an update path, keep read paths allocation-light through borrowed lookup, and decide
            whether stable ordering or hasher policy belongs in the design rather than in an after-the-fact fix.
          </p>
        </section>
      </div>
    </div>
  )
}
````

### File: `examples/ch11_hash_maps_and_sets/entry_api_owned_keys.rs`
````
use std::collections::HashMap;

fn record_hit(counts: &mut HashMap<String, usize>, route: String) {
    let slot = counts.entry(route).or_insert(0);
    *slot += 1;
}

fn main() {
    let mut counts = HashMap::with_capacity(4);

    record_hit(&mut counts, String::from("api"));
    record_hit(&mut counts, String::from("api"));
    record_hit(&mut counts, String::from("billing"));

    println!("api = {}", counts.get("api").copied().unwrap_or(0));
    println!("billing = {}", counts.get("billing").copied().unwrap_or(0));
    println!("routes = {}", counts.len());
}
````

### File: `examples/ch11_hash_maps_and_sets/borrowed_lookup_and_ordered_output.rs`
````
use std::collections::{BTreeMap, HashMap, HashSet};

fn main() {
    let mut active = HashSet::new();
    active.insert(String::from("api"));
    active.insert(String::from("worker"));

    let mut counts = HashMap::new();
    counts.insert(String::from("worker"), 3);
    counts.insert(String::from("api"), 2);
    counts.insert(String::from("billing"), 1);

    let api_count = counts.get("api").copied().unwrap_or(0);
    let has_worker = active.contains("worker");

    let ordered: BTreeMap<_, _> = counts.into_iter().collect();
    let ordered_text = ordered
        .iter()
        .map(|(name, count)| format!("{}={}", name, count))
        .collect::<Vec<_>>()
        .join(",");

    println!("api count = {}", api_count);
    println!("has worker = {}", has_worker);
    println!("ordered = {}", ordered_text);
}
````