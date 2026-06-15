"use client"

import { useEffect } from "react"
import { ArrowLeft, Lightbulb, Target, Trophy, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
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
      "Pick one structure for each case: a request counter keyed by route, a dedup list of active feature flags, a config renderer that must emit stable sorted output, and an ordered allow-list that supports prefix range queries.",
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
      "If the value is just 'present or absent,' a set is usually the clearer structure.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Remove duplicate lookups with Entry API",
    objective: "Read a read-modify-write path and replace repeated lookup logic with a single-entry update path.",
    starterPrompt:
      "You inherit a counter update that does `contains_key`, then indexes with `counts[&route]` to read the old value, then `insert` on the same `HashMap<String, usize>` key path. Refactor the logic conceptually before touching syntax.",
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
      "Think in terms of 'one key, one update path.'",
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
      "You justify the tradeoff in terms of contract clarity, not only making tests pass.",
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
      "Do not answer with slogans like `Entry is always faster.`",
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
  const pageIndex = getPageIndexById("ch11-hash-maps-and-sets-exercises")
  const mainPageIndex = getPageIndexById("ch11-hash-maps-and-sets")
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
                Treat each exercise as a collection-design review. The answer is rarely just &quot;use a map.&quot; The better
                answer explains ownership of keys, read-path borrowing, update-path lookup count, and whether ordering or
                denial-of-service posture belongs in the contract.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
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
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">{"&str"}</code> directly, and the
              final render is deterministic through an ordered projection.
            </>
          }
          filename="hash_maps_lab.rs"
          runKey="ch11_ex_hash_maps_lab"
          expectedOutput={"api = Some(2)\nsorted = api=2,billing=1"}
          helperText={
            <>
              Tip: on stable standard-library APIs, Entry is the right tool for an owned-key update path. Borrowed lookup
              is the right tool for reads. The ordered render can be a{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">{`BTreeMap`}</code> projection. Under the{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">{"&HashMap"}</code> signature, sort by
              collecting{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">{`counts.iter()`}</code> into a{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">{`BTreeMap<&String, &usize>`}</code>;{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">{`into_iter()`}</code> on a shared
              reference yields <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">{"(&K, &V)"}</code>{" "}
              pairs, not <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">{"(K, V)"}</code>.
            </>
          }
          initialCode={`use std::collections::{BTreeMap, HashMap};

fn record_owned(counts: &mut HashMap<String, usize>, route: String) {
    if counts.contains_key(&route) {
        let next = counts[&route] + 1;
        counts.insert(route, next);
    } else {
        counts.insert(route, 1);
    }
}

fn lookup(counts: &HashMap<String, usize>, route: &str) -> Option<usize> {
    counts.get(&route.to_string()).copied()
}

fn render_sorted(counts: &HashMap<String, usize>) -> String {
    counts
        .iter()
        .map(|(route, count)| format!("{}={}", route, count))
        .collect::<Vec<_>>()
        .join(",")
}

fn main() {
    let mut counts = HashMap::new();
    record_owned(&mut counts, String::from("api"));
    record_owned(&mut counts, String::from("billing"));
    record_owned(&mut counts, String::from("api"));

    println!("api = {:?}", lookup(&counts, "api"));
    println!("sorted = {}", render_sorted(&counts));
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
            By the end of this page, you should be able to read a map or set API in ownership terms, use Entry API where
            the key path is truly an update path, keep read paths allocation-light through borrowed lookup, and decide
            whether stable ordering or hasher policy belongs in the design rather than in an after-the-fact fix.
          </p>
        </section>
      </div>
    </div>
  )
}
