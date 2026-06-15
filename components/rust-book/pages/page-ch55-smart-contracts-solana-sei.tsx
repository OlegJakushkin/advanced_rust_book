"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Bug,
  Cpu,
  Gauge,
  Layers,
  Shield,
  TriangleAlert,
  Wrench,
} from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "A smart contract is sandboxed, deterministic code over shared state",
    body: "Strip away the marketing and a smart contract is an ordinary program with three unusual constraints. It runs inside a sandboxed virtual machine with no ambient I/O: no clock you can read freely, no files, no network, no random number generator. It must be deterministic, because every validator on the network re-executes it and must reach byte-identical results. And every operation costs a metered resource (gas, or compute units) so an attacker cannot wedge the network with an infinite loop. Rust is a strong fit precisely because these are the constraints it already encourages you to make explicit.",
  },
  {
    title: "The interesting boundary is (de)serialization, not the business logic",
    body: "Inside a contract you write the same Rust you always have: enums, pattern matching, Result, owned structs. The part that is genuinely different sits at the edges. Untrusted bytes arrive from the host, you must decode them into owned domain types before you trust a single field, and you must re-encode results back into bytes the host understands. Ownership at that boundary is the whole game: borrow the input slice, validate, produce owned state, write it back. Almost every contract bug worth its name lives in that decode-validate-encode seam.",
  },
  {
    title: "Each chain answers the same four questions differently",
    body: "Where does state live, what does the code execute as, how is data serialized, and what shape is the entry point the runtime calls? Solana, Sei (via CosmWasm), and the EVM give three different answers to each. Learning a new chain is mostly learning its four answers; the Rust you write to satisfy them is far more similar than the platforms' documentation makes it look. This chapter encodes those four answers as data you can read and run.",
  },
]

const platformCards = [
  {
    title: "Solana",
    body: "Programs are stateless. The deployed code holds no storage of its own; all state lives in separate accounts that the runtime passes into the entry point as mutable byte buffers, each tagged with an owner program. A single process_instruction reads the instruction data, borrows the relevant account buffers, applies changes, and the runtime persists them. Serialization is typically Borsh, a compact deterministic binary format. Cost is paid in compute units, and rent governs how long accounts persist. The Anchor framework adds account validation, discriminators, and an IDL on top, but the core model stays: code is stateless, accounts are external.",
  },
  {
    title: "Sei / CosmWasm",
    body: "Contracts are Rust compiled to wasm and run on a CosmWasm virtual machine (Sei supports CosmWasm alongside its EVM). The model is actor-like: each contract owns a private key-value store and reacts to messages through three entry points, instantiate, execute, and query. Input and output are JSON serialized through serde, decoded with cosmwasm-std types like Deps, Env, and MessageInfo. Contracts talk to each other by emitting messages the runtime dispatches, with optional replies, rather than by synchronous in-line calls. Cost is paid in gas.",
  },
  {
    title: "EVM / Solidity",
    body: "Included for contrast because it is the model most engineers already carry. A contract owns its own storage slots, calls other contracts synchronously and in-line (the called code runs before the caller continues), and encodes calls and returns with the ABI, where a four-byte function selector chooses the method. State, code, and dispatch are bundled into one address. Rust reaches this world too, through Arbitrum Stylus, but the storage-owning, synchronous-call mental model is the thing to keep separate from Solana's accounts and Sei's message passing.",
  },
  {
    title: "Shared Rust ideas",
    body: "Across all three, the same Rust instincts pay off. Ownership lives at the (de)serialization boundary: decode untrusted bytes into owned types, then trust them. Errors are explicit enums returned as Result, never panics-as-control-flow. Execution is deterministic, so no system time, no threads, no ambient randomness. The runtime is a sandboxed, gas-metered VM with no I/O, so every external effect is an explicit message or account write. If you internalize these four habits, moving between chains becomes a matter of learning a new edge format, not a new way of thinking.",
  },
]

const broaderLandscape = [
  {
    title: "NEAR (Rust SDK)",
    body: "NEAR exposes a mature Rust SDK (near-sdk) where contract methods are annotated functions over a contract struct, with state serialized through Borsh and a sharded, account-named storage model. It feels closer to writing ordinary Rust methods than the others, with the SDK generating the host glue.",
  },
  {
    title: "ink! / Substrate",
    body: "ink! is a Rust eDSL for writing wasm contracts that run on Substrate-based chains (Polkadot's pallet-contracts). It uses attribute macros (#[ink::contract]) to mark storage, messages, and constructors, and leans heavily on Rust's trait and macro systems to produce the contract metadata and dispatch.",
  },
  {
    title: "Arbitrum Stylus",
    body: "Stylus lets you write contracts in Rust (compiled to wasm) that run alongside ordinary Solidity on an EVM-compatible Arbitrum chain, sharing the same storage and ABI model. It is the bridge case: EVM semantics underneath, Rust ergonomics on top, often far cheaper for compute-heavy logic.",
  },
]

