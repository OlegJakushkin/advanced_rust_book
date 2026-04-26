"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "A Merkle tree compresses many leaves into one commitment",
    body: "You hash each leaf, hash pairs upward, and keep only one root as the commitment. An inclusion proof is then just the sibling path needed to reconstruct that root again.",
  },
  {
    title: "The best Rust representation is usually flat levels, not pointer-heavy nodes",
    body: "Merkle operations care about deterministic order and parent recomputation. They usually do not need `Rc` graphs or recursive ownership. A `Vec<Hash>` per level is often calmer than a tree of heap objects.",
  },
  {
    title: "Proof systems are mostly policy systems",
    body: "Odd-leaf handling, canonical serialization, domain separation, hash algorithm choice, and proof envelope versioning all matter as much as the pair-hash function itself. Two systems with different policies can compute different roots from the same logical data.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "The low-level idea is familiar if you have built hash trees or content-addressed stores before. The Rust gain is not inheritance or templates. It is that ownership, flat storage, and proof envelopes can stay small and explicit.",
  },
  {
    title: "C# background",
    body: "Do not model this as a hierarchy of node objects with ambient mutability by default. Rust is calmer when the commitment structure is an owned data buffer and proofs are small value types or DTOs.",
  },
  {
    title: "Go background",
    body: "Think less in terms of one ad hoc slice-of-slices and more in terms of one canonical layout plus explicit verification policy. The proof boundary is a contract, not only a helper function.",
  },
]

const constructionCards = [
  {
    title: "Hash trees and integrity proofs",
    body: "The root changes if any leaf changes. That is why a root is a compact integrity witness for a whole data set or state snapshot.",
  },
  {
    title: "Building a Merkle tree in Rust",
    body: "For dense trees, the most practical owner is often `Vec<Vec<Hash>>` or one working `Vec<Hash>` per level. It is deterministic, cache-friendly, and easy to serialize or parallelize.",
  },
  {
    title: "Ownership-aware tree construction",
    body: "Treat leaves and intermediate levels as owned buffers. Treat proof steps as plain values. Only introduce shared ownership when the system truly keeps several live snapshots at once.",
  },
  {
    title: "Odd leaf policy is part of the contract",
    body: "If a level has an odd count, you must state what happens. Duplicate the last leaf, carry it upward unchanged, or reject odd width. Pick one and version it in the protocol.",
  },
]

const proofChecklist = [
  "A proof needs sibling hashes in order from leaf level upward.",
  "Verification also needs left-versus-right orientation, not only sibling values.",
  "The verifier should know which leaf encoding and hash algorithm the producer used.",
  "Proof size is logarithmic in leaf count, but proof correctness still depends on the exact tree policy.",
]

const persistentCards = [
  {
    title: "Copy-on-write path updates",
    body: "If one leaf changes in a mostly immutable tree, you often only need to recompute one root path rather than rebuild every level. That is the persistent snapshot story in one sentence.",
  },
  {
    title: "Shared immutable snapshots",
    body: "If several subsystems need historic roots or proof snapshots at once, share immutable level buffers or snapshot objects explicitly. `Arc` is often enough because the snapshots are read-only.",
  },
  {
    title: "Append-friendly variants",
    body: "Some systems optimize append or rolling snapshots rather than arbitrary mutation. Keep the chapter rule in mind: separate the proof-system shape from the storage workflow shape.",
  },
]

const parallelCards = [
  {
    title: "Level-by-level parallelism",
    body: "Every parent at one level depends only on one adjacent pair below it. That makes each level embarrassingly parallel, even if the whole tree still builds upward in stages.",
  },
  {
    title: "Do not parallelize tiny upper levels blindly",
    body: "Near the root, there may be only a handful of hashes left. Worker wakeup and coordination can cost more than the remaining pair hashes. Add a threshold.",
  },
  {
    title: "Rayon is a good ecosystem fit",
    body: "A common production shape is `par_chunks(2)` over one level, then one sequential loop between levels. That keeps CPU saturation local and leaves proof semantics unchanged.",
  },
]

const serializationCards = [
  {
    title: "Canonical leaf encoding",
    body: "The leaf bytes must be reproducible across processes and languages. Version the encoding, pin endianness, and avoid letting debug formatting become the protocol.",
  },
  {
    title: "Proof envelopes",
    body: "A proof message should usually carry hash algorithm ID, tree policy version, leaf index, leaf count, and the sibling list. The root alone is not enough metadata for robust interop.",
  },
  {
    title: "Content-addressed storage",
    body: "Once chunks are keyed by hash, a Merkle root becomes a compact summary of one full object or snapshot. That is where integrity and deduplication meet.",
  },
]

