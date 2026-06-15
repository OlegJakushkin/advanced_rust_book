"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Network, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "Pointer choice is an ownership decision first",
    body: "In Rust, smart pointers are not a decorative layer over references. Each one encodes a different truth about ownership count, mutation discipline, thread boundaries, or address stability.",
  },
  {
    title: "Interior mutability moves the check somewhere else",
    body: "With ordinary borrowing, aliasing rules are enforced at compile time. With `Cell<T>`, `RefCell<T>`, or `Mutex<T>`, you are choosing a different enforcement model: whole-value replacement, runtime borrow checks, or synchronized locking.",
  },
  {
    title: "Pinning is about movement, not about sharing",
    body: "Pinning does not mean garbage collection, object identity, or magical heap permanence. It means the pointee must not be moved through that pinned handle once an address-sensitive invariant exists.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Your instincts mostly transfer, but the shift is that the pointer type is now a checked contract rather than a convention. The trap is reaching for shared ownership the way C++ codebases drift toward shared_ptr by default: in Rust, shared mutation is a separate, explicit decision, and the compiler will not let you alias mutably the way you could by accident before. Pinning is the genuinely new idea, because C++ never promised that a moved object kept its address.",
  },
  {
    title: "C# background",
    body: "The mental shift is that a reference is not an ownership statement. A managed reference says nothing about who frees the value or who may mutate it; in Rust the pointer type carries that, so you must answer ownership count and mutation authority up front instead of letting the runtime smooth it over. The trap is assuming a shared handle is automatically safe to mutate from several places, which the garbage-collected world let you ignore.",
  },
  {
    title: "Go background",
    body: "Go lets you share a pointer and hand it to a goroutine with almost no ceremony, leaving the ownership and data-race story to discipline and the race detector. The shift in Rust is that those questions move to compile time and into the type: one owner or many, one thread or many, plain borrow or synchronized. The trap is treating every shared value as an implicit Arc<Mutex<...>>, when Rust often wants you to choose message passing or a single owner instead.",
  },
  {
    title: "Python background",
    body: "Python hands you reference semantics and a cycle-collecting garbage collector for free, so you rarely think about who owns an object or when it dies. The shift is that Rust's reference counting (Rc and Arc) does not collect cycles, so a back-edge that keeps its parent alive will leak unless you make it a Weak. The trap is assuming the runtime will eventually clean up; here the ownership graph is something you design to stay acyclic.",
  },
]

const selectionGuide = [
  {
    need: "One owner, heap placement, recursive shape",
    fit: "Box<T>",
    note: "Use when the pointee should still have one clear owner but the outer value needs indirection or a fixed size.",
  },
  {
    need: "Many owners on one thread",
    fit: "Rc<T>",
    note: "Cheap non-atomic reference counting. Not `Send`. Not `Sync`.",
  },
  {
    need: "Many owners across threads",
    fit: "Arc<T>",
    note: "Atomic reference counting. Shared ownership only. It does not make the inner `T` safe to mutate without more design.",
  },
  {
    need: "Single-thread shared mutation with runtime checks",
    fit: "RefCell<T>",
    note: "Useful when the borrow pattern is real but too dynamic for compile-time borrowing. Violations panic at runtime.",
  },
  {
    need: "Single-thread tiny interior updates",
    fit: "Cell<T>",
    note: "Good for `Copy` values or whole-value replacement. Simpler than `RefCell<T>` when you do not need borrowed access to the interior.",
  },
  {
    need: "Cross-thread mutation under synchronization",
    fit: "Mutex<T>",
    note: "Represents exclusive access negotiated by locking. Contention, blocking, and lock scope now matter operationally.",
  },
  {
    need: "Non-owning back edge or cache observer",
    fit: "Weak<T>",
    note: "Break cycles by making non-owning relationships explicit. `upgrade()` tells you whether the owner still exists.",
  },
  {
    need: "Address-sensitive value that must not move",
    fit: "Pin<Box<T>> or Pin<&mut T>",
    note: "Use only when a real immovability invariant exists, such as future polling or another address-sensitive protocol.",
  },
]

