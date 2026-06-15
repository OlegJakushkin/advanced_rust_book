"use client"

// Chapter 56 · exercise workbook page (ch56-no-std-rust-constrained-runtime-derivatives-exercises).
// Exercise data consumed by the workbook PDF builder
// (exports/extract_chapter_prose.py reads the const blocks and the
// RustPracticeCard below). Not yet wired into app navigation; wiring
// requires lockstep edits to types.ts / index.ts / index.tsx.
// Intended component name: PageCh56NoStdRustConstrainedRuntimeDerivativesExercises

export {}

/*
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
    title: "Place each function at its lowest ring",
    objective: "Restate the three-ring capability model (core, alloc, std) and the decision of which ring a given function belongs to.",
    starterPrompt: "The chapter describes the standard library as three stacked layers and frames no_std as opting out of the upper ones. Using the crate-root listing, explain why checksum lives in core, encode_frame lives behind the alloc feature, and write_diagnostic lives behind the std feature.",
    prompts: [
      "State what capability each ring requires of the target: core, alloc, std.",
      "For each of the three functions, name the single concrete need that pins it to its ring.",
      "Explain why no_std and no-heap are described as two separate decisions, not one.",
      "Say what the target triple decides about which ring a build can reach.",
    ],
    acceptanceCriteria: [
      "core is described as always available, alloc as requiring a heap, and std as requiring an OS.",
      "checksum is pinned to core because it takes only a slice and returns an integer; encode_frame to alloc because it returns an owned Vec<u8>; write_diagnostic to std because it formats host-facing diagnostics (returns a String) and is meant for an environment with an OS.",
      "The answer states that a crate can be no_std yet still use alloc, so dropping std does not by itself remove the heap.",
      "The target triple is identified as what determines the highest ring a given build is allowed to use.",
    ],
    hints: [
      "Look at the return types: a borrowed slice needs nothing, an owned Vec needs a heap, a host String for diagnostics needs the OS.",
      "no_std removes the std layer; the heap belongs to the alloc layer below it.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Trace the fixed-capacity Pool",
    objective: "Read the fixed-capacity Pool and predict its observable outputs without running it.",
    starterPrompt: "Read Example 2, the Pool<const SLOTS, const BYTES> type with alloc_copy, as_slice, release, and in_use. Predict the three printed values for a Pool::<2, 8> after allocating b\"abc\" and b\"rust\", attempting b\"more\", and then releasing the first slot.",
    prompts: [
      "Walk alloc_copy and state when it returns None versus Some(SlotId).",
      "Determine why the third allocation of b\"more\" fails for a pool of two slots.",
      "Compute in_use after the first slot is released, and state what sent_bytes (the length from as_slice) is.",
      "Explain what release resets so the slot can be reused.",
    ],
    acceptanceCriteria: [
      "alloc_copy returns None when bytes.len() exceeds BYTES, and otherwise None only when every slot is already used.",
      "The third allocation fails because both of the two slots are occupied, not because of byte capacity.",
      "in_use is 1 after release, overflow is true, and sent_bytes is 3 (the length of b\"abc\"); the output is printed in the order in_use, overflow, sent_bytes, matching Example 2's println! order.",
      "release is identified as clearing the used flag and zeroing the recorded length for that slot.",
    ],
    hints: [
      "SLOTS bounds how many buffers exist; BYTES bounds the size of each one.",
      "as_slice reads lens[id], which release sets back to 0.",
      "Two different rejection paths: here b\"more\" (4 bytes) fails because no slot is free, while the lab's b\"overflowing\" (11 bytes) fails the byte-capacity check. Do not conflate them.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Keep checksum slice-based across every ring",
    objective: "Write the baseline portable API as a function over a borrowed slice so it compiles at the core ring.",
    starterPrompt: "Implement fn checksum(bytes: &[u8]) -> u32 so it works identically whether the caller holds a fixed array on a sensor board, a wasm guest buffer, or a Vec<u8> on a server. The function must not require alloc or std.",
    prompts: [
      "Keep the signature exactly fn checksum(bytes: &[u8]) -> u32.",
      "Sum each byte widened to u32 and avoid allocating any intermediate collection.",
      "Confirm in prose that nothing in the body would force the alloc or std ring.",
      "Show one call from an array literal and one from a Vec<u8> to demonstrate the same function serves both.",
    ],
    acceptanceCriteria: [
      "The signature stays fn checksum(bytes: &[u8]) -> u32 and takes a borrowed slice, not an owned Vec.",
      "The body widens each byte to u32 and sums without constructing a new Vec or String.",
      "The function compiles with no reference to alloc or std types, so it belongs at the core ring.",
      "checksum(b\"abc\") returns 294 and the same function accepts &vec[..] from a Vec<u8>.",
    ],
    hints: [
      "Arrays, vectors, and subslices all coerce to &[u8], which is the whole reason to take a slice.",
      "A reduction over a slice is one iterator chain: map each byte to u32, then sum.",
    ],
  },
  {
    number: 4,
    kind: "implementation",
    title: "Transfer slot ownership to a DMA handoff",
    objective: "Use move semantics to encode that a peripheral, not the caller, owns a buffer while a transfer is in flight.",
    starterPrompt: "Following the chapter's submit_to_dma idea, write fn submit_to_dma(slot: SlotId) -> InFlight that takes the SlotId by value and returns a handle, plus fn complete(token: InFlight) -> SlotId that returns ownership once the transfer finishes. The caller must be unable to read the buffer between submit and complete. Note that the chapter shows only the consuming call (submit_to_dma taking a TxSlot with no return); you must derive InFlight and complete yourself from the prose description of the ownership round-trip.",
    prompts: [
      "Define SlotId and a separate InFlight type that wraps the moved SlotId.",
      "Make submit_to_dma consume the SlotId by value so the caller no longer holds it.",
      "Make complete consume the InFlight token and hand the SlotId back.",
      "Explain in prose why a use of the slot between submit and complete is a compile error, not a runtime race.",
    ],
    acceptanceCriteria: [
      "submit_to_dma takes slot: SlotId by value and returns an InFlight handle that owns it.",
      "complete takes the InFlight token by value and returns the original SlotId.",
      "After calling submit_to_dma, any attempt to use the moved SlotId fails to compile.",
      "The write-up names move semantics, not a runtime check or atomic, as what enforces exclusive access during the transfer.",
    ],
    hints: [
      "Taking a parameter by value moves it; the previous binding is no longer usable.",
      "The peripheral conceptually owns the memory until complete returns the SlotId.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Replace an infallible push with try_reserve",
    objective: "Convert an allocation that assumes success into a fallible path that returns the out-of-memory case to the caller.",
    starterPrompt: "A frame encoder behind the alloc feature calls out.extend_from_slice(payload) directly, so an allocation failure aborts the whole firmware image. Refactor it so it reserves capacity fallibly first and returns an error to the caller instead of aborting.",
    prompts: [
      "Change the return type so the failure is visible, for example Result<Vec<u8>, TryReserveError>.",
      "Call try_reserve for the needed capacity before pushing or extending any bytes.",
      "Only grow the buffer once the capacity is secured, so a failure leaves the buffer untouched.",
      "State why aborting on allocation failure is unacceptable on a constrained target but tolerated on a hosted one.",
    ],
    acceptanceCriteria: [
      "The function returns a Result whose error path corresponds to a failed reservation rather than aborting.",
      "try_reserve (or try_reserve_exact) is called and its error is propagated before any push or extend_from_slice.",
      "No bytes are written into the buffer on the failure path.",
      "The explanation notes that on constrained targets allocation can genuinely fail, so out-of-memory must be a handled value, not a process abort.",
    ],
    hints: [
      "try_reserve returns Result<(), TryReserveError>; the ? operator turns its error into your function's error.",
      "Secure capacity first, then extend, so the function is left in a clean state when reservation fails.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Ship one framing library across four homes",
    objective: "Design the feature-gated surface and runtime contract of a single crate that must run on firmware, a hypervisor, a wasm guest, and a server.",
    starterPrompt: "Your team owns a packet-framing and checksum library that must ship to four targets from the opening scenario: bare-metal firmware, kernel-adjacent hypervisor startup code, a sandboxed wasm guest behind a narrow ABI, and a normal server. Decide which functions live in core, which sit behind alloc, and which sit behind std, and state the runtime contract each target imposes.",
    prompts: [
      "Assign the checksum, frame-encode, and host-diagnostic surfaces to the core, alloc, and std rings respectively, and justify each placement.",
      "Name what each target must supply that std would otherwise provide: panic handler, allocator, startup glue, linker script.",
      "Decide the memory strategy for the firmware path: fixed-capacity slots, fallible allocation, or both, and why.",
      "Describe how host-side std tests validate the portable core logic separately from slower target-specific harnesses.",
    ],
    acceptanceCriteria: [
      "The smallest truthful API is slice-based and in core; owned helpers are alloc-gated; host diagnostics are std-gated, matching the shape the chapter recommends.",
      "The freestanding targets are shown to require an explicit panic handler, allocator choice, startup, and linker script as part of the release contract.",
      "The firmware path prefers fixed-capacity or fallible-memory handling rather than assuming infallible allocation.",
      "Portable core logic is tested on the host with std while target-specific behavior is validated separately, keeping the fast tests fast.",
    ],
    hints: [
      "Design the smallest truthful API first and add owned conveniences only where the product boundary genuinely benefits.",
      "The common failure is an unspoken assumption: that an allocator, logs, or unwind exist on every target.",
    ],
  },
]

const reviewQuestions = [
  "What capability does each of the three rings require of a target, and which ring is always available regardless of target triple?",
  "Why are no_std and no-heap two independent decisions rather than one, and how does the alloc feature relate to that distinction?",
  "On a freestanding target, why does the compiler require you to supply a #[panic_handler], and what does std normally provide in its place?",
  "How does taking a slot by value in a submit_to_dma-style API turn a potential data race with a DMA engine into a compile-time error?",
  "What does try_reserve change about a buffer-growing function compared with calling push or extend_from_slice directly, and why does that matter on a constrained target?",
]

const workingLoop = [
  "Restate the exercise goal in terms of ownership, types, and the chapter's core idea.",
  "Write the smallest version that compiles, then make it correct.",
  "Check each acceptance criterion explicitly before moving on.",
  "Name one tradeoff or failure mode your solution accepts.",
]

<RustPracticeCard
  title={"Runnable lab · fixed-capacity frame pool"}
  filename="fixed_capacity_pool_lab.rs"
  runKey="ch56_ex_pool"
  expectedOutput={"checksum = 294\noverflow = true\nin_use = 1"}
  helperText={"Model the chapter's fixed-capacity Pool in plain std: a frame pool with a bounded slot count where allocation can fail. Fill in alloc_copy so it rejects oversized inputs and reuses the first free slot."}
  initialCode={`struct FramePool {
    used: Vec<bool>,
    frames: Vec<Vec<u8>>,
    capacity: usize,
}

impl FramePool {
    fn new(slots: usize, capacity: usize) -> Self {
        FramePool {
            used: vec![false; slots],
            frames: vec![Vec::new(); slots],
            capacity,
        }
    }

    // TODO: Reject inputs longer than \`self.capacity\` by returning None.
    // Otherwise find the first free slot, mark it used, copy the bytes into
    // it, and return Some(index). Return None if every slot is already used.
    fn alloc_copy(&mut self, bytes: &[u8]) -> Option<usize> {
        let _ = bytes;
        None
    }

    fn release(&mut self, id: usize) {
        self.used[id] = false;
        self.frames[id].clear();
    }

    fn in_use(&self) -> usize {
        self.used.iter().filter(|&&u| u).count()
    }
}

fn checksum(bytes: &[u8]) -> u32 {
    bytes.iter().map(|&b| b as u32).sum()
}

fn main() {
    let mut pool = FramePool::new(2, 8);

    let first = pool.alloc_copy(b"abc").unwrap_or(0);
    let _second = pool.alloc_copy(b"rust");
    let overflow = pool.alloc_copy(b"overflowing").is_none();
    let first_sum = checksum(pool.frames[first].as_slice());

    pool.release(first);

    println!("checksum = {}", first_sum);
    println!("overflow = {}", overflow);
    println!("in_use = {}", pool.in_use());
}`}
/>
*/
