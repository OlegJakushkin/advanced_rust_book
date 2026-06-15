"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookMarked,
  Compass,
  FolderTree,
  Lightbulb,
  Map as MapIcon,
  Sparkles,
  Wrench,
} from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { PAGES } from "../types"
import { Button } from "@/components/ui/button"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"

const whyReadCards = [
  {
    icon: Compass,
    title: "Re-read Rust on its own terms",
    body: "Stop translating Rust into the language you already know. You will leave with a working model of ownership, borrowing, and moves as a resource protocol, so the borrow checker reads as design feedback rather than an obstacle.",
  },
  {
    icon: Lightbulb,
    title: "Know where the friction actually lives",
    body: "The hard part is not syntax; it is API boundaries, shared state, and lifetimes. Knowing that in advance lets you spend your attention where Rust spends its strictness instead of being surprised by it.",
  },
  {
    icon: Wrench,
    title: "Stand up a toolchain you trust",
    body: "Cargo, rustup, workspaces, formatting, linting, and tests configured the way a team actually ships. You finish able to create, build, lint, and test a project without guessing at conventions.",
  },
  {
    icon: BookMarked,
    title: "Build the vocabulary the rest of the book uses",
    body: "Later parts assume you can talk fluently about owners, borrows, drops, and crates. This part installs that shared vocabulary so nothing downstream has to stop and re-explain it.",
  },
]

const chapters = [
  {
    number: "1",
    title: "Why Rust Feels Different",
    description:
      "What Rust trades and what it asks you to state up front, read through the eyes of a C++, C#, Go, or Python engineer.",
    id: "ch01-why-rust-feels-different",
  },
  {
    number: "2",
    title: "The Rust Mental Model",
    description:
      "Values, bindings, moves, drops, and stack-versus-heap ownership, plus why lifetimes describe borrowed references rather than object survival.",
    id: "ch02-the-rust-mental-model",
  },
  {
    number: "3",
    title: "Project Structure and Tooling",
    description:
      "Cargo, rustup, workspaces, modules, formatting, linting, and tests, set up the way a team ships and maintains real code.",
    id: "ch03-project-structure-and-tooling",
  },
]

const flavorSnippet = `// Ownership is stated, not assumed.
fn main() {
    let report = build_report();      // main owns the value
    let summary = summarize(&report); // lend it, do not give it away
    println!("{summary}");
    archive(report);                  // hand ownership off for good
} // nothing left to clean up here: archive already owns it`

export function PagePart1GettingYourBearings() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("part-1-getting-your-bearings")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Compass className="h-4 w-4" />
          Part I
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Recalibrate your mental model and stand up a working toolchain before you fight the borrow checker.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground leading-6">
            You already know how to build software. That is exactly why Rust can feel disorienting at first: the instinct
            to translate it into C++, C#, Go, or Python works just often enough to mislead you. This part exists to slow
            that reflex down and replace it with a model that holds up. Before you write much production code, it is worth
            getting clear on what Rust actually optimizes for and where it deliberately refuses to compromise.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-4">
            The payoff is concrete. Most early Rust pain is not about syntax; it is about ownership, borrowing, and
            lifetimes showing up at API boundaries you used to cross without a thought. If you understand that the borrow
            checker is enforcing a resource protocol, its errors stop reading as nagging and start reading as early design
            review. You spend your energy where the language spends its strictness instead of fighting it blind.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-4">
            So this part is short and deliberately foundational. First we recalibrate the mental model; then we stand up a
            toolchain and project layout you can trust. By the end you will have a working Rust project and a way of
            thinking about ownership that the rest of the book can build on without backtracking.
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Why read this part</h3>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {whyReadCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.title} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-foreground">{card.title}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">The arc of this part</h3>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground leading-6 mb-2">
              The three chapters form a short on-ramp: adjust how you read Rust, install the model that makes its rules
              predictable, then put a real project under your hands. Each step makes the next one cheaper.
            </p>
            <MermaidDiagram
              chart={`flowchart LR
  A[Old mental model] --> B[Why Rust Feels Different]
  B --> C[The Rust Mental Model]
  C --> D[Project Structure and Tooling]
  D --> E[Ready to fight the borrow checker on equal terms]`}
              caption="Part I as an on-ramp: recalibrate how you read Rust, install a model of ownership, then stand up a project you can trust."
            />
            <p className="text-sm text-muted-foreground leading-6 mt-2">
              Here is the flavor in a few lines. Notice that the program never says when to free anything; it only states
              who owns the value at each step, and cleanup follows from that.
            </p>
            <pre className="mt-3 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{flavorSnippet}</code>
            </pre>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Chapters in this part</h3>
          </div>
          <div className="space-y-3">
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() => setCurrentPage(getPageIndexById(chapter.id))}
                className="group flex w-full items-start gap-4 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base font-semibold text-primary">
                  {chapter.number}
                </span>
                <span className="flex-1">
                  <span className="block font-semibold text-foreground">{chapter.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground leading-6">{chapter.description}</span>
                </span>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Start here</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Begin with the recalibration: why Rust feels different, and what it asks you to make explicit before the
                rest of the model clicks into place.
              </p>
            </div>
            <Button
              onClick={() => setCurrentPage(getPageIndexById("ch01-why-rust-feels-different"))}
              className="gap-2 shrink-0"
            >
              Begin Part I
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