const productionPatterns = [
  "Start with the simplest owner that tells the truth. Add reference counting, runtime borrow checks, or locking only when the domain model really has multiple owners or shared mutation.",
  "Treat `Arc<Mutex<T>>` as two decisions, not one habit: shared ownership plus synchronized exclusive mutation. Use it when both are semantically real.",
  "Use `Weak<T>` for parent pointers, listeners, caches, and graph back-edges so the ownership graph stays acyclic.",
  "Reach for `Cell<T>` when the interior update is small and local, `RefCell<T>` when dynamic single-thread borrowing is real, and `Mutex<T>` when the mutation truly crosses threads.",
  "Keep `Pin` near the boundary that requires it. Futures, executors, and some FFI or intrusive structures need it. Ordinary business structs usually do not.",
]

const pitfalls = [
  "Treating `Rc<RefCell<T>>` as the default substitute for object-oriented reference graphs. It can be correct, but it is a high-powered combination with runtime borrow failures and cycle risks.",
  "Assuming `Arc<T>` means the inner `T` is automatically safe for cross-thread mutation. Shared ownership and synchronized mutation are different concerns.",
  "Using `RefCell<T>` to avoid redesign and then discovering a runtime panic in production where compile-time borrowing would have caught the shape earlier.",
  "Forgetting `Weak<T>` in graphs with back-edges, then keeping objects alive forever through cycles.",
  "Thinking `Pin<Box<T>>` is just 'a box on the heap.' Heap allocation alone does not create the no-move guarantee. Pinning is the guarantee.",
  "Applying `Pin` too early. Most types are fine as ordinary movable values. Pinning should follow a concrete address-sensitive invariant, not anxiety.",
]

