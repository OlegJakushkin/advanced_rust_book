"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
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
    body: "`Box<T>` is closer to `std::unique_ptr<T>` than to a general smart-pointer hierarchy. `Rc<T>` resembles `shared_ptr<T>` for one thread. `Pin<T>` is the unusual piece: it is an address-stability promise, not merely heap allocation.",
  },
  {
    title: "C# background",
    body: "Managed references are not ownership declarations. Rust makes ownership count explicit. `Arc<T>` is shared ownership, `Mutex<T>` is synchronized mutation, and `Pin<T>` appears when runtime-managed movement can no longer be assumed away.",
  },
  {
    title: "Go background",
    body: "Go makes pointer sharing and goroutine handoff easy to express, but much of the ownership story stays implicit. Rust forces the question earlier: one owner or many, one thread or many, compile-time borrowing or runtime synchronization, movable or pinned.",
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

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">translating prior instincts</h4>
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
````

### File: `components/rust-book/pages/page-ch09-smart-pointers-and-pinning-exercises.tsx`
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
    title: "Choose the pointer before the syntax",
    objective: "Practice selecting `Box`, `Rc`, `Arc`, `Cell`, `RefCell`, `Mutex`, `Weak`, or `Pin` from the ownership story.",
    starterPrompt:
      "Pick the right type for each case: a recursive AST owned by one parent, a UI template shared in one thread, a schema shared across workers, a tiny single-thread hit counter, a graph back-edge, and a future stored for later polling.",
    prompts: [
      "Which cases are ownership-count questions?",
      "Which cases are mutation-discipline questions?",
      "Which case is really about stable address rather than sharing?",
    ],
    acceptanceCriteria: [
      "You choose `Box<T>` for the recursive single-owner case.",
      "You distinguish `Rc<T>` from `Arc<T>` by thread boundary, not by personal taste.",
      "You choose `Cell<T>`, `RefCell<T>`, or `Mutex<T>` based on mutation and enforcement model.",
      "You identify `Weak<T>` as the non-owning edge and `Pin<...>` as the immovability tool.",
    ],
    hints: [
      "Start with one owner versus many owners.",
      "Then ask whether the mutation is single-thread local, runtime-checked, or synchronized.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Read the failure mode from the type combination",
    objective: "Diagnose what can go wrong in `Rc<RefCell<T>>`, `Arc<T>`, and `Arc<Mutex<T>>` without hand-waving.",
    starterPrompt:
      "Review three snippets: `Rc<RefCell<State>>` that panics at runtime, `Arc<RefCell<State>>` that fails at a thread boundary, and `Arc<Mutex<State>>` that compiles but may contend heavily.",
    prompts: [
      "Which failure is a runtime borrow violation?",
      "Which failure is a trait-bound or thread-safety issue?",
      "Which case compiles but still deserves operational scrutiny because locks are now real work?",
    ],
    acceptanceCriteria: [
      "You identify the runtime panic risk in `RefCell<T>` correctly.",
      "You explain why `Arc<RefCell<T>>` is usually wrong across threads.",
      "You describe `Arc<Mutex<T>>` as shared ownership plus synchronized mutation, not as a generic fix-all.",
    ],
    hints: [
      "The type tells you where the check moved: compile time, runtime, or lock acquisition.",
      "Compiling is not the same thing as being the cheapest operational design.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Break the parent cycle with Weak",
    objective: "Replace an owning back-edge with a non-owning one and explain why the strong count stays healthy.",
    starterPrompt:
      "Implement a parent pointer for a small tree node so the child can observe its parent without keeping the parent alive.",
    prompts: [
      "Keep children strongly owned.",
      "Make the parent edge non-owning.",
      "Explain what `upgrade()` returning `None` would mean.",
    ],
    acceptanceCriteria: [
      "The parent edge uses `Weak<T>` rather than another strong `Rc<T>` or `Arc<T>`.",
      "You explain that `upgrade()` reflects whether an owning pointer still exists.",
      "You can state why the ownership graph is now acyclic.",
    ],
    hints: [
      "The question is not whether the child may refer to the parent. The question is whether that reference is owning.",
      "Back-edges in trees are usually observational, not owning.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Choose Cell, RefCell, or Mutex on purpose",
    objective: "Repair a design that picked the wrong interior-mutability tool for three different fields.",
    starterPrompt:
      "A parser uses `Mutex<u64>` for a tiny single-thread counter, `Cell<Vec<u8>>` for a borrowed scratch buffer, and `RefCell<HashMap<...>>` inside cross-thread shared state. Refactor each field to a better fit.",
    prompts: [
      "Which field only needs copy-or-replace behavior?",
      "Which field needs borrowed interior access in one thread?",
      "Which field crosses threads and therefore needs synchronized mutation or a redesign?",
    ],
    acceptanceCriteria: [
      "You move the scalar counter toward `Cell<T>` or ordinary mutation where appropriate.",
      "You choose `RefCell<T>` only for single-thread dynamic borrowing.",
      "You move cross-thread shared mutation to a synchronization primitive or a clearer ownership boundary.",
    ],
    hints: [
      "Do not ask which type is most powerful. Ask which contract is smallest and still true.",
      "A lock around everything is often a smell before it is a solution.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Review an Arc<Mutex<...>> proposal like an engineer, not a slogan",
    objective: "Decide whether shared mutable state is semantically real or whether message passing would be cleaner.",
    starterPrompt:
      "A teammate proposes one global `Arc<Mutex<HashMap<String, JobState>>>` for a retry service with network workers, a scheduler, and a metrics thread. Review the design.",
    prompts: [
      "What parts of the state are truly shared and mutable?",
      "Which operations might contend or hold the lock too long?",
      "Could some updates become owned messages instead of broad shared mutation?",
      "What observability would you add to validate the choice in production?",
    ],
    acceptanceCriteria: [
      "You justify at least one place where locking is semantically valid or one place where it is too broad.",
      "You name contention or lock-scope risks explicitly.",
      "You propose either message passing, sharding, or a narrower shared state design where appropriate.",
      "You mention at least one production signal such as lock timing, queue depth, or throughput.",
    ],
    hints: [
      "The first question is not 'can this compile?' It is 'what is actually shared here?'",
      "A single global lock often hides several different state domains.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Explain why async futures may require pinning",
    objective: "Make the pinning story operational instead of mystical.",
    starterPrompt:
      "You are reviewing an API that stores futures in a collection and polls them later. Explain why the code often uses `Pin<Box<F>>` and why `poll` takes `Pin<&mut Self>`.",
    prompts: [
      "What invariant would movement break?",
      "Why is heap allocation alone not the full answer?",
      "When does pinning become irrelevant because a type is effectively movable?",
    ],
    acceptanceCriteria: [
      "You explain that pinning protects an address-sensitive invariant rather than merely 'making async work.'",
      "You distinguish `Box<T>` from `Pin<Box<T>>` clearly.",
      "You mention that many ordinary types are fine because they are `Unpin`.",
      "You state that `Pin<&mut T>` is the operating view used by polling APIs.",
    ],
    hints: [
      "Start from the `poll` signature. Rust is telling you what the protocol requires.",
      "The useful comparison is movement versus no movement, not stack versus heap.",
    ],
  },
]

const reviewQuestions = [
  "When is `Box<T>` the right answer even though sharing is not involved at all?",
  "Why is `Rc<T>` rejected at thread boundaries while `Arc<T>` is accepted only conditionally?",
  "What makes `Cell<T>` smaller and calmer than `RefCell<T>` for some fields?",
  "Why does `Weak<T>` belong on observational back-edges?",
  "What problem does `Pin<T>` solve that plain heap allocation does not solve by itself?",
]

const workingLoop = [
  "Count owners first, then talk about mutation.",
  "State whether the pointer crosses a thread boundary before choosing `Rc<T>` or `Arc<T>`.",
  "If mutation hides behind interior mutability, say where the enforcement moved: replace, runtime borrow, or lock.",
  "If pinning appears, name the address-sensitive invariant before you accept the type.",
]

export function PageCh09SmartPointersAndPinningExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = 17
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 09 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice choosing pointer types deliberately, keeping ownership graphs healthy, and explaining pinning in
          operational terms instead of folklore.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as an ownership review. The question is not which pointer is most advanced. The
                question is which pointer tells the truth about ownership count, mutation, threads, and movement with the
                least accidental power.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(16)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 09
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
                  Pointer design drill
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
          title="Runnable lab · Break the parent edge with Weak"
          description={
            <>
              Fix the starter so the child keeps a non-owning parent reference. The checker expects the root to keep a{" "}
              strong count of <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">1</code> and the parent
              upgrade to succeed.
            </>
          }
          filename="weak_parent_lab.rs"
          runKey="ch09_ex_weak_parent"
          expectedOutput={"root strong = 1\nleaf parent upgrade = true"}
          helperText={
            <>
              Tip: keep the child edge observing, not owning. The change is a downgrade, not another clone.
            </>
          }
          initialCode={`use std::cell::RefCell;\nuse std::rc::{Rc, Weak};\n\nstruct Node {\n    parent: RefCell<Weak<Node>>,\n    children: RefCell<Vec<Rc<Node>>>,\n}\n\nfn main() {\n    let root = Rc::new(Node {\n        parent: RefCell::new(Weak::new()),\n        children: RefCell::new(Vec::new()),\n    });\n\n    let leaf = Rc::new(Node {\n        parent: RefCell::new(Weak::new()),\n        children: RefCell::new(Vec::new()),\n    });\n\n    root.children.borrow_mut().push(Rc::clone(&leaf));\n    *leaf.parent.borrow_mut() = Weak::new();\n\n    println!(\"root strong = {}\", Rc::strong_count(&root));\n    println!(\"leaf parent upgrade = {}\", leaf.parent.borrow().upgrade().is_some());\n}`}
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
            By the end of this page, you should be able to explain why a given design wants `Box`, `Rc`, `Arc`,
            `Cell`, `RefCell`, `Mutex`, `Weak`, or `Pin`, describe the operational cost of that choice, and defend the
            choice in terms another senior engineer can review quickly.
          </p>
        </section>
      </div>
    </div>
  )
}
````

### File: `examples/ch09_smart_pointers_and_pinning/rc_weak_tree.rs`
````
use std::cell::RefCell;
use std::rc::{Rc, Weak};

#[derive(Debug)]
struct Node {
    name: String,
    parent: RefCell<Weak<Node>>,
    children: RefCell<Vec<Rc<Node>>>,
}

fn main() {
    let root = Rc::new(Node {
        name: String::from("root"),
        parent: RefCell::new(Weak::new()),
        children: RefCell::new(Vec::new()),
    });

    let leaf = Rc::new(Node {
        name: String::from("leaf"),
        parent: RefCell::new(Weak::new()),
        children: RefCell::new(Vec::new()),
    });

    root.children.borrow_mut().push(Rc::clone(&leaf));
    *leaf.parent.borrow_mut() = Rc::downgrade(&root);

    let parent_name = leaf
        .parent
        .borrow()
        .upgrade()
        .map(|node| node.name.clone())
        .unwrap_or_else(|| String::from("none"));

    println!("root children = {}", root.children.borrow().len());
    println!("leaf parent = {}", parent_name);
    println!("root strong = {}", Rc::strong_count(&root));
}
````

### File: `examples/ch09_smart_pointers_and_pinning/pin_box_and_poll.rs`
````
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll, Wake, Waker};

struct Countdown {
    remaining: u8,
}

impl Future for Countdown {
    type Output = &'static str;

    fn poll(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Self::Output> {
        let this = self.get_mut();

        if this.remaining == 0 {
            Poll::Ready("done")
        } else {
            this.remaining -= 1;
            Poll::Pending
        }
    }
}

struct NoopWake;

impl Wake for NoopWake {
    fn wake(self: Arc<Self>) {}
}

fn main() {
    let waker = Waker::from(Arc::new(NoopWake));
    let mut cx = Context::from_waker(&waker);
    let mut task = Box::pin(Countdown { remaining: 2 });

    loop {
        match Future::poll(task.as_mut(), &mut cx) {
            Poll::Ready(value) => {
                println!("ready = {}", value);
                break;
            }
            Poll::Pending => {
                println!("pending = {}", task.as_ref().get_ref().remaining);
            }
        }
    }
}
````

### File: `explainer.md`
````
# Task 9 explainer

## Repository convention used

The task brief named markdown chapter targets, but this repository's source of truth is the React/Next book template under:

- `components/rust-book/pages/`
- `components/rust-book/types.ts`
- `components/rust-book/index.tsx`
- `examples/`

So I followed the existing repository convention instead of creating unused markdown chapter files.

## What changed

### New chapter pages
Added the Chapter 09 page pair in the established TSX page format:

- `components/rust-book/pages/page-ch09-smart-pointers-and-pinning.tsx`
- `components/rust-book/pages/page-ch09-smart-pointers-and-pinning-exercises.tsx`

These pages include:

- opening scenario
- mental model
- core concepts
- production patterns
- pitfalls and tradeoffs
- worked examples
- exercises
- summary

### Navigation and page registration
Updated the page registry so Chapter 09 appears in the book flow and table of contents:

- `components/rust-book/pages/index.ts`
- `components/rust-book/index.tsx`
- `components/rust-book/types.ts`

### Example source files
Added standalone Rust example files under the repository's example convention:

- `examples/ch09_smart_pointers_and_pinning/rc_weak_tree.rs`
- `examples/ch09_smart_pointers_and_pinning/pin_box_and_poll.rs`

### Default editor code
Added chapter-specific default editor code in a small companion file to avoid inflating `types.ts`:

- `components/rust-book/default-codes-ch09.ts`

`types.ts` now imports and merges those defaults.

### Simulator support
Added chapter-specific simulator output handling in a companion file:

- `components/rust-book/rust-simulator-ch09.ts`

And wired it into:

- `components/rust-book/rust-simulator.ts`

This keeps the existing simulator architecture intact while making the new chapter runnable and checkable.

### Syntax highlighting support
Extended code highlighting/editor type lists for the new chapter concepts in:

- `components/rust-code-editor.tsx`

## ToC mapping

The chapter content maps directly to the requested source sections:

1. `Box<T>: heap ownership`
2. `Rc<T>: single-threaded shared ownership`
3. `Arc<T>: thread-safe shared ownership`
4. `RefCell<T>: runtime borrow checking`
5. `Cell<T> and interior mutability`
6. `Mutex<T> and ownership under synchronization`
7. `Weak<T> and cyclic references`
8. `Pin<T> and immovable values`
9. `Pin<Box<T>> and Pin<&mut T>`
10. `Choosing the right pointer type`

## Exercise coverage

The exercise page includes exercises covering:

- pointer-type selection
- breaking an `Rc` graph back-edge with `Weak`
- `Cell` vs `RefCell` vs `Mutex`
- `Arc<Mutex<T>>` tradeoffs
- why async futures may require pinning

It also includes a runnable lab with explicit acceptance via simulator output.

## Assumptions

- Page indices for the new chapter are:
  - Chapter 09 main page: `16`
  - Chapter 09 exercises page: `17`
- Cross-links only target chapters that already exist in the repository.
- I did not create markdown files because they would not be used by the existing app template.
- I kept the build/navigation model consistent with the prior completed chapters.
````