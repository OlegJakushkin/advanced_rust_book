"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Network, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
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
    body: "Your instinct is that the map stores values and you reach in with operator[] or find. The shift in Rust is that insert moves the key in, so the table now owns it, and lookup goes the other way: you query an owned-string table with a borrowed slice and never allocate to ask a question. There is no silent default-construct-on-missing-key; the entry API is the explicit version of that idea, and it hands you exactly one path into the slot.",
  },
  {
    title: "C# background",
    body: "Dictionary and HashSet feel familiar, but the GC has been hiding the ownership question. In Rust, putting a string key in moves it, reading is a borrow, and removing hands the value back to you. The other shift is determinism: a .NET dictionary's enumeration order is unspecified and so is Rust's, but Rust makes you choose an ordered structure on purpose rather than discovering the dependency in a failing snapshot test.",
  },
  {
    title: "Go background",
    body: "A Go map is the obvious default and its iteration order is deliberately randomized, so you already know not to depend on it. Rust keeps that discipline and adds one question Go never forces: after this insert, who owns the key and the value? The payoff is borrowed lookup, the thing Go cannot express cleanly, where you query a map of owned strings with a string slice and pay nothing to do it.",
  },
  {
    title: "Python background",
    body: "A dict or set takes anything hashable and you never think about who holds the object. Rust splits that into two facts you now state explicitly: the key type must be Eq plus Hash, and the table owns the keys you put in. The upside is that the same map answers reads through a borrowed &str without building a new key object, which is the allocation Python quietly performs every time you index by a fresh string.",
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
  const chapter12PageIndex = getPageIndexById("ch12-matrices-and-multidimensional-data")
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
          Hash maps and sets sit on critical lookup paths. This chapter covers key ownership, borrowed lookup, entry-based
          updates, deterministic output, and hashing policy for production data access.
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
            An ingress service maintains route counters, active feature flags, in-memory indexes, and deterministic
            operator-facing configuration dumps. The business requirement is explicit key ownership and lookup policy:
            own normalized keys in collections, borrow for read paths, update with one table access, and choose ordered
            structures when output order is contractual.
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
            <h4 className="font-semibold text-foreground mb-3">{`HashMap<K, V> and HashSet<T> fundamentals`}</h4>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The whole API divides cleanly along one line: which calls move data across the table boundary and which only
              borrow across it. Insert is the one inbound move; remove and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">into_iter</code> are the outbound moves;
              everything on the read path borrows and leaves the table owning what it owned before. Hold that picture and
              the rest of the chapter is mostly choosing the right edge for each call site.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Caller[Caller owns key and value] -->|insert moves in| Map[(HashMap owns entries)]\n  Map -->|get and contains borrow| Read[Read path keeps borrow]\n  Map -->|iter borrows| Loop[Borrowed iteration]\n  Map -.->|outbound moves| Cont[See outbound diagram below]`}
              caption="Inbound: insert moves owned data in; read paths borrow and leave ownership where it was."
            />
            <p className="text-sm text-muted-foreground leading-6">
              The same table also has two paths that move data back out:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Cont[(HashMap owns entries)] -->|remove moves out| Out[Caller owns value again]\n  Cont -->|into_iter consumes| Drain[Table consumed, items moved out]`}
              caption="Outbound: remove moves one value back out; into_iter consumes the table and moves every item out."
            />
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The reason a table of owned <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">String</code>{" "}
              keys accepts a borrowed <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">{"&str"}</code>{" "}
              query is a small trait relationship rather than magic: the lookup methods are generic over a borrowed form of
              the key, and <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">String</code> can be borrowed
              as <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">str</code> with matching equality and
              hashing. The diagram shows that bridge; the code below is what it looks like at the call site.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Q["&str query"] -->|same Eq and Hash| Bridge["Borrow bridge: String borrows as str"]\n  Bridge --> Slot["Owned String key in table"]\n  Slot -->|match| Hit["Some borrowed value"]\n  Slot -->|no match| Miss[None]`}
              caption="The query type and the stored key share equality and hashing through a borrow relationship, so no owned key is built to look one up."
            />
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
                  <code className="font-mono text-foreground">{`use std::collections::{HashMap, HashSet};

let mut counts: HashMap<String, usize> = HashMap::new();
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The choice between the four collections is two yes-or-no questions, not a performance debate. First: do you
              need a value per key, or only membership? That picks map versus set. Second: does anything downstream depend
              on iteration order? That picks the hashed variant versus the ordered B-tree variant. Answer those two and the
              type falls out.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Start[What do you store] -->|value per key| Map[Need a map]\n  Start -->|only membership| Set[Need a set]\n  Map -->|order matters| BMap[BTreeMap]\n  Map -->|order does not matter| HMap[HashMap]\n  Set -->|order matters| BSet[BTreeSet]\n  Set -->|order does not matter| HSet[HashSet]`}
              caption="Two questions decide the collection: value-per-key versus membership, then ordered iteration versus not."
            />
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

        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How this lands by background</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            Every one of these languages gives you a dictionary and a set, so the data structure is not the new part. What
            changes in Rust is who owns the key after you insert it, and the fact that reading does not have to build a key
            at all. The cards below name the one mental-model shift each background tends to trip over, not the API spelling,
            which you can read off the standard library in a minute.
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
                The collection choice is not only about asymptotic lookup speed. In real systems it also shapes ownership,
                determinism, test stability, memory pressure, and how resilient the service is to hostile key patterns.
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at:{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">entry(route)</code> is a single trip into
              the table. If the slot is missing it is created with{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">or_insert(0)</code>; either way you get a
              mutable reference and add one in place. There is no separate{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">contains_key</code> branch and no second
              lookup. Follow the two paths in the diagram, then read the same fork in{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">record_hit</code>.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Call[record_hit with owned route] --> Entry[entry on one lookup]\n  Entry -->|key present| Found[Existing counter]\n  Entry -->|key absent| New[or_insert 0 creates slot]\n  Found --> Bump[Add one in place]\n  New --> Bump\n  Bump --> Store[Stored count updated]`}
              caption="Both the present and absent cases converge on one mutable reference, so the update is a single table access."
            />
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
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Why one lookup is enough</div>
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: this is a pipeline with three distinct stages. The reads in the middle,{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">get("api")</code> and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">contains("worker")</code>, borrow the
              owned-string keys without allocating. Only at the render edge does{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">into_iter().collect()</code> move the
              entries into a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">BTreeMap</code> so output
              is deterministic. The diagram is that pipeline; the three printed lines are its three outputs.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Build[Insert owned String keys] --> HMap[(HashMap and HashSet)]\n  HMap -->|borrowed &str reads| Reads[api count and has worker]\n  HMap -->|into_iter collect| BMap[(BTreeMap, ordered)]\n  BMap --> Render[Deterministic ordered line]`}
              caption="Build with owned keys, read by borrow, and only convert to an ordered structure at the moment output order has to be stable."
            />
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

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Next chapter</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Hashed and ordered associative collections cover keyed access. Chapter 12 turns to matrices and
                multidimensional data, where the question shifts from who owns a key to how a logical grid maps onto one
                contiguous block of memory. The same ownership and borrowing instincts carry over; the new concern is
                layout, indexing, and the cost of the access pattern.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(chapter12PageIndex)} className="gap-2 shrink-0">
              Continue to Chapter 12
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
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
