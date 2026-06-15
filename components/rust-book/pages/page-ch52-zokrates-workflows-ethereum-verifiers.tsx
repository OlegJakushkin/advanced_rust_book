"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Layers, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const commandRunnerSnippet = `use std::process::Command;

fn run_stage(program: &str, args: &[String]) -> std::io::Result<()> {
    let status = Command::new(program).args(args).status()?;

    if status.success() {
        Ok(())
    } else {
        Err(std::io::Error::other("zokrates stage failed"))
    }
}`

const mentalModelPoints = [
  {
    title: "ZoKrates is a workflow you orchestrate, not a proving library you embed.",
    body: "Rust drives the ZoKrates CLI or wraps a proving service; it does not reimplement the prover. The verifier contract, proof blobs, witness files, and setup keys are files on disk with custody rules. Modeling them as ordinary in-memory structs that the whole system passes around is the first mistake that leads to a leaked witness or a mismatched key.",
  },
  {
    title: "The prover and the verifier are different shapes of service.",
    body: "Proving is heavy and bursty: it generates a witness, leans on setup material, runs proof generation, and stores artifacts. Verification is light: it takes public inputs plus one proof and returns a yes or no, on-chain or off. The moment a single request handler tries to do both inline, the topology is already wrong and will not scale or stay secure.",
  },
  {
    title: "Ethereum integration is mostly artifact management plus a little translation.",
    body: "The generated Solidity verifier is a deployment artifact bound to exactly one circuit and one verification key. Rust's job on the Ethereum side is small but exact: encode public inputs into calldata, track which contract address corresponds to which circuit version, and make sure no witness material ever reaches the verifier request.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You are used to deciding what links into your binary and what stays a separate tool. Keep that instinct: ZoKrates is a compiler toolchain and artifact pipeline, not a library you call from hot code. The shift is that Rust lets you encode the custody rules you would otherwise enforce by convention, so a witness file or proving key cannot quietly drift into the wrong process.",
  },
  {
    title: "C# background",
    body: "There is no runtime, no reflection, and no single framework object that discovers the workflow for you. You spell the stages out as data and types. The trap is reaching for a tall service abstraction that hides command invocation and file paths; Rust stays calmer when the orchestration is plainly visible and the prover and verifier are different types rather than one configurable manager.",
  },
  {
    title: "Go background",
    body: "Your instinct to decompose into small services and pass work over channels is exactly right. The shift is that a proving stage is not just another goroutine: witness generation and proof creation are heavyweight jobs with their own resource budgets, retry rules, and artifact retention. Let the type system separate prover concerns from verifier concerns so the topology is reviewable, not implied by which function happens to call which.",
  },
  {
    title: "Python background",
    body: "If you have wired up ML or crypto pipelines, you already think in stages and artifacts. The difference is that nothing is dynamically typed away here: public inputs, proof bundles, and verifier requests become distinct structs with no overlap, so a private witness path cannot land in a request dict by accident. Treat the .zok program like a model you compile once and version, not like a script you re-run inline on every request.",
  },
]

const workflowRows = [
  {
    stage: "1. Write computation",
    artifact: "source .zok program",
    owner: "source repo and circuit review path",
    note: "Define public inputs, private witness inputs, and outputs deliberately before anything is compiled.",
  },
  {
    stage: "2. Compile",
    artifact: "compiled circuit or constraint artifact",
    owner: "CI or explicit CLI lane",
    note: "Treat the circuit ID and compiler configuration as versioned build inputs.",
  },
  {
    stage: "3. Setup",
    artifact: "proving key and verification key",
    owner: "trusted setup or controlled ceremony lane",
    note: "This step is not an ordinary request-path concern. Its provenance becomes part of the trust model.",
  },
  {
    stage: "4. Compute witness",
    artifact: "witness file or witness memory object",
    owner: "private proving lane",
    note: "Witness data should stay off verifier and chain boundaries.",
  },
  {
    stage: "5. Generate proof",
    artifact: "proof blob or proof.json",
    owner: "prover worker",
    note: "Heavy CPU and memory stage; queue it and observe it like a specialist worker.",
  },
  {
    stage: "6. Export verifier",
    artifact: "generated Solidity verifier contract",
    owner: "release or deployment lane",
    note: "Generated does not mean unaudited. Treat it like any other deployable contract artifact.",
  },
  {
    stage: "7. Verify",
    artifact: "local verification result and/or on-chain verifier call",
    owner: "verifier service or transaction sender",
    note: "The verifier should receive only public inputs plus proof, never raw witness material.",
  },
]

const proofFriendlyCards = [
  {
    title: "Keep public inputs small and explicit.",
    body: "Public totals, limits, committed digests, Merkle roots, and small identifiers usually fit the verifier boundary better than huge raw payloads. Push large or sensitive data into witness generation or commitments.",
  },
  {
    title: "Prefer fixed or bounded shapes.",
    body: "Proof systems and ZoKrates workflows are calmer when the data model already has bounded arrays, fixed field counts, or explicit chunking. Unbounded strings and shape-changing JSON are usually Rust pre-processing problems, not ZoKrates program inputs.",
  },
  {
    title: "Move parsing and normalization out of the proof program.",
    body: "HTTP bodies, protobufs, JSON, string parsing, and domain decoding are usually better handled in Rust before witness generation. Feed the proof program canonical numeric or committed representations instead of raw transport text.",
  },
  {
    title: "Design outputs for the verifier boundary.",
    body: "If Ethereum or another service verifies the proof, decide early which outputs are public return values and which outputs should remain witness-only or stay behind commitments.",
  },
]

const ethereumCards = [
  {
    title: "The generated Solidity verifier is not handwritten Rust.",
    body: "Rust should treat the verifier contract as a generated deployment artifact with its own compiler, review, and release lane. Do not pretend it is just another module in the Rust crate graph.",
  },
  {
    title: "Version contract address, circuit ID, and verification key together.",
    body: "An Ethereum-facing verifier call needs a stable mapping from application version to circuit or contract version. If the circuit changes, the verifier contract and verification key mapping usually change too.",
  },
  {
    title: "Prepare verifier calls from public inputs only.",
    body: "The Rust boundary that prepares calldata or RPC submissions should accept public inputs plus proof artifact. Witness paths, witness files, and proving-only metadata should not cross into the verifier request type.",
  },
  {
    title: "Separate proof generation from transaction submission.",
    body: "A proof service may run far from the component that submits to Ethereum. That is often healthier operationally: proving is heavyweight and bursty, while contract submission has different latency, confirmation, and retry rules.",
  },
]

const orchestrationCards = [
  {
    title: "CLI or admin lane",
    body: "Compile, setup, and export-verifier usually belong in a controlled CLI, CI, or release lane. They are not natural `build.rs` steps for every local developer build, and they are definitely not request-path work.",
  },
  {
    title: "Prover worker lane",
    body: "Witness generation and proof creation belong in a bounded worker or job system. This is where Rust should enforce resource budgets, secret handling, artifact retention, and structured logs.",
  },
  {
    title: "Verifier API or submitter lane",
    body: "Verification can live in a thin HTTP or gRPC service, an Ethereum transaction sender, or both. Keep this boundary small, typed, and version-aware.",
  },
  {
    title: "Rust should orchestrate, not cosplay as the generated verifier.",
    body: "Use Rust to build invocation plans, capture stdout or stderr, version artifacts, and map application DTOs into proof or verifier requests. Let ZoKrates and Solidity keep their own generated surfaces visible.",
  },
]

const artifactRows = [
  {
    artifact: "source circuit (.zok)",
    secrecy: "reviewable source",
    owner: "repo and release engineering",
    retention: "versioned long-term",
    note: "Pin the exact source and circuit ID that every proof or verifier contract corresponds to.",
  },
  {
    artifact: "compiled circuit",
    secrecy: "internal build artifact",
    owner: "CI or compile lane",
    retention: "cacheable by circuit version",
    note: "Useful for reproducibility and for replaying witness or proof generation later.",
  },
  {
    artifact: "proving key",
    secrecy: "restricted internal artifact",
    owner: "setup custody owner",
    retention: "versioned and access-controlled",
    note: "Treat proving-key distribution as security-sensitive and operationally explicit.",
  },
  {
    artifact: "verification key",
    secrecy: "public; ships inside the deployed verifier contract",
    owner: "verifier deploy lane",
    retention: "versioned with circuit and contract",
    note: "The discipline that matters is exact version alignment with the circuit and proving key, not secrecy.",
  },
  {
    artifact: "witness",
    secrecy: "private",
    owner: "prover only",
    retention: "ephemeral unless explicitly required",
    note: "Do not log, replicate, or hand to Ethereum verification paths casually.",
  },
  {
    artifact: "proof blob",
    secrecy: "transport artifact",
    owner: "prover output, verifier input",
    retention: "bounded by replay and audit policy",
    note: "Store enough metadata to know which circuit and verifier version the proof belongs to.",
  },
  {
    artifact: "generated verifier contract",
    secrecy: "deployable code artifact",
    owner: "Solidity deployment lane",
    retention: "versioned with address mapping",
    note: "Treat gas measurement, compiler pinning, and audit status as part of its manifest.",
  },
]

const testingCards = [
  {
    title: "Test the workflow in layers.",
    body: "Unit-test Rust input normalization and artifact manifests. Contract-test local `verify` behavior with known proof fixtures. Then separately test Ethereum verifier compilation and deployment paths.",
  },
  {
    title: "Pin versions and canonical inputs.",
    body: "Reproducibility improves when circuit ID, setup material ID, public-input ordering, and artifact paths are explicit. If a proof fails after a deploy, you should be able to identify which piece moved.",
  },
  {
    title: "Add negative fixtures deliberately.",
    body: "Wrong public inputs, wrong verification key, wrong verifier contract address, and witness-order drift should each fail in a named test. Do not let proof failures remain one generic 'verification false' mystery.",
  },
  {
    title: "Keep local verify separate from chain verify.",
    body: "Native verification is a good fast gate in CI. Ethereum verification adds compiler, deployment, gas, and calldata-encoding variables that deserve their own test lane.",
  },
]

const performanceCards = [
  {
    title: "Setup and proving are the hot lanes.",
    body: "Compile, setup, witness generation, and proof generation are the first stages to isolate behind bounded workers or dedicated machines. They are poor inline request-path work.",
  },
  {
    title: "Witness generation can dominate before proving does.",
    body: "A system that normalizes large payloads, computes commitments, or builds Merkle paths in Rust may spend more time before the prover starts than the team expected. Measure both.",
  },
  {
    title: "Verification is cheaper, but still operational.",
    body: "Ethereum verifier calls still consume gas and serialized public inputs. Off-chain verification still needs parsing, version checks, and sometimes queue or RPC retry policy.",
  },
  {
    title: "Acceleration is optional and should stay isolated.",
    body: "If proof generation later uses GPU or other acceleration, keep that boundary out of the API edge. The heavy lane should still preserve the same proof artifact contract.",
  },
]

const caveatCards = [
  {
    title: "Trusted setup assumptions are security inputs.",
    body: "If the chosen proving scheme depends on setup material, treat setup provenance and ceremony handling as part of the security model, not as release trivia.",
  },
  {
    title: "Generated verifier contracts still need normal contract discipline.",
    body: "Generated Solidity is still deployable code. Pin compiler choices, measure gas, run your normal contract review path, and keep contract addresses versioned in the Rust side.",
  },
  {
    title: "Upgrade means dual-running versions for a while.",
    body: "A circuit upgrade often implies new keys, new proof artifacts, and possibly a new verifier contract. Plan for mixed versions, migration windows, and clear deprecation rules.",
  },
  {
    title: "Audit boundaries stay separate.",
    body: "Proof-system assumptions, circuit correctness, Rust secret handling, artifact storage, and Ethereum deployment safety are different audit surfaces. Avoid collapsing them into one vague 'the proof system is secure' statement.",
  },
]

const productionPatterns = [
  "Model the full ZoKrates workflow as explicit stages with distinct owners: compile and setup in controlled lanes, witness and proof in bounded workers, verification in a smaller service or chain submitter.",
  "Keep proof-friendly inputs small, canonical, and field-oriented at the ZoKrates boundary; move parsing and transport normalization into Rust pre-processing.",
  "Store circuit ID, setup or key version, verifier contract path or address, and proof metadata together so artifact drift is observable and testable.",
  "Generate verifier calls from public inputs plus proof only. Make witness retention and log redaction explicit policy, not a best-effort habit.",
  "Use native verification as a fast CI or smoke-test gate, then separately exercise Ethereum-oriented deployment and verifier-call paths.",
  "Treat setup provenance, generated verifier review, and upgrade windows as first-class operational concerns before promising production readiness.",
]

const pitfalls = [
  "Running compile, setup, or proof generation inline on request threads because the first prototype was small.",
  "Letting witness material cross into verifier request types, logs, traces, or long-term artifact storage without an explicit reason.",
  "Deploying a generated verifier contract without pinning which circuit, verification key, and public-input ordering it corresponds to.",
  "Treating build.rs as the natural place for heavy ZoKrates workflow steps that are really CI, ceremony, or operations concerns.",
  "Failing to test wrong-key, wrong-version, or wrong-public-input paths separately, so every proof mismatch looks the same during incident response.",
  "Explaining production readiness only in cryptographic terms while ignoring normal Rust systems concerns such as queue budgets, secret files, retries, and rollout strategy.",
]

const summaryPoints = [
  "ZoKrates integration is primarily a tooling and artifact workflow: write the computation, compile, setup, compute witness, generate proof, export verifier, then verify.",
  "Proof-friendly programs keep public inputs deliberate, private witness material separate, and parsing or normalization outside the proof program whenever possible.",
  "Ethereum integration should treat the generated verifier contract as a versioned deployment artifact and keep witness data out of verifier calls entirely.",
  "Rust adds the most value by orchestrating commands, structuring artifact custody, isolating heavy proving lanes, and making version and upgrade policy explicit.",
  "Production safety depends on reproducible artifacts, negative tests, trusted setup or key provenance, normal Solidity review discipline, and rollout plans for mixed circuit versions.",
]

export function PageCh52ZoKratesWorkflowsAndEthereumVerifiers() {
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

  const pageIndex = getPageIndexById("ch52-zokrates-workflows-ethereum-verifiers")
  const chapter44PageIndex = getPageIndexById("ch44-packaging-and-deployment")
  const chapter46PageIndex = getPageIndexById("ch46-fastapi-style-web-apps-swagger-openapi-codegen")
  const chapter49PageIndex = getPageIndexById("ch49-https-tls-secure-service-boundaries")
  const chapter51PageIndex = getPageIndexById("ch51-zero-knowledge-proofs-rust-engineers")
  const exercisesPageIndex = getPageIndexById("ch52-zokrates-workflows-ethereum-verifiers-exercises")
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
          Chapter 52 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Proof workflows need controlled source programs, setup material, witness custody, generated verifiers, and
          deployment tracking. This chapter covers ZoKrates and Ethereum verification as staged production artifacts.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 44, 46, 49, and 51</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 51 established the general ZKP mental model: statements, witnesses, constraints, transcripts, and
                proof artifacts. Chapter 44 covered packaging and custody of build outputs. Chapter 46 covered
                transport-facing contract boundaries, and Chapter 49 covered secure service boundaries. This chapter narrows
                that material to the ZoKrates workflow and Ethereum-oriented verifier integration.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter44PageIndex)}>
                Chapter 44
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter46PageIndex)}>
                Chapter 46
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter49PageIndex)}>
                Chapter 49
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter51PageIndex)}>
                Chapter 51
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            Picture a compliance service that has to prove a fact about a customer to a smart contract without ever
            revealing the underlying data. The classic example is an age check: the contract needs to be convinced that a
            person is over eighteen, but it must never see the birth date that establishes it. That is exactly the kind of
            statement a zero-knowledge proof can carry, and ZoKrates is the toolchain we will use to turn the statement
            into a circuit, a proof, and a verifier that Ethereum can call.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            The work is less about cryptography than it looks. The cryptography lives inside ZoKrates. Your job, in Rust,
            is to manage everything around it: shaping proof-friendly inputs, driving the compile and setup stages,
            keeping witness data in custody, generating proofs in a worker, deploying the generated verifier contract, and
            sending versioned verification requests on-chain. Each of those stages produces an artifact with its own
            secrecy and ownership rules, and the cost of getting the workflow wrong is almost never a single failed proof.
            It is a system nobody else can operate safely.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="font-medium text-foreground mb-2">The workflow as a one-way pipeline</div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              The shape to hold in your head is a one-directional pipeline. The source program is compiled once, a setup
              step derives a matched pair of keys, and then each proof flows from a private witness on the left toward a
              public verification on the right. Read the diagram left to right and notice the two lanes that must never
              cross: the witness stays in the private proving lane, and only the proof plus public inputs reach the
              verifier.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Zok[.zok program] --> Compile[compile]\n  Compile --> Setup[setup]\n  Setup --> PK[proving key]\n  Setup --> VK[verification key]\n  PK --> Witness[compute-witness]\n  Witness --> Proof[generate-proof]\n  VK --> Export[export-verifier]\n  Proof --> Verify[verify]\n  Export --> Verify\n  subgraph private[Private proving lane]\n    Witness\n    Proof\n  end\n  subgraph public[Public verification]\n    Export\n    Verify\n  end`}
              caption="One source program, one setup, then every proof flows from a private witness to a public verifier. The witness never crosses into the public lane."
            />
          </div>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground leading-6">
              How this differs from Chapter 51: that chapter explained the proof-system concepts themselves, the
              statement, witness, constraints, and transcript. This chapter is concrete and operational. It treats
              ZoKrates as a tooling workflow and Rust as the orchestration, custody, and integration layer wrapped around
              it.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Mental model</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            Three ideas keep this work tractable. ZoKrates is a boundary you orchestrate rather than a library you embed.
            Proving and verifying are different shapes of service with different costs. And Ethereum integration is mostly
            artifact management plus a small amount of transport translation. Hold these and most design questions in the
            chapter answer themselves.
          </p>
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
            <h4 className="font-semibold text-foreground mb-3">
              The seven stages: write, compile, setup, compute witness, generate proof, export verifier, verify
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Every ZoKrates project moves through the same seven stages, and the most useful thing you can do as the Rust
              engineer is to notice that they do not all belong in the same place. Writing and compiling the circuit are
              source-control concerns. Setup is a one-time, trust-sensitive ceremony. Computing the witness and generating
              the proof are the heavy lifting that belongs in a worker. Exporting the verifier is a release step, and
              verification is the only stage that an external caller, including a smart contract, ever touches directly.
              The table below names each stage, the artifact it produces, who should own it, and the one operational fact
              worth remembering about it.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-4 font-semibold text-foreground">Stage</th>
                    <th className="py-2 pr-4 font-semibold text-foreground">Main artifact</th>
                    <th className="py-2 pr-4 font-semibold text-foreground">Typical owner</th>
                    <th className="py-2 font-semibold text-foreground">Operational note</th>
                  </tr>
                </thead>
                <tbody>
                  {workflowRows.map((row) => (
                    <tr key={row.stage} className="border-b border-border/60 align-top">
                      <td className="py-3 pr-4 text-foreground font-medium">{row.stage}</td>
                      <td className="py-3 pr-4 text-muted-foreground leading-6">{row.artifact}</td>
                      <td className="py-3 pr-4 text-muted-foreground leading-6">{row.owner}</td>
                      <td className="py-3 text-muted-foreground leading-6">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="font-medium text-foreground mb-2">CLI shape to keep in mind</div>
              <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{`zokrates compile -i program.zok
zokrates setup
zokrates compute-witness -a ...
zokrates generate-proof
zokrates export-verifier
zokrates verify`}</code>
              </pre>
              <p className="text-xs text-muted-foreground leading-5 mt-3">
                Stages assume default filenames unless overridden: <code className="font-mono">out</code> for the compiled
                program, <code className="font-mono">proving.key</code> and <code className="font-mono">verification.key</code> from setup,{" "}
                <code className="font-mono">witness</code> from compute-witness, and <code className="font-mono">proof.json</code> from
                generate-proof. Pass <code className="font-mono">-i</code> and <code className="font-mono">-o</code> when you
                want explicit per-circuit paths instead.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Shaping inputs so the proof program stays small</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A circuit is not a general-purpose program. Every operation it performs becomes constraints, and constraints
              are what make proving expensive, so the data you feed a ZoKrates program should already be numeric, bounded,
              and canonical. The work of turning a messy HTTP body or a JSON document into clean field elements belongs in
              Rust, before witness generation ever starts. The four guidelines below all push in the same direction: keep
              the proof program lean and let Rust absorb the irregularity of the outside world.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {proofFriendlyCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                A common modeling repair is to let Rust do transport parsing, range normalization, hashing or commitment
                preparation, and only then hand canonical numeric or committed values into the ZoKrates program.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Connecting a generated verifier to an Ethereum system
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              When a smart contract is the verifier, the boundary between your Rust services and the chain becomes the
              place where most mistakes happen. The cleanest layout keeps three responsibilities physically separate: a
              prover service that does the heavy work and emits a proof, a thin Rust submitter that encodes public inputs
              and sends the transaction, and the on-chain verifier contract that returns true or false. The submitter is
              the only component that talks to Ethereum, and it only ever sees public inputs and a proof, never a witness.
              Hold that split in mind as you read the four rules that follow.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  App[App request] --> Prover[Prover service]\n  Prover -->|proof + public inputs| Submitter[Rust submitter]\n  Submitter -->|calldata tx| Verifier[On-chain verifier]\n  Verifier -->|true / false| Submitter\n  Witness[(witness)] -.stays here.-> Prover\n  Witness -. never crosses .-x Submitter`}
              caption="The submitter is the only path to Ethereum, and it carries proof plus public inputs only. The witness stays with the prover."
            />
            <div className="grid gap-4 lg:grid-cols-2 mt-4">
              {ethereumCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                In practice Rust owns the contract address map, the public-input encoder, proof-blob transport, and the
                on-chain submission policy, including gas, confirmation, and retry. The Solidity verifier itself stays a
                generated contract artifact with its own toolchain and deployment review path. Owning the calldata is not
                the same as owning the verifier logic, and conflating the two is how teams end up shipping a contract
                nobody reviewed.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Where each stage runs: admin lane, prover worker, and verifier
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A common early mistake is to wire the whole workflow into one place, often a request handler or a
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">build.rs</code> step, because the
              prototype was small. The stages have genuinely different operational profiles, so they want different homes.
              Compile, setup, and export-verifier are infrequent and trust-sensitive and belong in a controlled CLI or CI
              lane. Witness generation and proof creation are heavy and belong in a bounded worker. Verification is light
              and belongs in a thin service or a transaction submitter. The diagram shows that separation before the cards
              describe each lane.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph admin[Admin / CI lane]\n    Compile[compile]\n    Setup[setup]\n    Export[export-verifier]\n  end\n  subgraph worker[Prover worker]\n    Wit[compute-witness]\n    Gen[generate-proof]\n  end\n  subgraph edge[Verifier / submitter]\n    Verify[verify call]\n  end\n  Compile --> Setup\n  Setup --> Wit\n  Wit --> Gen\n  Gen --> Verify\n  Export --> Verify`}
              caption="Three lanes, three operational profiles: infrequent and trusted, heavy and bounded, light and exposed."
            />
            <div className="grid gap-4 lg:grid-cols-2 mt-4">
              {orchestrationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-lg border border-border bg-muted/30 p-4">
              <div className="font-medium text-foreground mb-2">Driving a stage from Rust</div>
              <p className="text-sm text-muted-foreground leading-6 mb-3">
                Whatever lane a stage runs in, Rust ultimately shells out to the ZoKrates binary. The pattern is small but
                worth getting right: spawn the process, wait for it to finish, and translate a non-zero exit status into a
                proper Rust error instead of letting it pass silently. The helper below does exactly that, returning
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Ok(())</code> only when the
                stage actually succeeded. Read it as the success-or-error branch a worker would call once per stage.
              </p>
              <MermaidDiagram
                chart={`flowchart TD\n  Run[run_stage] --> Spawn[Command::status]\n  Spawn --> Check{status.success?}\n  Check -->|yes| Ok[Ok]\n  Check -->|no| Err[Err: stage failed]`}
                caption="Every stage invocation collapses to one decision: did the process exit cleanly, or does Rust raise an error?"
              />
              <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{commandRunnerSnippet}</code>
              </pre>
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The rule that follows from all of this: do not hide setup or proof generation inside a routine
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">build.rs</code> or a
                request-handler path. Those steps are too heavy, too stateful, and too security-sensitive to behave like
                ordinary compilation or a synchronous validation check.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Who owns each artifact, and how long it should live
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The workflow leaves a trail of files behind it, and each one has a different secrecy level and a different
              custodian. The proving key is sensitive and access-controlled; the verification key is public and ships
              inside the deployed contract; the witness is the secret you went to all this trouble to protect and should
              barely exist on disk at all. The single discipline that ties them together is version alignment: a proof, a
              key, and a verifier contract only mean anything as a matched set. The table is your checklist for keeping
              that set straight.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-4 font-semibold text-foreground">Artifact</th>
                    <th className="py-2 pr-4 font-semibold text-foreground">Secrecy</th>
                    <th className="py-2 pr-4 font-semibold text-foreground">Owner</th>
                    <th className="py-2 pr-4 font-semibold text-foreground">Retention</th>
                    <th className="py-2 font-semibold text-foreground">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {artifactRows.map((row) => (
                    <tr key={row.artifact} className="border-b border-border/60 align-top">
                      <td className="py-3 pr-4 text-foreground font-medium">{row.artifact}</td>
                      <td className="py-3 pr-4 text-muted-foreground leading-6">{row.secrecy}</td>
                      <td className="py-3 pr-4 text-muted-foreground leading-6">{row.owner}</td>
                      <td className="py-3 pr-4 text-muted-foreground leading-6">{row.retention}</td>
                      <td className="py-3 text-muted-foreground leading-6">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Testing the workflow in layers</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Proof failures are notoriously opaque: a verifier returning false tells you nothing about which of a dozen
              moving parts drifted. The cure is to test in layers and to make failures specific. Unit-test the Rust input
              normalization on its own. Contract-test local verification against known fixtures. Then keep the Ethereum
              compile-and-deploy path in its own lane. Above all, write negative tests that fail for named reasons, so an
              incident points at the wrong key or the wrong input ordering instead of a generic mystery.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {testingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter44PageIndex)}>
                Revisit Packaging
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter51PageIndex)}>
                Revisit ZKP Basics
              </Button>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Where the time and cost actually go</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Most teams assume proof generation is the expensive part and stop measuring there. It is expensive, but the
              full picture is more interesting. Witness generation, especially when Rust is hashing large payloads or
              building Merkle paths first, can dominate before the prover even starts. Verification is cheap by comparison
              but never free: on-chain it burns gas, off-chain it still parses, checks versions, and may retry. The cards
              below mark the hot lanes worth isolating and measuring.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {performanceCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                In production, queue age for proof generation, witness build time, proof size, verifier-call latency, and
                contract or RPC failure rates matter at least as much as the cryptographic happy path.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              What to plan for before calling it production-ready
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A few concerns sit outside the happy path but decide whether the system is safe to run. If the proving
              scheme relies on a trusted setup, the provenance of that setup is part of your security model, not a footnote.
              An upgrade is rarely a single switch: a new circuit usually means new keys, new proofs, and possibly a new
              contract, so plan for a window where two versions run side by side. And keep the audit surfaces distinct,
              because circuit correctness, Rust secret handling, and Solidity deployment safety are different reviews that
              should never collapse into one vague claim that the proof system is secure.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {caveatCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                Generated verifier contracts and setup artifacts are not production-safe merely because they came from a ZK
                toolchain. They still need ordinary release engineering, provenance, review, and rollback planning.
              </p>
            </div>
          </article>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How this lands by background</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            The hard part of this chapter is not the cryptography; it is resisting the instinct to fold a multi-stage,
            artifact-heavy pipeline into one tidy abstraction. What that instinct looks like depends on where you are
            coming from, so here is the mental-model shift for each starting point.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
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
                The most expensive ZoKrates integration mistake is usually not one failed proof. It is a system that never
                made circuit version, key provenance, witness secrecy, and verifier deployment boundaries explicit enough
                for another engineer to operate safely.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Examples</h3>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground leading-6">
              These examples are intentionally Rust-facing orchestration and boundary examples. They do not pretend the
              verifier contract is handwritten Rust or that the witness belongs in every request type.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 1: build a Rust orchestration plan around ZoKrates CLI stages
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The point is not to run the commands in-browser. The point is that Rust can version, render, and own the
                  pipeline explicitly before a CLI runner or service worker executes it.
                </p>
              </div>
              {codes.zokrates_workflow_command_plan !== DEFAULT_CODES.zokrates_workflow_command_plan && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("zokrates_workflow_command_plan")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the code does not run any ZoKrates command. It builds a list of
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Invocation</code> values, one per
              stage, each carrying its program, its arguments, and the artifact path it will produce. Follow
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">plan_for</code>: it derives a single
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">artifacts/&lt;circuit&gt;</code> base
              path and threads it through compile, setup, witness, proof, export, and verify so every stage agrees on where
              the previous one wrote. The diagram shows that the plan is just data, ready for a runner to execute later.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  PlanFor[plan_for] --> List[Vec of Invocation]\n  List --> I0[compile]\n  List --> I1[setup]\n  List --> I2[compute-witness]\n  List --> Cont[three more stages below]`}
              caption="First half: plan_for returns data, not side effects. It builds a typed list of invocations, one per stage."
            />
            <p className="text-sm text-muted-foreground leading-6">
              The remaining stages round out the list, and two of them produce the concrete outputs a worker reads back:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Cont[three more stages below] --> I3[generate-proof]\n  Cont --> I4[export-verifier]\n  Cont --> I5[verify]\n  I3 --> Render[render -> command string]\n  I4 --> Artifact[.sol artifact path]`}
              caption="Second half: generate-proof renders to a command string and export-verifier yields the .sol artifact path a runner can execute in order."
            />
            <RustCodeEditor
              code={codes.zokrates_workflow_command_plan}
              onChange={(newCode) => updateCode("zokrates_workflow_command_plan", newCode)}
              onRun={() => runCode("zokrates_workflow_command_plan")}
              output={outputs.zokrates_workflow_command_plan ?? null}
              isRunning={isRunning === "zokrates_workflow_command_plan"}
              filename="workflow_orchestration_plan.rs"
              expectedOutput={
                "steps = 6\ncompile = zokrates compile -i age_check.zok -o artifacts/age_check\nproof = zokrates generate-proof -i artifacts/age_check\ncontract = artifacts/AgeCheckVerifier.sol"
              }
              showResultComparison={true}
              originalCode={DEFAULT_CODES.zokrates_workflow_command_plan}
              onRevert={() => resetCode("zokrates_workflow_command_plan")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Pipeline owner</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Rust owns the sequence, arguments, and artifact paths even if ZoKrates performs the cryptographic work.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Separation of duties</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Compile, setup, proof, and verifier export are explicit stages instead of being hidden in one ad hoc
                  shell script or request handler.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Artifact path</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The generated verifier contract is already visible as a deployable file, not as a side effect nobody
                  versions later.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 2: convert a proof bundle into an Ethereum verifier call boundary
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The verifier call boundary keeps witness data out and exposes only what an Ethereum-facing contract call
                  should need: contract location, verifier function, public inputs, and proof source.
                </p>
              </div>
              {codes.zokrates_ethereum_verifier_boundary !== DEFAULT_CODES.zokrates_ethereum_verifier_boundary && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("zokrates_ethereum_verifier_boundary")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: there are two structs, and the gap between them is the whole point. The
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">ProofBundle</code> is the
              proving-side record and it includes a
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">witness_path</code>. The
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">VerifierCall</code> has no such
              field. Watch
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">to_verifier_call</code> copy across
              the contract, function, public-input count, and proof source, and simply leave the witness behind. The
              diagram traces which fields cross the boundary and which one is dropped on purpose.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph PB[ProofBundle - proving side]\n    Contract[verifier_contract]\n    Public[public_inputs]\n    ProofPath[proof_json_path]\n    Witness[witness_path]\n  end\n  Contract --> Cross[crosses the boundary]\n  Public --> Cross\n  ProofPath --> Cross\n  Witness -. dropped .-x Cross`}
              caption="First half: the proving-side ProofBundle. Three public fields cross the boundary; the witness path is dropped on purpose."
            />
            <p className="text-sm text-muted-foreground leading-6">
              Only the fields that crossed become the Ethereum-side request:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Cross[crosses the boundary] --> Call[contract + fn + inputs + proof]\n  subgraph VC[VerifierCall - Ethereum side]\n    Call\n  end`}
              caption="Second half: to_verifier_call assembles the VerifierCall from the public fields only, so the witness can never reach the chain."
            />
            <RustCodeEditor
              code={codes.zokrates_ethereum_verifier_boundary}
              onChange={(newCode) => updateCode("zokrates_ethereum_verifier_boundary", newCode)}
              onRun={() => runCode("zokrates_ethereum_verifier_boundary")}
              output={outputs.zokrates_ethereum_verifier_boundary ?? null}
              isRunning={isRunning === "zokrates_ethereum_verifier_boundary"}
              filename="ethereum_verifier_boundary.rs"
              expectedOutput={
                "contract = contracts/AgeCheckVerifier.sol\nverifier fn = verifyTx\npublic inputs = 2\nwitness leaked = false"
              }
              showResultComparison={true}
              originalCode={DEFAULT_CODES.zokrates_ethereum_verifier_boundary}
              onRevert={() => resetCode("zokrates_ethereum_verifier_boundary")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Verifier request</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The Rust boundary models what the contract call actually needs instead of reusing the proving-side type.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">No witness leak</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Witness-only fields remain proving-side custody, not Ethereum verifier input.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Version anchor</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Contract path and circuit ID belong in the proof bundle because generated verifier code is tied to one
                  proof system configuration.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Ethereum translation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Rust can own calldata preparation, retry policy, and contract address mapping without pretending it owns
                  the Solidity verifier logic itself.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch52_zokrates_workflows_ethereum_verifiers/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to split build-time and runtime responsibilities, design versioned
            artifact manifests, repair verifier-boundary trust mistakes, and plan upgrades and audits for Ethereum-oriented
            verifier deployments.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 52 Exercises
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