export function PageCh09SmartPointersAndPinning() {
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
  const pageIndex = getPageIndexById("ch09-smart-pointers-and-pinning")
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
          Chapter 09 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Smart pointers encode ownership count, mutation authority, thread sharing, and address stability. This chapter
          uses Box, Rc, Arc, Weak, interior mutability, and Pin as production design choices.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 05, 07, and 08</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 05 introduced ownership inside structs. Chapter 07 separated move, copy, and clone. Chapter 08
                explained why some low-level invariants matter enough to be audited explicitly. This chapter brings those
                threads together around the standard smart pointers and pinning model.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(8)}>
                Chapter 05
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(12)}>
                Chapter 07
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(14)}>
                Chapter 08
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A service combines recursive parser state, shared planning data, cross-thread schemas, mutable retry
            coordination, and pinned async work. The business requirement is to encode each ownership and movement rule in
            the pointer type: single owner, shared owner, synchronized mutation, non-owning back edge, or immovable state.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A good review order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>How many owners are semantically real: one or many?</li>
              <li>Is mutation local, runtime-checked, or synchronized across threads?</li>
              <li>Is a back-edge observing or owning?</li>
              <li>Does the value merely live on the heap, or must it actually stop moving?</li>
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
            <Wrench className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Box&lt;T&gt;</code>: heap ownership
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">Box&lt;T&gt;</code> means one owner
                  plus heap indirection. It does not imply sharing, reference counting, or interior mutability. It is the
                  right answer when the pointee should still have one owner but the outer type needs recursive shape, a
                  smaller stack footprint, or a stable-sized field.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6 mb-3">
                  What to look at: the box is a thin owning handle that lives wherever the field lives, while the pointee
                  it owns sits on the heap. That indirection is what lets a recursive type have a finite size, because the
                  field is one pointer wide no matter how deep the chain goes.
                </p>
                <MermaidDiagram
                  chart={`flowchart TD\n  subgraph Stack\n    H[Box handle]\n  end\n  subgraph Heap\n    N[Node data]\n    N -->|next: Option Box| N2[Node data]\n  end\n  H -->|owns, one owner| N`}
                  caption="A Box is a single owning pointer on the stack; the value it owns lives on the heap, which is what makes a recursive node a fixed-size field."
                />
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`struct Node {
    next: Option<Box<Node>>,
}`}</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  Think of it as owned heap storage, not as “shared pointer lite.”
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Rc&lt;T&gt;</code>: single-threaded
              shared ownership
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">Rc&lt;T&gt;</code> is shared
                  ownership inside one thread. Cloning an <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">Rc</code> adds another owner by incrementing a non-atomic count. Because the count is not atomic,
                  <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">Rc&lt;T&gt;</code> is not for thread
                  boundaries.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6 mb-3">
                  What to look at: several handles point at one allocation, and the allocation carries a count. Each clone
                  bumps the count; each drop lowers it; the value is freed only when the count reaches zero. The data
                  itself is shared and read-only through these handles.
                </p>
                <MermaidDiagram
                  chart={`flowchart TD\n  A[Rc handle a] --> V[(value, strong=3)]\n  B[Rc handle b] --> V\n  C[Rc handle c] --> V\n  V -.->|count hits 0| F[freed]`}
                  caption="Cloning an Rc adds an owner and raises the strong count; the allocation lives until the last owner drops and the count reaches zero."
                />
                <p className="text-sm text-muted-foreground leading-6">
                  If you later need shared mutation as well, that is a second decision. Many single-thread designs use{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Rc&lt;RefCell&lt;T&gt;&gt;</code>,
                  but you should read that type honestly: multiple owners plus runtime borrow checking.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Arc&lt;T&gt;</code>: thread-safe shared
              ownership
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">Arc&lt;T&gt;</code> is the
                  cross-thread sibling of <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">Rc&lt;T&gt;</code>.
                  The reference count is atomic, so cloning is safe across threads. The atomic work is usually modest, but
                  it is not free.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  The key correction is this: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Arc&lt;T&gt;</code>{" "}
                  solves ownership count, not arbitrary mutation safety. If multiple threads need mutation, add a second
                  mechanism such as a lock or redesign toward message passing. Also remember that thread use still depends
                  on the inner <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">T</code> satisfying the
                  relevant <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Send</code> and{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Sync</code> bounds.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Interior mutability: moving the borrow check somewhere else</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-2">
              What to look at: all three of the types below let you mutate through a shared handle, which ordinary
              borrowing forbids. The difference is purely where and how the aliasing rule is enforced. A{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Cell&lt;T&gt;</code> sidesteps borrowing
              by only swapping whole values, a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">RefCell&lt;T&gt;</code>{" "}
              keeps the same rule but checks it at runtime and panics on violation, and a{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Mutex&lt;T&gt;</code> enforces it across
              threads by blocking on a lock.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="font-semibold text-foreground mb-3">
                <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">RefCell&lt;T&gt;</code>: runtime borrow
                checking
              </h4>
              <p className="text-sm text-muted-foreground leading-6">
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">RefCell&lt;T&gt;</code> lets shared
                owners borrow mutably at runtime. The same borrowing law still exists, but violations become runtime
                panics instead of compile-time errors. That is useful in single-thread graphs, UI trees, and other
                genuinely dynamic borrow patterns. It is also a tradeoff you should feel.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="font-semibold text-foreground mb-3">
                <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Cell&lt;T&gt;</code> and interior
                mutability
              </h4>
              <p className="text-sm text-muted-foreground leading-6">
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Cell&lt;T&gt;</code> is the smaller,
                calmer interior-mutability tool when you only need to copy out, replace, or swap values. It works well for
                counters, flags, and small cached scalars in one thread. Unlike{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">RefCell&lt;T&gt;</code>, it does not
                hand out interior references.
              </p>
              <pre className="mt-3 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{`use std::cell::Cell;

struct ParserStats {
    lines_seen: Cell<u64>,
}`}</code>
              </pre>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="font-semibold text-foreground mb-3">
                <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Mutex&lt;T&gt;</code>: ownership under
                synchronization
              </h4>
              <p className="text-sm text-muted-foreground leading-6">
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Mutex&lt;T&gt;</code> provides
                interior mutability by handing out exclusive access only after lock acquisition. It is the shared-state
                sibling of ordinary exclusive borrowing. Lock scope, contention, poisoning policy, and deadlock risk are
                now operational concerns.
              </p>
              <pre className="mt-3 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{`use std::sync::{Arc, Mutex};

let counter = Arc::new(Mutex::new(0u64));`}</code>
              </pre>
            </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Weak&lt;T&gt;</code> and cyclic references
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Reference counting alone cannot collect cycles. If parent owns child and child also owns parent through a
                  strong <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">Rc</code> or{" "}
                  <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">Arc</code>, neither side reaches a
                  strong count of zero. The usual repair is simple: owning edges stay strong, observational back-edges
                  become weak.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  A <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Weak&lt;T&gt;</code> does not keep
                  the allocation alive. Calling <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">upgrade()</code>{" "}
                  returns <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Option&lt;Rc&lt;T&gt;&gt;</code>{" "}
                  or <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Option&lt;Arc&lt;T&gt;&gt;</code>,
                  which forces you to handle the “owner already gone” case explicitly.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="font-semibold text-foreground mb-3">
                <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Pin&lt;T&gt;</code> and immovable values
              </h4>
              <p className="text-sm text-muted-foreground leading-6">
                Pinning matters when moving a value would break an address-sensitive invariant. The classic example is
                future polling: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Future::poll</code>{" "}
                takes <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Pin&lt;&mut Self&gt;</code>. The
                compiler can generate state machines whose internal references assume the future stays put while polled.
              </p>
              <p className="mt-3 text-sm text-muted-foreground leading-6">
                Pinning does not stop all mutation. It stops moves that would invalidate the address-sensitive part of the
                invariant. For most ordinary types, this distinction does not matter because they are effectively movable
                and implement <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Unpin</code>.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="font-semibold text-foreground mb-3">
                <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Pin&lt;Box&lt;T&gt;&gt;</code> and{" "}
                <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Pin&lt;&mut T&gt;</code>
              </h4>
              <p className="text-sm text-muted-foreground leading-6">
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Pin&lt;Box&lt;T&gt;&gt;</code> means
                you own the value and pin the pointee in its heap allocation. This is common when storing futures you want
                to poll later. <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Pin&lt;&mut T&gt;</code>{" "}
                is the temporary pinned view used when actually operating on the pinned value.
              </p>
              <p className="mt-3 text-sm text-muted-foreground leading-6">
                The sharp edge is projection. For <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">!Unpin</code>{" "}
                types, you cannot casually recover a plain <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&mut T</code>{" "}
                because that would re-enable movement. Later async and unsafe chapters revisit this with deeper machinery.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Choosing the right pointer type</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-2">
              What to look at: the choice is a short series of independent questions, not a single menu pick. Answer them
              in order, and the type usually falls out. How many owners are real? If many, do they live on one thread or
              cross thread boundaries? Does anything need to mutate the shared value, and if so, is the borrow pattern
              static enough for the compiler or dynamic enough to need a runtime check or a lock? Only at the end do you
              ask whether the value must also stop moving.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Start[Need indirection or sharing] --> Owners{How many owners}\n  Owners -->|one| Box[Box T]\n  Owners -->|many| Threads{One thread or many}\n  Threads -->|one thread| Rc[Rc T]\n  Threads -->|many threads| Arc[Arc T]\n  Box --> Move{Must it stop moving}\n  Move -->|yes| Pin[Pin Box T]\n  Rc --> Cont[shared mutation, continues below]\n  Arc --> Cont`}
              caption="First the ownership questions: how many owners, and if many, do they cross thread boundaries. A single owner picks Box, and only Box faces the separate question of whether the value must stop moving."
            />
            <p className="text-sm text-muted-foreground leading-6">
              Once owner count and thread boundary are settled, the remaining question is whether the shared value also
              needs mutation, and under which enforcement model:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Cont[shared mutation needed] --> Rc[shared on one thread, Rc T]\n  Cont --> Arc[shared across threads, Arc T]\n  Rc --> Mut1{Borrow pattern}\n  Mut1 -->|small copy or swap| Cell[wrap in Cell]\n  Mut1 -->|dynamic borrows| RefCell[wrap in RefCell]\n  Arc --> Mut2{Need shared mutation}\n  Mut2 -->|yes| Mutex[wrap in Mutex]`}
              caption="The second half resolves shared mutation: a single-thread Rc reaches for Cell or RefCell depending on the borrow pattern, while a cross-thread Arc reaches for a Mutex."
            />
            <div className="grid gap-3 lg:grid-cols-2">
              {selectionGuide.map((item) => (
                <div key={item.need} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">{item.fit}</div>
                  <div className="font-medium text-foreground mb-2">{item.need}</div>
                  <p className="text-sm text-muted-foreground leading-6">{item.note}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A useful correction for senior engineers is this: pointer choice is often two or three independent
                questions layered together. <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Arc&lt;Mutex&lt;T&gt;&gt;</code>{" "}
                means shared ownership and synchronized mutation.{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Rc&lt;RefCell&lt;T&gt;&gt;</code>{" "}
                means shared ownership and runtime borrow checking on one thread. Read the composition literally.
              </p>
            </div>
          </div>

        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How this lands by background</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            Most senior engineers do not meet smart pointers as a blank slate; they arrive with a pointer model from
            another language. The useful thing to know is which part of that model carries over and which part will
            quietly mislead you. The shift is almost never about which type maps to which library class. It is about the
            fact that ownership count, mutation authority, and address stability now live in the type and are checked,
            rather than being left to convention or a runtime.
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
                Smart pointers are not escape hatches from ownership design. They are ownership design written into the
                type. If the type looks complicated, the runtime story is probably complicated too.
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
                <h4 className="font-semibold text-foreground">Example 1: shared tree edges with weak back-references</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The children are strongly owned. The parent edge is weak, so the graph stays acyclic.
                </p>
              </div>
              {codes.smart_pointers_tree !== DEFAULT_CODES.smart_pointers_tree && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("smart_pointers_tree")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the two edges between root and leaf are deliberately different kinds. The root owns the
              leaf through a strong <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Rc</code> in its
              children list, while the leaf only observes the root through a{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Weak</code> parent pointer. Trace the
              two arrows in the diagram, then notice that the leaf reads its parent through{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">upgrade()</code>, which can fail if the
              owner is already gone. That asymmetry is what keeps the graph acyclic and lets the count actually reach
              zero.
            </p>
            <MermaidDiagram
              chart={`flowchart LR\n  Root[root Rc] -->|strong: owns child| Leaf[leaf Rc]\n  Leaf -.->|weak: observes via upgrade| Root\n  Note[strong edge keeps alive, weak edge does not]`}
              caption="Owning edges stay strong and point down the tree; the back-edge to the parent is weak, so no cycle pins the allocation alive."
            />
            <RustCodeEditor
              code={codes.smart_pointers_tree}
              onChange={(newCode) => updateCode("smart_pointers_tree", newCode)}
              onRun={() => runCode("smart_pointers_tree")}
              output={outputs.smart_pointers_tree ?? null}
              isRunning={isRunning === "smart_pointers_tree"}
              filename="rc_weak_tree.rs"
              expectedOutput={"root children = 1\nleaf parent = root\nroot strong = 1"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.smart_pointers_tree}
              onRevert={() => resetCode("smart_pointers_tree")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: change the node names or add another child. The useful signal is not the printout itself. It
              is that the ownership graph reads clearly from the types: strong edges own, weak edges observe.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Why this design stays healthy</div>
                <p className="text-xs text-muted-foreground leading-5">
                  A child can discover its parent only by upgrading a weak pointer. The parent is not kept alive by the
                  child.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Production translation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Trees, observer lists, dependency graphs, and cache indexes often need one-way ownership plus
                  non-owning lookup edges.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: polling a pinned future with Box::pin</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The example is deliberately small so you can see both forms: owned pinned storage and a pinned mutable
                  view during polling.
                </p>
              </div>
              {codes.smart_pointers_pin_poll !== DEFAULT_CODES.smart_pointers_pin_poll && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("smart_pointers_pin_poll")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Box::pin</code> creates
              the owned, pinned storage once, and then the loop polls it repeatedly through{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">as_mut()</code>, which hands{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">poll</code> the{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Pin&lt;&amp;mut Self&gt;</code> it
              requires. Each poll either reports it is still pending and yields, or returns a ready value and ends the
              loop. Follow that one-future, two-exits cycle in the diagram, then read the same shape in the match arms.
            </p>
            <MermaidDiagram
              chart={`stateDiagram-v2\n  [*] --> Pinned: Box pin creates owner\n  Pinned --> Poll: as_mut gives Pin and mut Self\n  Poll --> Pending: not done yet\n  Pending --> Poll: poll again\n  Poll --> Ready: value produced\n  Ready --> [*]: break loop`}
              caption="One pinned future is polled in a loop; each poll yields Pending and repeats, or yields Ready and exits. The pin stays fixed across every poll."
            />
            <RustCodeEditor
              code={codes.smart_pointers_pin_poll}
              onChange={(newCode) => updateCode("smart_pointers_pin_poll", newCode)}
              onRun={() => runCode("smart_pointers_pin_poll")}
              output={outputs.smart_pointers_pin_poll ?? null}
              isRunning={isRunning === "smart_pointers_pin_poll"}
              filename="pin_box_and_poll.rs"
              expectedOutput={"pending = 1\npending = 0\nready = done"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.smart_pointers_pin_poll}
              onRevert={() => resetCode("smart_pointers_pin_poll")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: increase the starting count and rerun. The visible behavior changes, but the structural point
              stays the same: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Box::pin</code> gives
              you a pinned owner, and <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">as_mut()</code>{" "}
              produces the pinned mutable view required by polling.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">What is pinned here</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The pointee inside the box, not the box handle itself, is the thing treated as immovable for the poll
                  protocol.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Why futures use Pin</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The poll API must be safe for compiler-generated state machines whose internal layout may rely on a
                  stable address while the future is alive.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch09_smart_pointers_and_pinning/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The exercise page asks you to choose pointer types for realistic scenarios, replace an owning cycle with{" "}
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Weak</code>, distinguish{" "}
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Cell</code>,{" "}
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">RefCell</code>, and{" "}
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Mutex</code>, and explain why async
            futures are commonly manipulated through pinned pointers.
          </p>
          <Button onClick={() => setCurrentPage(17)} className="gap-2">
            Open Chapter 09 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Choose smart pointers by ownership truth: one owner, many owners, one thread, many threads, movable, or pinned.</li>
            <li>
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Box&lt;T&gt;</code>,{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Rc&lt;T&gt;</code>, and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Arc&lt;T&gt;</code> answer ownership-count and thread questions, not arbitrary mutation questions.
            </li>
            <li>
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Cell&lt;T&gt;</code>,{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">RefCell&lt;T&gt;</code>, and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Mutex&lt;T&gt;</code> are different interior-mutability contracts with different enforcement costs.
            </li>
            <li>
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Weak&lt;T&gt;</code> is the standard
              repair for non-owning back-edges in reference-counted graphs.
            </li>
            <li>
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Pin</code> matters only when movement
              itself would break correctness. Heap allocation alone is not the same thing.
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