const boundaryCards = [
  {
    title: "Decode into owned types first",
    body: "Bytes from the host are untrusted. Borrow the input slice, parse it into an owned domain enum or struct, and validate every field before any state changes. A half-decoded value should never be allowed to touch storage. This is the same parse-don't-validate discipline from Chapter 19, with a hostile counterparty assumed.",
  },
  {
    title: "Make every error an explicit value",
    body: "A contract that panics wastes the caller's gas and gives a poor error surface. Model failure as an enum returned through Result so each rejection path is named, testable, and visible at the call site. Borsh decode failure, insufficient balance, and unauthorized signer are different outcomes, not one generic crash.",
  },
  {
    title: "Re-encode results deterministically",
    body: "Whatever you write back, account bytes on Solana, the kv store on CosmWasm, must serialize identically on every validator. Avoid anything order-dependent or platform-dependent: no HashMap iteration order in the output, no floats whose rounding varies, no addresses derived from uninitialized memory.",
  },
]

const determinismCards = [
  {
    title: "No ambient I/O",
    body: "There is no std::fs, no std::net, no SystemTime::now you can trust. Anything from the outside world arrives as explicit instruction data or as host-provided environment values the runtime guarantees are consistent across validators.",
  },
  {
    title: "Gas and compute budgets are real",
    body: "Every instruction has a price. An unbounded loop or an oversized allocation does not hang the chain; it runs out of budget and the transaction reverts. Treat the budget the way an embedded engineer treats a fixed memory pool: a hard constraint you design within.",
  },
  {
    title: "Re-execution demands reproducibility",
    body: "Every validator runs your code and must agree on the result. That rules out threads, wall-clock branching, and ambient randomness inside the contract. Randomness, when needed, comes from an on-chain source the whole network can verify.",
  },
]

const comparisonRows = [
  {
    platform: "Solana",
    state: "External accounts (program is stateless)",
    target: "SBF (a BPF dialect)",
    serde: "Borsh (binary)",
    entry: "process_instruction(accounts, data)",
  },
  {
    platform: "Sei / CosmWasm",
    state: "Contract-owned key-value store",
    target: "wasm",
    serde: "JSON via serde",
    entry: "instantiate / execute / query",
  },
  {
    platform: "EVM / Solidity",
    state: "Contract-owned storage slots",
    target: "EVM bytecode",
    serde: "ABI (selector + encoded args)",
    entry: "selector dispatch",
  },
]

const similaritiesDifferences = [
  {
    title: "Similar: the code is sandboxed and deterministic",
    body: "All three run untrusted code in a metered VM with no ambient I/O, and all three demand bit-for-bit reproducible execution. The Rust habits of explicit errors and owned-data-at-the-boundary transfer directly between them.",
  },
  {
    title: "Different: where state lives",
    body: "Solana separates code from state entirely, accounts are passed in. CosmWasm and the EVM bundle each contract with its own private storage. That single difference reshapes how you think about access control, parallelism, and which accounts a transaction must declare up front.",
  },
  {
    title: "Different: how contracts compose",
    body: "The EVM calls other contracts synchronously and in-line. CosmWasm composes by emitting messages the runtime dispatches, with replies, an actor model. Solana composes through cross-program invocation against explicitly passed accounts. Reentrancy, atomicity, and failure handling differ accordingly.",
  },
  {
    title: "Similar: the boundary format is the contract's real API",
    body: "Borsh layouts on Solana, JSON message shapes on CosmWasm, and ABI signatures on the EVM are all public contracts that outlive any single deploy. Versioning them deliberately, the Chapter 19 lesson, matters as much here as in any service mesh.",
  },
]

const productionPatterns = [
  "Keep the contract entry point thin: decode, dispatch to a pure handler, encode. Put the real logic in ordinary Rust functions you can unit-test without the chain.",
  "Model instructions and errors as enums, never as magic numbers or stringly-typed dispatch. Exhaustive matching is your first defense against an unhandled message.",
  "Validate every account or storage assumption explicitly. On Solana, never trust that an account is the one you expect without checking its owner and any discriminator.",
  "Treat the serialization layout as a versioned wire contract. Evolve it additively, the same way you would a queue message or an RPC payload.",
  "Budget compute units or gas the way you budget a fixed buffer: bound loops, avoid per-element allocation in hot paths, and measure against the limit before deploying.",
  "Port logic between chains by isolating the chain-specific edge. The decode-validate-encode shell changes per platform; the owned-domain core should not.",
]

