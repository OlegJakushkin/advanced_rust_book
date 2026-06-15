"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  Boxes,
  Compass,
  Database,
  Layers,
  Library,
  Map as MapIcon,
} from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { PAGES } from "../types"
import { Button } from "@/components/ui/button"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"

const whyReadThisPart = [
  {
    title: "Read ownership errors as design feedback",
    body: "Move, borrow, and lifetime diagnostics stop being obstacles and start being a checklist for who owns what and for how long. You learn to reshape the API instead of fighting the compiler.",
  },
  {
    title: "Choose the right container on purpose",
    body: "Vec, slice, HashMap, HashSet, and fixed arrays each encode a different ownership and layout decision. You leave able to justify each pick by lifetime, sharing, and access pattern rather than habit.",
  },
  {
    title: "Decide copy versus clone deliberately",
    body: "You learn when a value is cheap to copy, when a clone is a real allocation, and when the borrow checker is telling you to restructure rather than duplicate.",
  },
  {
    title: "Reach for smart pointers and unsafe with intent",
    body: "Box, Rc, Arc, and Pin become tools you select for a stated reason, and unsafe becomes a small, audited region with documented invariants rather than a panic button.",
  },
  {
    title: "Control data layout when it pays",
    body: "Matrices, multidimensional data, and arena allocation show how memory placement and lifetime grouping turn into measurable cache and throughput wins.",
  },
]

const chapters = [
  {
    number: 4,
    title: "Ownership, Borrowing, and Lifetimes",
    description: "The core contract: who owns a value, who may borrow it, and how long a reference is allowed to live.",
  },
  {
    number: 5,
    title: "Pointers, References, and Ownership Inside Structs",
    description: "Owned versus borrowed fields, pointer choices, and safe alternatives to self-referential layouts.",
  },
  {
    number: 6,
    title: "Pointers, References, and Ownership Inside Vectors",
    description: "How growth, reallocation, and element moves interact with ownership and outstanding borrows.",
  },
  {
    number: 7,
    title: "Copying Data vs Cloning Data",
    description: "When a value is a cheap bitwise copy, when a clone is a real allocation, and how to tell them apart.",
  },
  {
    number: 8,
    title: "Undefined Behavior and Unsafe Rust",
    description: "What the safe subset rules out, and how to confine unsafe to small regions with documented invariants.",
  },
  {
    number: 9,
    title: "Smart Pointers and Pinning",
    description: "Box, Rc, Arc, and Pin as deliberate tools for heap ownership, shared ownership, and stable addresses.",
  },
  {
    number: 10,
    title: "Arrays, Slices, and Vectors",
    description: "Fixed arrays, borrowed slices, and growable vectors as three points on the same ownership spectrum.",
  },
  {
    number: 11,
    title: "Hash Maps and Sets",
    description: "Keyed and unique collections, the entry API, and the ownership rules around keys and stored values.",
  },
  {
    number: 12,
    title: "Matrices and Multidimensional Data",
    description: "Laying out grids and tensors so access patterns stay cache-friendly instead of accidentally quadratic.",
  },
  {
    number: 13,
    title: "Arena Allocation and Region-Based Memory",
    description: "Grouping allocations by lifetime so whole regions free at once, trading flexibility for speed.",
  },
]

const flavorSnippet = `fn longest<'a>(left: &'a str, right: &'a str) -> &'a str {
    if left.len() >= right.len() { left } else { right }
}

fn main() {
    let title = String::from("ownership");
    let pick;
    {
        let other = String::from("layout");
        pick = longest(&title, &other); // borrow tied to 'other'
        println!("kept: {pick}");       // fine: 'other' still alive
    }
    // using pick here would not compile: 'other' has been dropped
}`

export function PagePart2MemoryOwnershipDataLayout() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("part-2-memory-ownership-data-layout")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  const partTitle = page?.title ?? "Memory, Ownership, and Data Layout"

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Layers className="h-4 w-4" />
          Part II
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{partTitle}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          The part you cannot skip: ownership, borrowing, lifetimes, smart pointers, and the containers you reach for
          every day are what make every later API in this book make sense.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground leading-6">
            This part is about how Rust models memory and who is responsible for it. Ownership, borrowing, and lifetimes
            are not a syntax tax bolted onto a normal language. They are the model the rest of Rust is built on. Once you
            can say plainly who owns a value, who is allowed to borrow it, and how long a reference may live, the type
            signatures in later chapters stop looking arbitrary and start reading like a contract.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-4">
            If you are coming from C++, much of this will rhyme with RAII and move semantics, except the compiler now
            checks the rules you used to enforce by review. From C# or Python, the shift is that destruction is
            deterministic and sharing is explicit, so the question of who frees a resource moves earlier and into the
            type. From Go, the lightweight instinct survives, but ambient trust around shared state does not: the
            ownership boundary becomes something you write down.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-4">
            The payoff is concrete. By the end you will pick the right container for a stated reason, decide between a
            cheap copy and a real clone without guessing, confine <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">unsafe</code>{" "}
            to small audited regions, and lay out data so the cache works with you rather than against you. Every API,
            trait, and async type later in the book leans on the mental model you build here.
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Why read this part</h3>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {whyReadThisPart.map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-card p-5">
                <div className="font-medium text-foreground mb-2">{item.title}</div>
                <p className="text-sm text-muted-foreground leading-6">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">The big idea in one picture</h3>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground leading-6 mb-2">
              Every value in this part sits somewhere on one spine: it has exactly one owner, that owner can lend out
              temporary borrows, and the choices you make about ownership ripple straight into which container fits and
              how the data is laid out in memory. The chapters move left to right along this spine.
            </p>
            <MermaidDiagram
              chart={`flowchart LR
  O[One owner per value] --> B[Borrow: temporary access]
  B --> S[Shared and ref<br/>Rc / Arc]
  B --> M[Exclusive mut]
  O --> C[Container choice]
  C --> V[Vec / slice / array]
  C --> H[HashMap / HashSet]
  C --> L[Layout and arenas]
  M --> L
  S --> L`}
              caption="One owner, borrows that describe temporary access, and the layout decisions those choices force. This part walks the spine from ownership to data layout."
            />
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground leading-6 mb-3">
                A taste of the flavor: a lifetime annotation ties the returned borrow to the inputs, and the compiler
                refuses to let the result outlive the data it points at.
              </p>
              <pre className="rounded-md bg-muted/40 px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{flavorSnippet}</code>
              </pre>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Chapters in this part</h3>
          </div>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {chapters.map((chapter) => (
              <div key={chapter.number} className="flex items-start gap-4 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                  {chapter.number}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-foreground">{chapter.title}</div>
                  <p className="text-sm text-muted-foreground leading-6 mt-0.5">{chapter.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Boxes className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Start with ownership</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 4 introduces the contract everything else in this part depends on: ownership, borrowing, and the
                lifetimes that keep references honest. Begin there, then follow the spine through containers and layout.
              </p>
            </div>
            <Button
              onClick={() => setCurrentPage(getPageIndexById("ch04-ownership-borrowing-and-lifetimes"))}
              className="gap-2 shrink-0"
            >
              <Database className="h-4 w-4" />
              Begin Part II
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
