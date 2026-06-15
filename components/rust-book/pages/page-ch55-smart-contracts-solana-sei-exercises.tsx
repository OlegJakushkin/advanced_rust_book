"use client"

// Chapter 55 · exercise workbook page (ch55-smart-contracts-solana-sei-exercises).
// Exercise data consumed by the workbook PDF builder
// (exports/extract_chapter_prose.py reads the const blocks and the
// RustPracticeCard below). Not yet wired into app navigation; wiring
// requires lockstep edits to types.ts / index.ts / index.tsx.
// Intended component name: PageCh55SmartContractsSolanaSeiExercises

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
    title: "Name the four questions every chain answers",
    objective: "Recall the chapter's four-question framework and the shared shell-around-a-pure-core model so the platform differences become a checklist rather than trivia.",
    starterPrompt: "The chapter argues that Solana, Sei (CosmWasm), and the EVM are three answers to the same four questions, and that the Rust you write to satisfy each is more alike than the platforms suggest. Restate that framing in your own words without copying the comparison table.",
    prompts: [
      "List the four questions the chapter asks of any chain (state location, execution target, serialization, entry shape).",
      "Describe the 'thin shell around a pure core' shape: what enters as untrusted bytes, what the handler operates on, and what is persisted.",
      "Explain which part of a contract is chain-specific and which part is ordinary Rust.",
      "Give one sentence on why the chapter calls the boundary format the contract's 'real public API'.",
    ],
    acceptanceCriteria: [
      "The four questions are stated as: where state lives, what the code runs as, how data is serialized across the host boundary, and what shape the entry point has.",
      "The answer identifies the handler as pure, deterministic Rust over owned domain types, with all chain-specific concerns confined to the shell.",
      "The answer states that untrusted bytes are decoded into owned types, processed, then re-encoded into bytes the runtime persists.",
      "The answer connects the boundary format to Chapter 19's lesson that a wire format is a versioned public contract.",
    ],
    hints: [
      "The four facts are state model, execution target, serialization, and entry shape.",
      "Everything chain-specific lives in the shell; the handler is the part you could lift unchanged to another platform.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Trace the counter through the Solana account model",
    objective: "Read the chapter's Solana counter listing closely enough to explain why the program holds no state and how the account buffer carries it instead.",
    starterPrompt: "Study the smart_contract_solana_counter listing: an Account owns a [u8; 8] data buffer, and process_instruction borrows that buffer mutably, decodes a little-endian u64, applies an Instruction, and writes it back. Walk one full call through the code.",
    prompts: [
      "Identify exactly where the counter value is stored across calls, and confirm process_instruction owns no persistent state of its own.",
      "Explain what read_counter and write_counter stand in for, and why from_le_bytes / to_le_bytes appear instead of a real codec.",
      "Trace the values for SetTo(41) followed by Increment and state what the final counter is.",
      "Explain why process_instruction takes data: &mut [u8] rather than taking the Account by value.",
    ],
    acceptanceCriteria: [
      "The answer states that state lives in account.data and that the program is stateless code the runtime calls with a mutable view of that buffer.",
      "The answer identifies from_le_bytes / to_le_bytes as a hand-rolled, Borsh-style little-endian codec standing in for a real serializer.",
      "The trace yields after_set = 41, after_increment = 42, and final counter = 42.",
      "The answer explains that borrowing the buffer mutably lets the program mutate persisted state without owning it, matching Solana's external-account model.",
    ],
    hints: [
      "Follow the bytes: the account buffer is the only thing that survives between two calls to process_instruction.",
      "A mutable borrow of the buffer is how the runtime lends the program write access to account data it does not own.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Add a Decrement instruction with a floor at zero",
    objective: "Extend the chapter's instruction set while keeping the stateless decode-apply-encode entry point and avoiding an unsigned underflow.",
    starterPrompt: "Starting from the smart_contract_solana_counter model, add an Instruction::Decrement variant. Decrementing a counter already at 0 must not panic or wrap to u64::MAX; it must saturate at 0.",
    prompts: [
      "Add the Decrement variant to the Instruction enum.",
      "Handle it in process_instruction so the decode, apply, and write-back structure is unchanged.",
      "Use a saturating or checked operation so subtracting below zero floors at 0 rather than wrapping.",
      "Demonstrate it: SetTo(1), then two Decrement calls, and confirm the counter reads 0.",
    ],
    acceptanceCriteria: [
      "The Instruction enum gains a Decrement variant and process_instruction matches it without changing the read_counter / write_counter calls.",
      "Decrementing at 0 produces 0 rather than panicking or wrapping to a huge value.",
      "After SetTo(1) and two Decrement calls the final counter read from the buffer is 0.",
      "The entry point still returns Result<u64, ProgramError> and the buffer is the only persisted state.",
    ],
    hints: [
      "u64::saturating_sub floors subtraction at 0 without a panic.",
      "The new arm slots into the same match in process_instruction; nothing about read/write needs to change.",
    ],
  },
  {
    number: 4,
    kind: "implementation",
    title: "Turn the platform comparison table into runnable code",
    objective: "Turn the four-question comparison table into runnable data and add a lookup that answers a single question across all three platforms.",
    starterPrompt: "Using the smart_contract_platform_compare model, where each Platform maps to a PlatformModel with four fields, write fn serialization_of(platform: Platform) -> &'static str and a loop that prints the serialization format for every platform.",
    prompts: [
      "Reuse describe to obtain the PlatformModel rather than duplicating the field data.",
      "Implement serialization_of so it returns the serialization field for the given platform.",
      "Iterate the three Platform variants and print one line per platform naming its serialization format.",
      "Confirm the output reports Borsh for Solana, JSON/serde for Sei/CosmWasm, and ABI for EVM/Solidity.",
    ],
    acceptanceCriteria: [
      "serialization_of delegates to describe and returns the model's serialization field, with no second copy of the platform facts.",
      "The loop covers all three variants: Solana, SeiCosmWasm, and EvmSolidity.",
      "Output pairs each platform with the correct format: Borsh, JSON/serde, and ABI respectively.",
      "Platform stays a Copy enum so it can be passed by value into the helper without cloning.",
    ],
    hints: [
      "describe already centralizes the four facts; the helper just reads one field off its result.",
      "Because Platform derives Copy, you can pass it into serialization_of and still use it afterward.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Harden the decode boundary against a hostile increment",
    objective: "Find and fix the place where an undecoded or unbounded value reaches state, applying the chapter's borrow-parse-validate-then-mutate discipline.",
    starterPrompt: "The counter program uses current + 1 for Increment. A counter sitting at u64::MAX is valid input from a hostile caller, and in release builds that addition wraps to 0 instead of failing. Make the increment path reject overflow instead of silently wrapping.",
    prompts: [
      "Explain why current + 1 is a boundary bug, not just a theoretical edge case, given that input bytes come from an untrusted counterparty.",
      "Add a ProgramError::Overflow variant and switch the Increment (and any SetTo) path to checked_add.",
      "Return Err(ProgramError::Overflow) before write_counter runs, so no invalid value reaches the buffer.",
      "Show that incrementing a buffer initialized to u64::MAX returns an error and leaves the buffer unchanged.",
    ],
    acceptanceCriteria: [
      "The answer names the bug as an unvalidated value reaching state: a release-mode wrapping add on attacker-controlled bytes.",
      "process_instruction uses checked_add and returns ProgramError::Overflow on overflow rather than wrapping or panicking.",
      "The error is returned before write_counter, so the account buffer is never mutated on the failing path.",
      "Incrementing a u64::MAX buffer yields an Err and a subsequent read still shows u64::MAX.",
    ],
    hints: [
      "checked_add returns Option<u64>; map None to ProgramError::Overflow with ok_or.",
      "Validate fully before you mutate: the write should never run on the error path.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Plan the Solana-to-Sei port",
    objective: "Reason about which parts of a working contract change and which stay constant when moving from Solana to a Sei (CosmWasm) deployment.",
    starterPrompt: "A team ships the Solana counter program and is asked to deploy comparable logic to a Sei (CosmWasm) chain. Using the four-question framework, write a short porting plan that separates the shell that must change from the pure core that can stay.",
    prompts: [
      "Map each of the four questions to its Solana answer and its Sei/CosmWasm answer (state model, execution target, serialization, entry shape).",
      "Identify the concrete code that must change: the entry shape (process_instruction versus instantiate/execute/query), the state model (external account versus contract-owned kv store), and the serialization (Borsh versus JSON/serde).",
      "Identify what stays: the deterministic handler that computes the next counter from the current one over owned domain types.",
      "State the boundary discipline that must hold on both platforms regardless of format.",
    ],
    acceptanceCriteria: [
      "The plan correctly contrasts external accounts plus Borsh plus process_instruction (Solana) against contract-owned kv plus JSON/serde plus instantiate/execute/query (Sei).",
      "The plan confines the changes to the shell: deserialization, storage access, and entry-point dispatch.",
      "The plan keeps the pure handler logic unchanged and explains why it can move across platforms.",
      "The plan reaffirms decode-validate-then-mutate and a versioned boundary format as constant requirements on both chains.",
    ],
    hints: [
      "Only the shell is chain-specific; the next-counter computation is ordinary deterministic Rust.",
      "Sei swaps a single entry point for instantiate/execute/query and a contract-owned key-value store, but the no-undecoded-value-reaches-state rule is identical.",
    ],
  },
]

const reviewQuestions = [
  "What are the four questions the chapter says every chain answers differently, and what are Solana's answers to each?",
  "In the Solana model, where does contract state live, and why is the program itself described as stateless?",
  "What do from_le_bytes and to_le_bytes stand in for in the counter listing, and why does the chapter hand-roll them instead of using a crate?",
  "What does 'never let an undecoded or unvalidated value reach state' mean in practice, and in what order should you borrow, parse, validate, and mutate?",
  "Which three facts about a contract's runtime (no ambient I/O, metered execution, re-execution by every validator) constrain the ordinary Rust you can write, and why?",
]

const workingLoop = [
  "Restate the exercise goal in terms of ownership, types, and the chapter's core idea.",
  "Write the smallest version that compiles, then make it correct.",
  "Check each acceptance criterion explicitly before moving on.",
  "Name one tradeoff or failure mode your solution accepts.",
]

<RustPracticeCard
  title={"Runnable lab · harden the Solana counter's decode-validate boundary"}
  filename="solana_counter_boundary_lab.rs"
  runKey="ch55_ex_counter"
  expectedOutput={"after add = 40\nafter increment = 41\ncounter = 41\noverflow rejected = true"}
  helperText={"Model a stateless Solana-style program over an external account buffer. Fill in process_instruction to apply the instruction and reject overflow before writing back to state."}
  initialCode={`// A crate-free model of a Solana-style program over an external account buffer.
// State lives in the account's byte buffer; the program is stateless code that
// borrows the buffer, decodes a little-endian u64 by hand (as Borsh would),
// applies an instruction, validates, and writes the bytes back.

#[derive(Debug)]
enum Instruction {
    Increment,
    Add(u64),
}

#[derive(Debug)]
enum ProgramError {
    DataTooSmall,
    Overflow,
}

fn read_counter(data: &[u8]) -> Result<u64, ProgramError> {
    if data.len() < 8 {
        return Err(ProgramError::DataTooSmall);
    }
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&data[..8]);
    Ok(u64::from_le_bytes(bytes))
}

fn write_counter(data: &mut [u8], value: u64) -> Result<(), ProgramError> {
    if data.len() < 8 {
        return Err(ProgramError::DataTooSmall);
    }
    data[..8].copy_from_slice(&value.to_le_bytes());
    Ok(())
}

// Stateless entry point: decode, apply, validate against overflow, re-encode.
fn process_instruction(data: &mut [u8], instruction: &Instruction) -> Result<u64, ProgramError> {
    let current = read_counter(data)?;
    // TODO: compute \`next\` from \`current\` and \`instruction\` using checked_add,
    // returning ProgramError::Overflow instead of wrapping. For now this stub
    // ignores the instruction so the program still compiles.
    // NOTE (maintainers): the card's expectedOutput describes the COMPLETED
    // solution, not this stub. Running the stub as-is prints zeros and
    // "overflow rejected = false"; the expected values appear once the TODO
    // is filled in. This is intentional scaffolding, not a mismatch.
    let next = current;
    write_counter(data, next)?;
    Ok(next)
}

fn main() {
    let mut data = [0u8; 8];

    let a = process_instruction(&mut data, &Instruction::Add(40)).unwrap();
    let b = process_instruction(&mut data, &Instruction::Increment).unwrap();

    // A hostile instruction that would overflow must be rejected, not wrap.
    let mut maxed = u64::MAX.to_le_bytes();
    let bad = process_instruction(&mut maxed, &Instruction::Increment);

    println!("after add = {}", a);
    println!("after increment = {}", b);
    println!("counter = {}", read_counter(&data).unwrap());
    println!("overflow rejected = {}", bad.is_err());
}`}
/>
*/