const pitfalls = [
  "Trusting decoded input before validating it, so a malformed Borsh buffer or crafted JSON drives state changes the author never intended.",
  "Panicking instead of returning a typed error, which burns the caller's gas and turns a recoverable rejection into an opaque failure.",
  "Assuming Solana's stateless model behaves like the EVM's storage model, and forgetting to verify which accounts were actually passed in and who owns them.",
  "Letting non-determinism leak in: iterating a HashMap into output, branching on a clock, or relying on allocation addresses, any of which can fork validators.",
  "Treating gas or compute units as someone else's problem until an unbounded loop reverts every real transaction under load.",
  "Copying a contract's boundary format across a version bump without thinking, then breaking every client that decoded the old layout.",
]

const summaryPoints = [
  "A smart contract is sandboxed, deterministic, gas-metered code over shared state. Rust suits it because those constraints are ones Rust already makes explicit.",
  "Solana, Sei (CosmWasm), and the EVM answer the same four questions differently: where state lives, the execution target, the serialization format, and the entry-point shape.",
  "The hard, chain-specific work lives at the (de)serialization boundary. Decode untrusted bytes into owned, validated types, then write deterministic bytes back.",
  "Shared Rust ideas carry across every chain: explicit error enums, owned data at the edge, no ambient I/O, and reproducible execution.",
  "The broader Rust-on-chain landscape, NEAR, ink!/Substrate, and Arbitrum Stylus, varies the edge format while keeping the same core habits.",
  "Port logic between platforms by isolating the chain-specific shell from a pure, testable domain core.",
]