const challengeCards = [
  {
    title: "Challenge · content-addressed storage",
    body: "Store chunks by hash, build object roots from ordered chunk hashes, and verify partial fetches with proofs before trusting the payload.",
  },
  {
    title: "Challenge · tamper-evident game state",
    body: "Hash one turn or one tick into each leaf, publish roots at checkpoints, and use proofs to explain or dispute one claimed state transition later.",
  },
  {
    title: "Challenge · distributed verification",
    body: "Move proofs across queues or peers as versioned DTOs, batch verification work, and instrument proof failures as protocol events rather than as generic parse errors.",
  },
]

const productionPatterns = [
  "Use a cryptographic hash in production, even if the chapter demos use a tiny deterministic hash to keep browser examples self-contained.",
  "Domain-separate leaf hashing from internal-node hashing so two different object shapes cannot accidentally collide under the same byte stream.",
  "Keep the tree layout flat unless you have a real need for pointer-rich navigation. Proof generation and verification usually prefer flat buffers anyway.",
  "Version odd-leaf policy, leaf encoding, and proof envelope shape together. These are protocol choices, not implementation details.",
  "Parallelize one level at a time and add a threshold so tiny upper levels do not pay thread or task overhead for no gain.",
  "Store enough metadata with proofs that another process can reproduce the same commitment rule without guessing.",
]

const pitfalls = [
  "Using a non-cryptographic hash in a real integrity system and then treating the result like a security commitment.",
  "Forgetting domain separation and accidentally hashing leaves and internal nodes under the same byte contract.",
  "Dropping left-or-right orientation from the proof path and discovering later that verification is ambiguous.",
  "Letting one side duplicate odd leaves while another side carries them upward unchanged. The roots will disagree and both sides may still look locally correct.",
  "Recomputing the whole tree for tiny updates when the workload really wants a copy-on-write or append-friendly variant.",
  "Parallelizing every level indiscriminately and paying more in scheduling overhead than the top levels are worth.",
]

const summaryPoints = [
  "Merkle trees turn many leaves into one commitment root and logarithmic inclusion proofs.",
  "Rust representations are usually calmest when the tree is owned as flat levels and proofs are plain value types.",
  "Proof correctness depends on policy details such as canonical leaf encoding, domain separation, and odd-leaf handling.",
  "Persistent and append-friendly variants are workflow decisions layered on top of the same commitment idea.",
  "Parallel construction is straightforward per level, but only worth it when the level is large enough to amortize scheduling overhead.",
]

const proofEnvelopeSnippet = `struct ProofEnvelope {
    hash_alg: &'static str,
    tree_version: u16,
    leaf_index: u64,
    leaf_count: u64,
    siblings: Vec<ProofStepWire>,
}`

const rayonSnippet = `// ecosystem option for wide levels
let next: Vec<Hash> = current
    .par_chunks(2)
    .map(|pair| {
        let left = pair[0];
        let right = if pair.len() == 2 { pair[1] } else { pair[0] };
        hash_node(left, right)
    })
    .collect();`

const treeDiagram = `root
├─ H(n0 || n1)
│  ├─ H(leaf0)
│  └─ H(leaf1)
└─ H(n2 || n3)
   ├─ H(leaf2)
   └─ H(leaf3)`

