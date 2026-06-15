"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "A Merkle tree compresses many leaves into one commitment",
    body: "You hash each leaf, hash pairs upward, and keep only one root as the commitment. An inclusion proof is then just the sibling path needed to reconstruct that root again.",
  },
  {
    title: "The best Rust representation is usually flat levels, not pointer-heavy nodes",
    body: "Merkle operations care about deterministic order and parent recomputation. They usually do not need `Rc` graphs or recursive ownership. A `Vec<Hash>` per level is often simpler than a tree of heap objects.",
  },
  {
    title: "Proof systems are mostly policy systems",
    body: "Odd-leaf handling, canonical serialization, domain separation, hash algorithm choice, and proof envelope versioning all matter as much as the pair-hash function itself. Two systems with different policies can compute different roots from the same logical data.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "If you have built content-addressed stores or hash trees in C++, the algorithm is familiar territory. The shift is what you reach for to represent it. Resist the urge to build a node class with raw or smart pointers and parent links; in Rust the natural commitment is an owned byte buffer of flat levels, and a proof is a small value you can copy and send anywhere. You lose nothing in control and gain a structure that serializes and parallelizes without aliasing worries.",
  },
  {
    title: "C# background",
    body: "Do not model the tree as a graph of node objects with reference semantics and ambient mutability. That instinct fights the grain of the problem: a Merkle commitment is fundamentally immutable once built, and Rust makes that cheap to express as an owned data structure. Think of the proof as a DTO — a plain value type with no hidden references — that crosses a process boundary intact, and think of verification policy as a versioned contract rather than a method you can quietly change.",
  },
  {
    title: "Go background",
    body: "Your instinct to keep things flat is correct, but go one step further than an ad-hoc slice-of-slices. The thing that travels between services is not the tree; it is the proof plus the policy that produced it. Treat that policy — leaf encoding, domain separation, odd-leaf handling, hash choice — as an explicit, versioned contract, the same way you would version a wire format, not as private behavior buried in a helper function.",
  },
  {
    title: "Python background",
    body: "If you have used Merkle roots in ML data versioning, IPFS-style stores, or blockchain libraries, you have mostly consumed roots and proofs, not produced them under a guaranteed-reproducible policy. The Rust shift is that the byte-level details you could ignore behind a library now belong to you: leaf encoding must be pinned, hashing must be domain-separated, and the proof envelope must carry enough metadata for another process — in any language — to recompute the same root without guessing.",
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
    body: "If one leaf changes in a mostly immutable tree, you often only need to recompute one root path rather than rebuild every level. That is the persistent-snapshot idea in one sentence.",
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
  "Rust representations are usually simplest when the tree is owned as flat levels and proofs are plain value types.",
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
          Merkle-based systems support integrity checks, replay resistance, and distributed verification. This chapter
          applies hash trees to production audit, challenge, and synchronization workflows.
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
            Three teams arrive at the same primitive from different directions. A patch service wants to prove that the
            120 MB update a client just downloaded is bit-for-bit the file the build server published, without re-sending
            the whole thing. A game backend wants tamper-evident match history, so a disputed score can be checked against
            a checkpoint the server signed hours earlier. A distributed verifier wants to confirm that a peer holds a
            specific record without trusting the peer or pulling its entire dataset. All three need the same thing: a
            small, fixed-size <em>commitment</em> to a large body of data, plus a way to prove that one piece really belongs
            to it.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            A Merkle tree gives you exactly that. You hash each piece of data into a leaf, hash leaves together in pairs to
            form a level above, and keep climbing until a single hash remains. That top hash — the root — is the commitment.
            Change any byte of any leaf and the root changes. The business requirement, then, is not really &ldquo;use a hash
            tree.&rdquo; It is one reproducible commitment policy that all three teams agree on: canonical leaf encoding,
            explicit domain separation, versioned odd-leaf handling, and portable proof envelopes. Get the policy wrong and
            two correct-looking implementations will compute different roots from identical data.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            Read the tree below from the bottom up. The four leaves are hashes of the raw data; each pair is hashed into the
            node above it; the two nodes meet at the root. To prove that <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">leaf2</code>{" "}
            belongs to this root, you do not ship the whole tree. You ship just the siblings a verifier needs to climb back
            up — here that is <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">H(leaf3)</code> and{" "}
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">H(n0 || n1)</code> — and the verifier
            recomputes the root for itself.
          </p>
          <MermaidDiagram
            chart={`flowchart BT\n  L0[H leaf0] --> N0[H n0 n1]\n  L1[H leaf1] --> N0\n  L2[H leaf2] --> N1[H n2 n3]\n  L3[H leaf3] --> N1\n  N0 --> R((root))\n  N1 --> R`}
            caption="Leaves hash upward in pairs until one root remains. Any change to any leaf changes the root."
          />
          <div className="mt-2 rounded-lg border border-border bg-muted/30 p-4">
            <div className="font-medium text-foreground mb-2">The same tree, with the hash structure spelled out</div>
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
            <h3 className="text-lg font-semibold text-foreground mb-3">Questions to ask in review</h3>
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
          <p className="text-sm text-muted-foreground leading-6">
            Three ideas carry most of the weight in this chapter. The first is what a Merkle tree actually buys you — a small
            commitment plus cheap inclusion proofs. The second is a Rust-specific representation choice that surprises people
            coming from object-oriented backgrounds. The third is the realization that most of the bugs live in policy, not in
            the hash call. Hold these three in mind and the rest of the chapter reads as elaboration.
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

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Hash trees and integrity proofs</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The whole value of a Merkle tree comes from one property: the root is a deterministic function of every leaf.
              Because each internal node hashes its children, and the root hashes the level below it, a single flipped bit
              anywhere at the bottom propagates all the way up. That is what makes the root a compact integrity witness — a
              32-byte value that stands in for an arbitrarily large dataset. The choices below are about how to <em>store</em>{" "}
              that structure in Rust and how to keep the commitment reproducible, which matters far more than the specific
              pair-hash function you pick.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              An inclusion proof answers a narrow question: &ldquo;does this leaf belong under this root?&rdquo; The prover,
              who holds the whole tree, walks from the leaf up to the root and collects the sibling hash at each level — and,
              crucially, whether that sibling sat on the left or the right. The verifier holds only the leaf, the proof, and
              the trusted root. It re-hashes its way up using the siblings and re-derives a root; if that root matches the one
              it trusts, the leaf is genuine. Notice what the verifier never needs: the rest of the data. The proof is{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">log&#8322;(n)</code> hashes, not the tree.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The trace below is the part people get wrong. At each step the verifier must combine its running hash with the
              sibling <em>in the correct order</em>. If the sibling was on the right, the order is{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">H(running || sibling)</code>; if it was on
              the left, it is <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">H(sibling || running)</code>.
              Drop the orientation bit and verification becomes ambiguous — sometimes passing, sometimes failing, on data that
              is actually correct.
            </p>
            <MermaidDiagram
              chart={`sequenceDiagram\n  participant P as Prover (has tree)\n  participant V as Verifier (has root)\n  P->>V: leaf + sibling path + orientation bits\n  Note over V: start hash = H(leaf)\n  V->>V: combine with sibling 0 (left/right)\n  V->>V: combine with sibling 1 (left/right)\n  V->>V: derived root == trusted root?\n  V-->>P: accept or reject`}
              caption="The verifier rebuilds the root from one leaf and a short sibling path. Orientation decides the hash order at each step."
            />
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside mt-4">
              {proofChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Persistent tree variants</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Rebuilding a million-leaf tree because one leaf changed is wasteful, and most real systems never do it. When a
              single leaf changes, only the hashes on the path from that leaf to the root are affected — roughly{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">log&#8322;(n)</code> nodes. A persistent
              tree exploits this: it shares the untouched subtrees with the previous version and allocates fresh nodes only
              along the changed path. This is the same copy-on-write idea behind persistent data structures generally, and it
              is where Rust&rsquo;s ownership model pays off — read-only snapshots can be shared with{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Arc</code> precisely because nothing can
              mutate them out from under a holder.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Building a Merkle tree is a textbook fan-in. Within a single level every parent depends only on its own pair of
              children and on nothing else at that level, so all the pair-hashes in one level can run at the same time. The
              dependency is purely vertical: level <em>k+1</em> cannot start until level <em>k</em> is finished, because its
              inputs are the outputs of the level below. That gives you a clean shape — parallelize <em>within</em> a level,
              synchronize <em>between</em> levels — and it holds whether the workers are CPU threads, Rayon tasks, GPU lanes,
              or remote nodes.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              In the snippet below, look at the boundary, not the scheduler. <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">par_chunks(2)</code>{" "}
              splits one level into independent pairs, the <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">map</code>{" "}
              hashes each pair in parallel, and <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">collect</code>{" "}
              gathers the next level in order before the outer loop advances. The odd-pair fallback (
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">if pair.len() == 2</code>) is the odd-leaf
              policy showing up again — here it duplicates the lone node, which must match what every other implementation does.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph Level0 [leaves - parallel pairs]\n    A0[l0] --- A1[l1]\n    A2[l2] --- A3[l3]\n  end\n  subgraph Level1 [parents - parallel pairs]\n    B0[p0] --- B1[p1]\n  end\n  A0 --> B0\n  A1 --> B0\n  A2 --> B1\n  A3 --> B1\n  B0 --> ROOT((root))\n  B1 --> ROOT`}
              caption="Pairs within a level hash in parallel; each level is a synchronization barrier before the next begins."
            />
            <div className="grid gap-4 lg:grid-cols-3 mt-4">
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A root by itself is just 32 bytes with no self-description, and that is the trap. The moment a proof leaves the
              process that built the tree, the receiver has to reproduce the producer&rsquo;s exact rules, and those rules are
              not visible in the hash. So the unit you actually ship is not the root and not the bare sibling list — it is an
              envelope that carries enough metadata to recompute the commitment from scratch. Two facts about leaf bytes deserve
              special care: they must be canonical (pin endianness and field order; never let a debug format leak into the wire
              contract), and they must be domain-separated from internal-node bytes so a leaf can never be mistaken for a node.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              In the struct below, the body of the proof is <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">siblings</code>,
              but the fields that make it portable are the metadata: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">hash_alg</code>{" "}
              and <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">tree_version</code> tell the verifier which
              policy produced the root, and <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">leaf_index</code>{" "}
              with <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">leaf_count</code> let it reconstruct the
              orientation at each level. Drop any of those and you have a proof that only the original process can interpret.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              These three patterns are the reason the chapter pairs &ldquo;games&rdquo; with &ldquo;challenges.&rdquo; Each one
              uses the same commitment-plus-proof core, but applies it to a different trust problem. Content-addressed storage
              turns the root into a deduplication key and a fetch validator. Tamper-evident game state turns periodic roots into
              checkpoints you can later use to settle a dispute about a single move. Distributed verification turns proofs into
              messages that travel between peers who do not trust each other. Read them as variations on one theme: commit once,
              prove cheaply, verify without the bulk data.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {challengeCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How this maps to what you already know</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            The Merkle algorithm is language-neutral; what changes is the instinct you bring to representing it. The cards
            below are about the mental-model shift, not about which crate replaces which library. The recurring theme: the
            commitment is an owned, immutable byte structure, the proof is a small self-contained value, and the policy that
            ties them together is an explicit contract rather than something hidden in a class or helper.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {comparisonCallouts.map((comparison) => (
              <div key={comparison.title} className="rounded-lg border border-border bg-muted/30 p-4">
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
                The most common Merkle bug is not a bad hash function call. It is two systems quietly disagreeing on leaf encoding,
                node domain separation, or odd-leaf policy while both sides still look locally “correct.”
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              Before reading the code, follow the three stages it moves through. First it <strong className="text-foreground">builds</strong>{" "}
              the tree by hashing leaves and folding each level into the next until one root remains. Then it{" "}
              <strong className="text-foreground">emits a proof</strong> for one chosen leaf by collecting the sibling at each level
              along the way to the root. Finally it <strong className="text-foreground">verifies</strong> by re-folding the leaf with
              those siblings and comparing the result to the root. Watch how the same fold logic is reused in build and verify, and
              how each proof step records both a hash and a side.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Leaves[leaf bytes] --> Build[hash + fold levels]\n  Build --> Root((root))\n  Build --> Proof[collect siblings for leaf i]\n  Proof --> Verify[re-fold leaf with siblings]\n  Root --> Verify\n  Verify --> OK{derived == root?}`}
              caption="Build once to get the root, emit a sibling path for one leaf, then verify by re-deriving the root from that leaf alone."
            />
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              This is the level-by-level shape from the parallel-construction diagram above, made runnable. The key lines build
              each level in parallel and then synchronize before moving up, and the program proves it got the same answer by
              computing the root a second time sequentially and asserting <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">roots match = true</code>.
              That equality check is the whole point: parallelism must never change the commitment. If a refactor ever breaks the
              match, the parallel path and the sequential path have drifted on ordering or odd-leaf handling.
            </p>
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
            canonical serialization, and design content-addressed, tamper-evident, and distributed verification systems.
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