export function PageCh55SmartContractsSolanaSei() {
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
  const pageIndex = getPageIndexById("ch55-smart-contracts-solana-sei")
  const chapter19PageIndex = getPageIndexById("ch19-serialization-and-data-contracts")
  const chapter51PageIndex = getPageIndexById("ch51-zero-knowledge-proofs-rust-engineers")
  const chapter54PageIndex = getPageIndexById("ch56-no-std-rust-constrained-runtime-derivatives")
  const exercisesPageIndex = getPageIndexById("ch55-smart-contracts-solana-sei-exercises")
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
          Chapter 55 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          A smart contract is just sandboxed, deterministic, gas-metered code over shared state. This chapter
          looks at how Solana, Sei (through CosmWasm), and the EVM answer the same handful of questions differently, and
          why the Rust you write to satisfy each one is far more alike than the platforms make it appear.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapter 19</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 19 covered serialization and versioned data contracts, which is exactly what a contract's
                boundary format is. That lesson is load-bearing here, because a chain's boundary format is the contract's
                real public API. Chapter 56, the finale, takes the sandboxed, no-ambient-I/O discipline a contract runs
                under all the way down to no_std and constrained runtimes.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter19PageIndex)}>
                Chapter 19
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter54PageIndex)}>
                Chapter 56
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A team that already ships a Solana program is asked to deploy comparable logic to a Sei (CosmWasm) chain, and
            to keep an eye on an EVM deployment a partner maintains. The question is not "rewrite everything" but "what
            actually changes." The answer turns out to be small and specific: the boundary format and the entry-point
            shape change; the owned-domain core does not.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">The four questions to ask of any chain</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Where does contract state live, with the code or in separate accounts?</li>
              <li>What does the code execute as, SBF, wasm, or EVM bytecode?</li>
              <li>How is data serialized across the host boundary, Borsh, JSON, or ABI?</li>
              <li>What shape is the entry point the runtime calls?</li>
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
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            The shape worth memorizing is a thin shell around a pure core. Untrusted bytes enter, get decoded into owned
            domain types, a deterministic handler runs, and owned results are re-encoded into bytes the runtime persists.
            Everything chain-specific lives in the shell; the handler is ordinary Rust.
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Host[Runtime / host] -->|untrusted bytes| Decode[Decode + validate]\n  Decode -->|owned types| Handler[Deterministic handler]\n  Handler -->|owned result| Encode[Re-encode bytes]\n  Encode -->|state write| Host`}
            caption="Every chain shares this shape: decode untrusted bytes into owned types, run a deterministic handler, encode results back. Only the edges change per platform."
          />
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How the platforms compare</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            This is a cross-platform comparison, not a cross-language one: the user asked specifically about Solana and
            Sei, with the EVM included for contrast. Read the first three cards as three answers to the same four
            questions, then read the fourth card as the Rust ideas that stay constant no matter which chain you land on.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {platformCards.map((card) => (
              <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">{card.title}</div>
                <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">The four answers, side by side</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-4 font-semibold text-foreground">Platform</th>
                    <th className="py-2 pr-4 font-semibold text-foreground">State model</th>
                    <th className="py-2 pr-4 font-semibold text-foreground">Execution target</th>
                    <th className="py-2 pr-4 font-semibold text-foreground">Serialization</th>
                    <th className="py-2 font-semibold text-foreground">Entry shape</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.platform} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-4 font-medium text-foreground">{row.platform}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{row.state}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{row.target}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{row.serde}</td>
                      <td className="py-2 text-muted-foreground">{row.entry}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              The diagram below makes the structural difference concrete: Solana keeps code and state apart, while
              CosmWasm and the EVM bind each contract to its own storage.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph Solana\n    P1[Program code stateless] --> A1[(Account A)]\n    P1 --> A2[(Account B)]\n  end`}
              caption="Solana keeps stateless code apart from the external accounts the runtime passes in; one program can act on many accounts."
            />
            <p className="text-sm text-muted-foreground leading-6">
              CosmWasm and the EVM take the opposite approach: each contract is bound to its own private storage rather
              than reaching into external accounts.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph CosmWasm\n    P2[Contract code] --> KV[(Private kv store)]\n  end\n  subgraph EVM\n    P3[Contract code] --> S3[(Owned storage slots)]\n  end`}
              caption="CosmWasm and the EVM each bundle a contract with its own private storage, so code and state share one address."
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Differences and similarities, made explicit</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {similaritiesDifferences.map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{item.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{item.body}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              How a contract composes with another contract is where the platforms diverge most sharply, and it is worth
              tracing once. The EVM call is synchronous and in-line; CosmWasm hands a message to the runtime and may
              receive a reply; Solana invokes another program against accounts it explicitly passes along.
            </p>
            <MermaidDiagram
              chart={`sequenceDiagram\n  participant Caller\n  participant Runtime\n  participant Callee\n  Note over Caller,Callee: EVM (synchronous)\n  Caller->>Callee: call selector + args\n  Callee-->>Caller: return value\n  Note over Caller,Callee: CosmWasm (actor messages)\n  Caller->>Runtime: emit execute message\n  Runtime->>Callee: dispatch message\n  Callee-->>Runtime: reply\n  Runtime-->>Caller: reply delivered`}
              caption="The EVM composes by synchronous in-line calls; CosmWasm composes by emitting messages the runtime dispatches and replies to. Reentrancy and atomicity differ as a result."
            />
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Ownership at the (de)serialization boundary</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The single most important habit in contract code is the same one Chapter 19 taught for any wire format,
              with a hostile counterparty assumed: never let an undecoded or unvalidated value reach state. Borrow the
              input, parse it into owned types, validate, and only then mutate.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {boundaryCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Determinism and metered execution</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A contract runs inside a sandbox with no ambient I/O, every operation costs a metered resource, and every
              validator re-executes it expecting identical results. These three facts rule out a surprising amount of
              ordinary Rust, and the discipline they demand is close to the embedded and no_std work Chapter 56 takes up
              next.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {determinismCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">The broader Rust-on-chain landscape</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Solana, Sei, and the EVM are the focus here, but Rust reaches several other chains, each varying the edge
              format while keeping the same core habits. Three are worth knowing by name.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {broaderLandscape.map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{item.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{item.body}</p>
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
                The chain will not protect you from a contract that trusts its input. Validation, determinism, and a
                versioned boundary format are your job, not the runtime's.
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
                <h4 className="font-semibold text-foreground">Example 1: Solana's account and instruction model</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  A self-contained, crate-free model of how a Solana program works on external account data: stateless
                  code, a mutable byte buffer, a hand-rolled Borsh-style counter, and an instruction that drives it.
                </p>
              </div>
              {codes.smart_contract_solana_counter !== DEFAULT_CODES.smart_contract_solana_counter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("smart_contract_solana_counter")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the program holds no state. The <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Account</code> owns
              the data buffer, and <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">process_instruction</code> borrows it
              mutably, decodes a little-endian <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">u64</code> by hand the way
              Borsh would, applies the instruction, and writes the bytes back. Trace one call through the diagram, then
              read the same path in code; try changing the <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">SetTo</code> value
              and watch the final counter follow.
            </p>
            <MermaidDiagram
              chart={`sequenceDiagram\n  participant Runtime\n  participant Program\n  participant Account\n  Runtime->>Program: process_instruction(data, SetTo 41)\n  Program->>Account: read_counter (from_le_bytes)\n  Program->>Account: write_counter 41 (to_le_bytes)\n  Runtime->>Program: process_instruction(data, Increment)\n  Program->>Account: read 41, write 42\n  Program-->>Runtime: counter = 42`}
              caption="The runtime hands the program a mutable account buffer per instruction. The program decodes, applies, and re-encodes; the runtime persists the bytes."
            />
            <RustCodeEditor
              code={codes.smart_contract_solana_counter}
              onChange={(newCode) => updateCode("smart_contract_solana_counter", newCode)}
              onRun={() => runCode("smart_contract_solana_counter")}
              output={outputs.smart_contract_solana_counter ?? null}
              isRunning={isRunning === "smart_contract_solana_counter"}
              filename="solana_counter_program.rs"
              expectedOutput={"after set = 41\nafter increment = 42\ncounter = 42\nowner = CounterProgram1111"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.smart_contract_solana_counter}
              onRevert={() => resetCode("smart_contract_solana_counter")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Stateless code</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The program owns no storage; state lives in the account buffer passed in.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Hand-rolled Borsh</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">from_le_bytes</code> and
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] ml-1">to_le_bytes</code> stand in for a real codec.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Owner tag</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Each account records its owning program, the field real validation checks first.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: the platform mental model as data</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The Solana / Sei (CosmWasm) / EVM comparison encoded as an enum with four fields per variant, printed
                  as one row per platform so the contrasts line up.
                </p>
              </div>
              {codes.smart_contract_platform_compare !== DEFAULT_CODES.smart_contract_platform_compare && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("smart_contract_platform_compare")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: each platform is an enum variant, and <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">describe</code> maps
              it to the four facts, state model, execution target, serialization, and entry shape. The loop prints one
              line per platform. This is the comparison table from earlier turned into runnable data; editing a field in
              one arm changes exactly one line of output.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Sol[Platform::Solana] --> D{describe}\n  Sei[Platform::SeiCosmWasm] --> D\n  Evm[Platform::EvmSolidity] --> D\n  D -->|state, target, serde, entry| Row[One printed row each]`}
              caption="Each variant carries the same four facts; describe maps a platform to its row, and main prints one line per platform."
            />
            <RustCodeEditor
              code={codes.smart_contract_platform_compare}
              onChange={(newCode) => updateCode("smart_contract_platform_compare", newCode)}
              onRun={() => runCode("smart_contract_platform_compare")}
              output={outputs.smart_contract_platform_compare ?? null}
              isRunning={isRunning === "smart_contract_platform_compare"}
              filename="platform_compare.rs"
              expectedOutput={
                "Solana | state=external accounts | target=SBF | serde=Borsh | entry=process_instruction\nSei/CosmWasm | state=contract-owned kv | target=wasm | serde=JSON/serde | entry=instantiate/execute/query\nEVM/Solidity | state=contract storage | target=EVM bytecode | serde=ABI | entry=selector dispatch"
              }
              showResultComparison={true}
              originalCode={DEFAULT_CODES.smart_contract_platform_compare}
              onRevert={() => resetCode("smart_contract_platform_compare")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">State model</div>
                <p className="text-xs text-muted-foreground leading-5">
                  External accounts on Solana versus contract-owned storage on Sei and the EVM.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Execution target</div>
                <p className="text-xs text-muted-foreground leading-5">
                  SBF, wasm, and EVM bytecode are three sandboxes with the same determinism demand.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Boundary format</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Borsh, JSON, and the ABI are each a versioned public contract, not an internal detail.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to extend the account model with a new instruction, harden the
            decode-validate boundary against malformed input, and reason about which parts of a contract change when you
            port it from Solana to Sei.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 55 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Next chapter</h3>
              <p className="text-sm text-muted-foreground leading-6">
                A contract runs in a sandbox with no ambient I/O and a metered budget, which is the same world the book's
                finale lives in. Chapter 56 carries that constrained-runtime thread all the way down into no_std and
                embedded targets, where you give up the standard library and make every runtime service explicit. If you
                want to go deeper on the cryptographic side of on-chain systems instead, Chapter 51 on zero-knowledge
                proofs is the natural companion: proving facts about state without revealing it is increasingly part of
                how contracts scale and stay private.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter51PageIndex)} className="gap-2">
                Revisit Chapter 51
              </Button>
              <Button onClick={() => setCurrentPage(chapter54PageIndex)} className="gap-2">
                Continue to Chapter 56
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
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