export function PageCh38MerkleTreeGamesAndChallenges() {
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
  const pageIndex = getPageIndexById("ch38-merkle-tree-games-and-challenges")
  const chapter19PageIndex = getPageIndexById("ch19-serialization-and-data-contracts")
  const chapter26PageIndex = getPageIndexById("ch26-task-libraries-and-parallel-execution")
  const chapter31PageIndex = getPageIndexById("ch31-distributed-task-execution")
  const chapter37PageIndex = getPageIndexById("ch37-cuda-and-gpu-acceleration")
  const exercisesPageIndex = getPageIndexById("ch38-merkle-tree-games-and-challenges-exercises")
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
          Chapter 38 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Merkle trees become useful in production the moment integrity, replay, and distributed verification stop being abstract
          cryptography topics and become ordinary system boundaries.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 19, 26, 31, and 37</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 19 covered versioned serialization. Chapter 26 covered bounded parallel execution. Chapter 31 covered
                distributed task replay and trace lineage. Chapter 37 covered expensive specialist workers and explicit boundary
                budgeting. Merkle systems touch all four.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter19PageIndex)}>
                Chapter 19
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter26PageIndex)}>
                Chapter 26
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter31PageIndex)}>
                Chapter 31
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter37PageIndex)}>
                Chapter 37
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            You are shipping three related features at once. A patch service wants content-addressed chunk storage. A multiplayer
            game wants tamper-evident state checkpoints. A distributed verifier wants to reject bad data early without downloading
            whole objects. The shared need is not “store a binary tree.” The shared need is this: commit to many leaves once, move
            a small proof around later, and make both sides agree on exactly how that commitment was built.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="font-medium text-foreground mb-2">One small tree, one compact root</div>
            <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{treeDiagram}</code>
            </pre>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">At a glance</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Commitment systems stay interoperable only when leaf encoding, internal-node hashing, and odd-leaf policy are explicit.</li>
              <li>Flat levels usually beat pointer-rich trees for proof generation, serialization, and parallel construction.</li>
              <li>Proof verification needs sibling orientation as well as sibling values.</li>
              <li>Persistent snapshots, distributed verification, and content-addressed storage are workflow choices layered on top of the same commitment idea.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">Review lens</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Could another service reproduce the same root from the same leaves without guessing?</li>
              <li>Is the proof envelope versioned strongly enough for cross-process or cross-language use?</li>
              <li>Does the storage model fit the real workload: rebuild, append, snapshot, or distributed verification?</li>
              <li>If the build is parallel, where does it stop being worth the scheduling overhead?</li>
            </ul>
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
            <h4 className="font-semibold text-foreground mb-3">Hash trees and integrity proofs</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {constructionCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A Merkle proof is not a re-serialization of the whole tree. It is the minimum sibling path needed to rebuild the
                same root from one leaf and one policy set.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Proof generation and verification</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {proofChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Persistent tree variants</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {persistentCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Parallel Merkle tree construction</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {parallelCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{rayonSnippet}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Serialization formats</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {serializationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{proofEnvelopeSnippet}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Games and challenge patterns</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {challengeCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Comparison callout</h4>
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
                The most common Merkle bug is not a bad hash function call. It is two systems quietly disagreeing on leaf encoding,
                node domain separation, or odd-leaf policy while both sides still look locally “correct.”
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Worked examples</h3>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The browser examples use a tiny deterministic 32-bit demo hash so the tree logic stays runnable without external
              crates. In production, swap the hash function for a real cryptographic primitive and keep the envelope policy explicit.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 1: build a tree, emit a proof, verify one leaf</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  One owner keeps all levels. The proof is just a sibling path plus orientation bits. No pointer graph is needed.
                </p>
              </div>
              {codes.merkle_tree_basic_proof !== DEFAULT_CODES.merkle_tree_basic_proof && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("merkle_tree_basic_proof")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.merkle_tree_basic_proof}
              onChange={(newCode) => updateCode("merkle_tree_basic_proof", newCode)}
              onRun={() => runCode("merkle_tree_basic_proof")}
              output={outputs.merkle_tree_basic_proof ?? null}
              isRunning={isRunning === "merkle_tree_basic_proof"}
              filename="basic_merkle_tree.rs"
              expectedOutput={"leaf count = 4\nproof len = 2\nverified = true"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.merkle_tree_basic_proof}
              onRevert={() => resetCode("merkle_tree_basic_proof")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Storage</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Each level is a flat vector. The root is just the last level’s first element.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Proof</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Verification needs sibling order as well as sibling value. That direction bit is part of the contract.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Ownership</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The tree owns its levels. Proof steps are copyable values that move easily across process boundaries.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: parallelize one level at a time</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The example uses scoped threads to keep the model crate-free in the browser. The important point is the level
                  boundary, not one specific scheduler choice.
                </p>
              </div>
              {codes.merkle_parallel_levels !== DEFAULT_CODES.merkle_parallel_levels && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("merkle_parallel_levels")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.merkle_parallel_levels}
              onChange={(newCode) => updateCode("merkle_parallel_levels", newCode)}
              onRun={() => runCode("merkle_parallel_levels")}
              output={outputs.merkle_parallel_levels ?? null}
              isRunning={isRunning === "merkle_parallel_levels"}
              filename="parallel_merkle_levels.rs"
              expectedOutput={"leaves = 8\nlevels = 4\nroots match = true"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.merkle_parallel_levels}
              onRevert={() => resetCode("merkle_parallel_levels")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Parallel unit</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Pair hashing inside one level is independent work. The next level boundary is the synchronization point.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Threshold note</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Near the root, parallel overhead can dominate. Production code should stop parallelizing once the level gets small.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Distributed fit</div>
                <p className="text-xs text-muted-foreground leading-5">
                  This same level-wise shape is easy to batch inside a GPU lane or a distributed verification worker later.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch38_merkle_tree_games_and_challenges/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to implement a small Merkle API, verify an inclusion proof, reason about
            canonical serialization, and design content-addressed, tamper-evident, and distributed verification systems with
            visible scoring tracks.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 38 Exercises
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
