"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const workflowDiagram = `write .zok computation
  -> compile
  -> setup
  -> compute-witness
  -> generate-proof
  -> export-verifier
  -> verify locally and/or deploy verifier contract`

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
    title: "ZoKrates is a workflow boundary, not a handwritten Rust proving library.",
    body: "Rust usually orchestrates the CLI or wraps a proving service boundary. The generated verifier contract, proof blobs, witness files, and setup material are artifacts with custody rules, not ordinary in-memory structs pretending to be the whole system.",
  },
  {
    title: "The prover and the verifier are different service shapes.",
    body: "Proving is heavy: witness generation, setup assumptions, proof generation, and artifact storage. Verification is smaller: public inputs plus proof artifact, maybe on-chain, maybe off-chain. If one handler does both inline, the topology is probably already wrong.",
  },
  {
    title: "Ethereum integration is artifact management plus transport translation.",
    body: "A generated Solidity verifier is a deployment artifact tied to one circuit and one verification key. Rust should prepare public inputs, track contract addresses by version, and keep witness material out of the verifier request entirely.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Treat ZoKrates more like a specialized compiler toolchain plus artifact pipeline than like a linkable library you casually call from hot code. Rust adds value by making process boundaries, file custody, and typed public-input boundaries explicit.",
  },
  {
    title: "C# background",
    body: "Do not expect runtime reflection or one framework object to describe the workflow for you. Rust stays calm when the orchestration layer is explicit about commands, artifacts, and ownership, especially once proofs or verifier calls cross queues or services.",
  },
  {
    title: "Go background",
    body: "A proof pipeline is not just another goroutine stage. Witness generation and proof creation are heavyweight jobs with artifact custody, retry, and resource budgets. Rust makes that topology easier to review when the types separate prover and verifier concerns directly.",
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
            A proof-backed compliance service needs Ethereum-oriented verification of a statement without exposing witness
            data. The business requirement is to manage the full ZoKrates artifact workflow: proof-friendly inputs,
            compile and setup stages, witness custody, proof generation, generated verifier deployment, and versioned
            verification requests.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="font-medium text-foreground mb-2">Workflow pipeline</div>
            <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{workflowDiagram}</code>
            </pre>
          </div>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground leading-6">
              Senior-level correction: Chapter 51 explained proof-system concepts. This chapter is about ZoKrates as a
              tooling workflow and about Rust as the orchestration, custody, and integration layer around it.
            </p>
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

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              ZoKrates workflow: write computation, compile, setup, compute witness, generate proof, export verifier, and verify
            </h4>
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
            <h4 className="font-semibold text-foreground mb-3">Modeling inputs and outputs for proof-friendly programs</h4>
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
              Integrating generated verifiers with Ethereum-oriented systems
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {ethereumCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                Rust should usually own the contract address map, public-input encoder, proof-blob transport, and on-chain
                submission policy. The Solidity verifier itself remains a generated contract artifact with its own normal
                Solidity toolchain and deployment review path.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Calling ZoKrates workflows from Rust build, CLI, or service boundaries
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {orchestrationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{commandRunnerSnippet}</code>
            </pre>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                Strong recommendation: do not hide setup or proof generation inside routine `build.rs` or request-handler
                paths. Those steps are too heavy, too stateful, or too security-sensitive to behave like ordinary Rust
                compilation or synchronous validation.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Managing artifacts: programs, proving keys, verification keys, witnesses, proofs, and verifier contracts
            </h4>
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
            <h4 className="font-semibold text-foreground mb-3">Testing proof workflows and reproducibility</h4>
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
            <h4 className="font-semibold text-foreground mb-3">Performance and operational constraints</h4>
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
              Production caveats, audit boundaries, and upgrade strategy
            </h4>
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

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Comparison callout</h4>
            <div className="grid gap-3 lg:grid-cols-3">
              {comparisonCallouts.map((comparison) => (
                <div key={comparison.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
                </div>
              ))}
            </div>
          </article>
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
````

### File: `components/rust-book/pages/page-ch52-zokrates-workflows-ethereum-verifiers-exercises.tsx`
```tsx
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
    title: "Split the ZoKrates workflow into build-time, release-time, and runtime responsibilities",
    objective:
      "Practice assigning each ZoKrates step to the right operational lane instead of letting the whole pipeline collapse into one opaque script.",
    starterPrompt:
      "Classify `compile`, `setup`, `compute-witness`, `generate-proof`, `export-verifier`, and `verify` across build-time, release-time, and runtime boundaries for one proof-backed service.",
    prompts: [
      "Which steps happen once per circuit or release rather than once per request?",
      "Which steps belong in a proving worker instead of a request handler?",
      "Which steps can happen in CI or a controlled admin CLI lane rather than in build.rs?",
      "Which step should stay verifier-side and witness-free?",
    ],
    acceptanceCriteria: [
      "You place compile, setup, witness generation, proof generation, export, and verification in distinct operational lanes.",
      "You identify at least one step that should not run per request.",
      "You explain why verifier input should exclude witness material.",
    ],
    hints: [
      "Start by asking which artifact is expensive and which one is durable.",
      "A good answer treats proof generation like a worker job, not like a tiny helper function.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Review a proof workflow for proof-friendly input modeling",
    objective:
      "Spot the places where transport-shaped data is being pushed into the ZoKrates boundary without enough normalization or commitment discipline.",
    starterPrompt:
      "A Rust API currently forwards raw JSON strings, variable-length lists, and unbounded notes fields directly into a proof step that is supposed to justify only one public total and one public limit.",
    prompts: [
      "Which parts should become canonical numeric inputs before witness generation?",
      "Which large or irregular fields should become commitments or stay witness-only?",
      "Which fields should never become public verifier inputs just because they already existed in the HTTP payload?",
      "Which tests would prove the normalization contract is stable across versions?",
    ],
    acceptanceCriteria: [
      "You identify at least one field that should be normalized in Rust before the ZoKrates step.",
      "You identify at least one field that should remain witness-only or become a commitment.",
      "You mention at least one reproducibility or contract test for the mapping.",
    ],
    hints: [
      "Transport convenience and proof convenience are rarely the same thing.",
      "If the verifier does not need a field, it probably should not become a public input by accident.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Design a versioned artifact manifest for proof generation and verification",
    objective:
      "Build a small Rust-facing manifest that keeps circuit, keys, proof blobs, and verifier contract metadata attributable.",
    starterPrompt:
      "Design one `ArtifactManifest` or equivalent set of Rust types that names a circuit ID, proving key ID, verification key ID, proof path, and verifier contract path or address.",
    prompts: [
      "Keep proving-side and verifying-side metadata distinguishable.",
      "Include one protocol or circuit version field.",
      "Decide which artifact fields are safe to expose to verifier callers and which are proving-only.",
      "Think about retention policy and auditability while naming the fields.",
    ],
    acceptanceCriteria: [
      "Your design names at least four distinct artifacts explicitly.",
      "You include one version or circuit-identity field.",
      "You separate at least one proving-only field from a verifier-facing field.",
      "The resulting type set is small enough for another engineer to review quickly.",
    ],
    hints: [
      "If one struct does every job, the custody model is probably too vague.",
      "Versioning belongs on artifacts early, not after the first migration failure.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair a verifier integration that leaks witness or mixes versions",
    objective:
      "Fix the most common production mistakes around verifier requests: witness exposure, wrong key pairing, or wrong contract version.",
    starterPrompt:
      "You inherit a verifier service that stores witness paths next to verifier request DTOs, chooses the verifier contract from a mutable config string at runtime, and sometimes pairs a new proof blob with an older verification key.",
    prompts: [
      "Which fields should disappear from verifier-facing request types immediately?",
      "How should contract address or path selection become versioned and explicit?",
      "Which key or circuit mismatch should fail before any external verifier call is attempted?",
      "Which log or trace fields belong on that failure path?",
    ],
    acceptanceCriteria: [
      "You remove at least one witness-related field from the verifier boundary.",
      "You define one explicit version or key-matching rule.",
      "You identify one preflight validation that should fail before a verifier call or transaction submit happens.",
      "You mention at least one structured field such as circuit ID, key ID, or contract version.",
    ],
    hints: [
      "If the verifier can see the witness path, the boundary is already too wide.",
      "Version mismatch is a contract failure, not a 'maybe verify and see' runtime strategy.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Design reproducibility and negative tests for the proof pipeline",
    objective:
      "Turn proof generation and verification into a testable workflow rather than a one-off manual command sequence.",
    starterPrompt:
      "You want CI confidence that proof generation still works after refactors, and that wrong inputs, wrong versions, or wrong keys fail clearly rather than failing as one generic false result.",
    prompts: [
      "Which artifact versions should be pinned in CI fixtures?",
      "Which negative cases must exist: wrong public inputs, wrong verification key, wrong contract version, or wrong witness?",
      "Where should you use native verification versus Ethereum-oriented verifier tests?",
      "How would you keep the fixtures reproducible and reviewable over time?",
    ],
    acceptanceCriteria: [
      "You define at least two positive and two negative workflow tests.",
      "You separate native verify tests from contract or deploy-path tests.",
      "You mention at least one artifact pinning or manifest rule that improves reproducibility.",
      "You explain how failing cases become attributable rather than generic.",
    ],
    hints: [
      "A fast native verify path is a good first CI gate, but it is not the same as a deploy-path test.",
      "The best negative test is the one that tells you which contract or artifact drifted.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Plan audits, upgrades, and rollout for an Ethereum verifier integration",
    objective:
      "Make trusted setup, verifier deployment, dual-version rollout, and operational ownership explicit before the first circuit upgrade.",
    starterPrompt:
      "You are shipping a proof-backed service whose verifier contract lives in an Ethereum-oriented environment. A circuit update is coming, setup provenance matters, and operators want canary rollout plus rollback.",
    prompts: [
      "Which audit surfaces exist separately: proving scheme assumptions, circuit logic, Rust artifact custody, and Solidity verifier deployment?",
      "How will old and new verifier versions coexist during rollout?",
      "Which artifact or address mapping must be published for operators and downstream consumers?",
      "Which telemetry or failure rates gate promotion or trigger rollback?",
    ],
    acceptanceCriteria: [
      "You name at least three distinct audit or review surfaces.",
      "You describe one mixed-version rollout or dual-verifier strategy.",
      "You include at least one published artifact mapping such as circuit ID to contract address.",
      "You mention at least two rollout signals such as verification failure rate, proving queue age, or contract-submit failure rate.",
    ],
    hints: [
      "An upgrade is rarely just one code deploy. It is usually one artifact and contract migration too.",
      "Keep the rollback story boring enough that another engineer can execute it under pressure.",
    ],
  },
]

const reviewQuestions = [
  "Why should compile and setup usually live in different operational lanes from witness generation and proof generation?",
  "What makes a proof request different from a verifier request in Rust terms?",
  "Why is contract or key version drift often a bigger operational risk than one single failed proof?",
  "What does native verification prove, and what does it not prove about the Ethereum deployment path?",
  "Why should generated verifier contracts still go through normal Solidity review and release discipline?",
]

const workingLoop = [
  "State which inputs are public, private, or artifact identifiers first.",
  "Assign each ZoKrates step to build-time, release-time, or runtime explicitly.",
  "Keep verifier-facing request types witness-free.",
  "Version circuit IDs, keys, and verifier contracts together.",
  "Test both happy-path and wrong-version or wrong-key failures before rollout.",
]

const artifactChecklist = [
  "Circuit or program ID is explicit and versioned.",
  "Proving key and verification key identifiers are stored separately.",
  "Witness retention policy is explicit and usually short-lived.",
  "Proof artifact and verifier contract path or address are attributable.",
  "CI exercises both native verify and at least one deployment-facing verifier check.",
]

export function PageCh52ZoKratesWorkflowsAndEthereumVerifiersExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch52-zokrates-workflows-ethereum-verifiers-exercises")
  const mainPageIndex = getPageIndexById("ch52-zokrates-workflows-ethereum-verifiers")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 52 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice ZoKrates and Ethereum verifier integration the way it survives review: split workflow ownership, version
          artifacts deliberately, keep witnesses out of verifier boundaries, and plan upgrades and audits before the first
          mixed deployment.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a workflow and trust-boundary review. The strongest answer does not stop at
                “generate a proof.” It says which stage runs where, which artifacts are versioned, who may see the witness,
                how verifier requests stay small, and how rollout stays reviewable later.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 52
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

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Artifact checklist</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {artifactChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
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
                  ZoKrates drill
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
          title="Runnable lab · Build a verifier request without leaking witness material"
          description={
            <>
              Repair the starter so the verifier-facing request is built from the verifier contract, proof path, and public
              input count only. The witness path exists in the proving artifact bundle but must not be exposed as part of
              the verifier request boundary.
            </>
          }
          filename="verifier_request_boundary.rs"
          runKey="ch52_ex_verifier_request"
          expectedOutput={
            "contract = contracts/AgeCheckVerifier.sol\npublic inputs = 2\nwitness included = false"
          }
          helperText={
            <>
              Tip: clone the verifier contract path, count the public inputs with{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">len()</code>, keep the proof path on the
              request, and make <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">witness_included</code>{" "}
              explicitly false.
            </>
          }
          initialCode={`#[derive(Debug, Clone)]
struct ProofBundle {
    verifier_contract: String,
    public_inputs: Vec<String>,
    proof_path: String,
    witness_path: String,
}

#[derive(Debug, Clone)]
struct VerificationRequest {
    contract: String,
    public_inputs_len: usize,
    proof_path: String,
    witness_included: bool,
}

fn to_verification_request(bundle: &ProofBundle) -> VerificationRequest {
    VerificationRequest {
        contract: String::new(),
        public_inputs_len: 0,
        proof_path: bundle.witness_path.clone(),
        witness_included: true,
    }
}

fn main() {
    let bundle = ProofBundle {
        verifier_contract: String::from("contracts/AgeCheckVerifier.sol"),
        public_inputs: vec![String::from("45"), String::from("50")],
        proof_path: String::from("artifacts/proof.json"),
        witness_path: String::from("artifacts/witness"),
    };

    let request = to_verification_request(&bundle);

    println!("contract = {}", request.contract);
    println!("public inputs = {}", request.public_inputs_len);
    println!("witness included = {}", request.witness_included);
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
            By the end of this page, you should be able to place each ZoKrates step in the right operational lane, design
            versioned artifact manifests another engineer can audit, keep verifier requests witness-free, and explain how
            upgrades, contract deployment, and proof verification stay safe and reviewable in a real Ethereum-oriented
            system.
          </p>
        </section>
      </div>
    </div>
  )
}
````

### File: `examples/ch52_zokrates_workflows_ethereum_verifiers/workflow_orchestration_plan.rs`
````
use std::path::PathBuf;

#[derive(Debug, Clone)]
struct Invocation {
    stage: &'static str,
    program: &'static str,
    args: Vec<String>,
    artifact: PathBuf,
}

fn plan_for(circuit: &str, witness_args: &[&str]) -> Vec<Invocation> {
    let compiled = format!("artifacts/{}", circuit);
    vec![
        Invocation {
            stage: "compile",
            program: "zokrates",
            args: vec![
                "compile".into(),
                "-i".into(),
                format!("{}.zok", circuit),
                "-o".into(),
                compiled.clone(),
            ],
            artifact: PathBuf::from(&compiled),
        },
        Invocation {
            stage: "setup",
            program: "zokrates",
            args: vec!["setup".into(), "-i".into(), compiled.clone()],
            artifact: PathBuf::from("artifacts/proving.key"),
        },
        Invocation {
            stage: "compute-witness",
            program: "zokrates",
            args: {
                let mut args = vec![
                    "compute-witness".into(),
                    "-i".into(),
                    compiled.clone(),
                    "-a".into(),
                ];
                args.extend(witness_args.iter().map(|value| value.to_string()));
                args
            },
            artifact: PathBuf::from("artifacts/witness"),
        },
        Invocation {
            stage: "generate-proof",
            program: "zokrates",
            args: vec!["generate-proof".into(), "-i".into(), compiled.clone()],
            artifact: PathBuf::from("artifacts/proof.json"),
        },
        Invocation {
            stage: "export-verifier",
            program: "zokrates",
            args: vec!["export-verifier".into(), "-i".into(), compiled.clone()],
            artifact: PathBuf::from("artifacts/AgeCheckVerifier.sol"),
        },
        Invocation {
            stage: "verify",
            program: "zokrates",
            args: vec!["verify".into(), "-i".into(), compiled],
            artifact: PathBuf::from("artifacts/verify.log"),
        },
    ]
}

fn render(invocation: &Invocation) -> String {
    format!("{} {}", invocation.program, invocation.args.join(" "))
}

fn main() {
    let plan = plan_for("age_check", &["18", "21"]);

    println!("steps = {}", plan.len());
    println!("compile = {}", render(&plan[0]));
    println!("proof = {}", render(&plan[3]));
    println!("contract = {}", plan[4].artifact.display());
}
````

### File: `examples/ch52_zokrates_workflows_ethereum_verifiers/ethereum_verifier_boundary.rs`
````
#[derive(Debug, Clone)]
struct ProofBundle {
    circuit_id: String,
    verifier_contract: String,
    public_inputs: Vec<String>,
    proof_json_path: String,
    witness_path: String,
}

#[derive(Debug, Clone)]
struct VerifierCall {
    contract: String,
    function: &'static str,
    public_inputs_len: usize,
    proof_source: String,
}

fn to_verifier_call(bundle: &ProofBundle) -> VerifierCall {
    VerifierCall {
        contract: bundle.verifier_contract.clone(),
        function: "verifyTx",
        public_inputs_len: bundle.public_inputs.len(),
        proof_source: bundle.proof_json_path.clone(),
    }
}

fn main() {
    let bundle = ProofBundle {
        circuit_id: String::from("age-check:v2"),
        verifier_contract: String::from("contracts/AgeCheckVerifier.sol"),
        public_inputs: vec![String::from("45"), String::from("50")],
        proof_json_path: String::from("artifacts/proof.json"),
        witness_path: String::from("artifacts/witness"),
    };

    let call = to_verifier_call(&bundle);
    let witness_leaked = call.proof_source.contains("witness");

    println!("contract = {}", call.contract);
    println!("verifier fn = {}", call.function);
    println!("public inputs = {}", call.public_inputs_len);
    println!("witness leaked = {}", witness_leaked);
}
````

### File: `components/rust-book/pages/index.ts`
````diff
--- components/rust-book/pages/index.ts
+++ components/rust-book/pages/index.ts
@@ -99,4 +99,6 @@ export { PageCh49HttpsTlsSecureServiceBoundaries } from "./page-ch49-https-tls-s
 export { PageCh49HttpsTlsSecureServiceBoundariesExercises } from "./page-ch49-https-tls-secure-service-boundaries-exercises"
 export { PageCh50Libp2pPeerToPeerRustSystems } from "./page-ch50-libp2p-peer-to-peer-rust-systems"
 export { PageCh50Libp2pPeerToPeerRustSystemsExercises } from "./page-ch50-libp2p-peer-to-peer-rust-systems-exercises"
 export { PageCh51ZeroKnowledgeProofsRustEngineers } from "./page-ch51-zero-knowledge-proofs-rust-engineers"
 export { PageCh51ZeroKnowledgeProofsRustEngineersExercises } from "./page-ch51-zero-knowledge-proofs-rust-engineers-exercises"
+export { PageCh52ZoKratesWorkflowsAndEthereumVerifiers } from "./page-ch52-zokrates-workflows-ethereum-verifiers"
+export { PageCh52ZoKratesWorkflowsAndEthereumVerifiersExercises } from "./page-ch52-zokrates-workflows-ethereum-verifiers-exercises"
````

### File: `components/rust-book/index.tsx`
````diff
--- components/rust-book/index.tsx
+++ components/rust-book/index.tsx
@@ -111,6 +111,8 @@ import {
   PageCh50Libp2pPeerToPeerRustSystemsExercises,
   PageCh51ZeroKnowledgeProofsRustEngineers,
   PageCh51ZeroKnowledgeProofsRustEngineersExercises,
+  PageCh52ZoKratesWorkflowsAndEthereumVerifiers,
+  PageCh52ZoKratesWorkflowsAndEthereumVerifiersExercises,
 } from "./pages"
 
 const PAGE_COMPONENTS = [
@@ -217,6 +219,8 @@ const PAGE_COMPONENTS = [
   PageCh50Libp2pPeerToPeerRustSystemsExercises,
   PageCh51ZeroKnowledgeProofsRustEngineers,
   PageCh51ZeroKnowledgeProofsRustEngineersExercises,
+  PageCh52ZoKratesWorkflowsAndEthereumVerifiers,
+  PageCh52ZoKratesWorkflowsAndEthereumVerifiersExercises,
 ]
 
 function BookContent() {
````

### File: `components/rust-book/rust-simulator.ts`
````diff
--- components/rust-book/rust-simulator.ts
+++ components/rust-book/rust-simulator.ts
@@ -1,3 +1,4 @@
+import { simulateCh52Output } from "./rust-simulator-ch52"
 import { simulateCh51Output } from "./rust-simulator-ch51"
 import { simulateCh50Output } from "./rust-simulator-ch50"
 import { simulateCh49Output } from "./rust-simulator-ch49"
@@ -1029,6 +1030,9 @@ function findCompilationError(code: string, filename: string): string | null {
 export function simulateRustExecution(code: string, key?: string, filename = "main.rs"): string {
   const compilationError = findCompilationError(code, filename)
   if (compilationError) return compilationError
+
+  const ch52Output = simulateCh52Output(code, key)
+  if (ch52Output !== null) return ch52Output
 
   const ch51Output = simulateCh51Output(code, key)
   if (ch51Output !== null) return ch51Output
````

### File: `components/rust-book/types.ts`
````diff
--- components/rust-book/types.ts
+++ components/rust-book/types.ts
@@ -40,6 +40,7 @@ import { DEFAULT_CODES_CH47 } from "./default-codes-ch47"
 import { DEFAULT_CODES_CH48 } from "./default-codes-ch48"
 import { DEFAULT_CODES_CH49 } from "./default-codes-ch49"
 import { DEFAULT_CODES_CH50 } from "./default-codes-ch50"
 import { DEFAULT_CODES_CH51 } from "./default-codes-ch51"
+import { DEFAULT_CODES_CH52 } from "./default-codes-ch52"
 
 export interface PageConfig {
   id: string
@@ -1284,6 +1285,28 @@ export const CHAPTERS: ChapterConfig[] = [
         description:
           "Separate public inputs from witnesses, isolate proving from verification, fix transcript drift, and threat-model proof-backed APIs",
         icon: "trophy",
+      },
+    ],
+  },
+  {
+    id: "ch52-zokrates-workflows-ethereum-verifiers",
+    title: "Chapter 52 · ZoKrates Workflows and Ethereum Verifiers",
+    icon: "book",
+    pages: [
+      {
+        id: "ch52-zokrates-workflows-ethereum-verifiers",
+        title: "ZoKrates Workflows and Ethereum Verifiers",
+        shortTitle: "ZoKrates and Ethereum",
+        description:
+          "ZoKrates CLI workflow, proof-friendly modeling, Ethereum verifier integration, Rust orchestration, artifact custody, reproducibility, performance limits, and production caveats",
+        icon: "book",
+        codeKeys: ["zokrates_workflow_command_plan", "zokrates_ethereum_verifier_boundary"],
+      },
+      {
+        id: "ch52-zokrates-workflows-ethereum-verifiers-exercises",
+        title: "Chapter 52 Exercises",
+        shortTitle: "Exercises",
+        description:
+          "Split build-time and runtime proof responsibilities, design artifact manifests, repair verifier boundaries, and plan upgrades and audits",
+        icon: "trophy",
       },
     ],
   },
@@ -1755,5 +1778,6 @@ export const DEFAULT_CODES: Record<string, string> = {
   ...DEFAULT_CODES_CH49,
   ...DEFAULT_CODES_CH50,
   ...DEFAULT_CODES_CH51,
+  ...DEFAULT_CODES_CH52,
 }
 export interface BookState {
````