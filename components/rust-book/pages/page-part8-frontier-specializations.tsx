"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  Boxes,
  Compass,
  Cpu,
  FileCheck,
  Layers,
  ShieldCheck,
} from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { PAGES } from "../types"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { Button } from "@/components/ui/button"

const whyReadCards = [
  {
    icon: ShieldCheck,
    title: "Prove a computation without revealing its inputs",
    body: "Express a statement as an arithmetic circuit, generate a succinct proof, and let a verifier accept it in milliseconds without ever seeing the witness. This is the primitive behind private payments, identity attestation, and rollup validity.",
  },
  {
    icon: FileCheck,
    title: "Deploy logic that strangers can trust",
    body: "Ship a smart contract that executes deterministically on a public chain, where the rules are visible, the state transitions are auditable, and no operator can quietly change the outcome after the fact.",
  },
  {
    icon: Cpu,
    title: "Make inference portable and checkable",
    body: "Run an ONNX model from Rust with predictable performance, and, when the stakes demand it, attach a proof that the published output really came from the claimed weights on the claimed input.",
  },
  {
    icon: Boxes,
    title: "Run where there is no operating system",
    body: "Drop the standard library, keep ownership and the borrow checker, and target microcontrollers, secure enclaves, and on-chain runtimes that give you a fixed memory budget and nothing else.",
  },
]

const chapters = [
  {
    number: "51",
    title: "Zero-Knowledge Proofs for Rust Engineers",
    blurb:
      "The working vocabulary of ZK: circuits, witnesses, proving and verifying keys, and why a proof can be tiny even when the computation behind it is large.",
  },
  {
    number: "52",
    title: "ZoKrates Workflows and Ethereum Verifiers",
    blurb:
      "Take a circuit through compile, setup, prove, and export, then deploy the generated Solidity verifier so an on-chain contract can check proofs.",
  },
  {
    number: "53",
    title: "EZKL, Verifiable LLM Inference, and GPU-Aware ZKML",
    blurb:
      "Turn a model into a circuit with EZKL, produce a proof that an inference was run honestly, and weigh where GPU acceleration actually pays off.",
  },
  {
    number: "54",
    title: "ONNX Model Inference in Rust",
    blurb:
      "Load and run exported models from Rust with a small, predictable runtime, so inference becomes an ordinary dependency rather than a Python service.",
  },
  {
    number: "55",
    title: "Smart Contracts in Rust: Solana, Sei, and Beyond",
    blurb:
      "Write deterministic on-chain programs in Rust, manage accounts and state, and reason about the gas and compute limits each runtime imposes.",
  },
  {
    number: "56",
    title: "no-std Rust and Constrained Runtime Derivatives",
    blurb:
      "Build without the standard library for firmware, enclaves, and on-chain targets, choosing allocation and panic strategy under a fixed budget.",
  },
]

export function PagePart8FrontierSpecializations() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("part-8-frontier-specializations")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Compass className="h-4 w-4" />
          Part VIII
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Specialized corners of the Rust ecosystem you reach for when a particular project demands them, not before.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <p className="text-sm text-muted-foreground leading-6">
            The earlier parts of this book covered the language and the disciplines you use on nearly every project:
            ownership, data structures, concurrency, async, services. This part is different on purpose. Each chapter
            here covers a domain that is genuinely powerful but only relevant when a specific requirement pulls it in.
            Treat the part as a reference shelf. Read a chapter when a project hands you the problem it solves, and leave
            the rest on the shelf until then.
          </p>
          <p className="text-sm text-muted-foreground leading-6">
            What ties these topics together is that Rust has become a first-class language in each of them. Zero-knowledge
            proof systems, on-chain smart-contract runtimes, verifiable machine-learning toolchains, and bare-metal
            firmware all increasingly expect Rust on the producing side. The reasons are the ones you already know from
            the rest of the book: deterministic behavior, no garbage collector competing for a tight compute budget, and
            a type system that makes the invariants of a safety-critical or trustless system explicit rather than
            assumed.
          </p>
          <p className="text-sm text-muted-foreground leading-6">
            If you come from C++, C#, Go, or Python, the value here is less about new syntax and more about a new way to
            place trust. A zero-knowledge proof lets a stranger verify your computation without re-running it or seeing
            your data. A smart contract lets parties who do not trust each other agree on an outcome a machine enforces.
            A <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">no_std</code> build lets you keep Rust's
            guarantees on a device with kilobytes of RAM. These are capabilities, not styles, and they are worth knowing
            exist so you can recognize the moment one of them is the right tool.
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Why read this part</h3>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {whyReadCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.title} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <div className="font-medium text-foreground">{card.title}</div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">The shape of the part</h3>
          <p className="text-sm text-muted-foreground leading-6">
            One idea recurs across every chapter here: separate the party that does the heavy work from the party that
            has to trust the result. A prover does the expensive computation; a verifier checks a small artifact. A
            contract author writes the rules once; every participant runs the same deterministic outcome. The diagram
            below previews that arc, from a constrained Rust target through proving and on-chain verification.
          </p>
          <MermaidDiagram
            chart={`flowchart LR\n  Src[Rust circuit or no-std program] --> Prove[Prover does the heavy work]\n  Prove --> Proof[Succinct proof artifact]\n  Proof --> Verify[Verifier checks cheaply]\n  Verify --> Chain[On-chain contract accepts or rejects]\n  Model[ONNX model] -. proven inference .-> Prove`}
            caption="The recurring arc of Part VIII: heavy work happens once on the proving side, while verifiers and on-chain contracts accept a small, checkable artifact."
          />
          <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
            <code className="font-mono text-foreground">{`// The spirit of the part: a verifier stays small and cheap,
// even when the prover did a great deal of work.
fn verify(proof: &Proof, public_inputs: &[Field], vk: &VerifyingKey) -> bool {
    // No witness here, no re-execution of the circuit.
    // Just a constant-size cryptographic check.
    verify_proof(vk, proof, public_inputs)
}`}</code>
          </pre>
          <p className="text-xs text-muted-foreground leading-5">
            Illustrative only. The concrete APIs, circuit languages, and runtimes differ by chapter; this snippet just
            captures the asymmetry the whole part is built around.
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Chapters in this part</h3>
          </div>
          <div className="space-y-3">
            {chapters.map((chapter) => (
              <div
                key={chapter.number}
                className="rounded-xl border border-border bg-card p-5 flex items-start gap-4"
              >
                <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-semibold">
                  {chapter.number}
                </div>
                <div>
                  <div className="font-medium text-foreground">{chapter.title}</div>
                  <p className="text-sm text-muted-foreground leading-6 mt-1">{chapter.blurb}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Start with the foundations</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 51 builds the zero-knowledge vocabulary the next several chapters lean on. If any other chapter
                in this part is what you actually need, you can jump straight there, but the ZK chapters read best in
                order.
              </p>
            </div>
            <Button
              onClick={() => setCurrentPage(getPageIndexById("ch51-zero-knowledge-proofs-rust-engineers"))}
              className="gap-2 shrink-0"
            >
              Begin Part VIII
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
