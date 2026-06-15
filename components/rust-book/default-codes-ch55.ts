export const DEFAULT_CODES_CH55: Record<string, string> = {
  smart_contract_solana_counter: `// A hand-built model of Solana's account + instruction model, no crates.
//
// On Solana a "program" is stateless code. The state it works on lives in
// separate "accounts" that the runtime passes in as mutable byte buffers.
// An instruction tells the program which operation to run and with what data.
//
// Here we model exactly that: an Account owns a data buffer and an owner
// field, process_instruction borrows the buffer mutably, decodes a u64
// counter by hand (the way Borsh would, little-endian), applies the op, and
// writes the counter back. main() drives a couple of instructions.

#[derive(Debug)]
struct Account {
    owner: &'static str,
    data: [u8; 8],
}

#[derive(Debug)]
enum Instruction {
    Increment,
    SetTo(u64),
}

#[derive(Debug)]
enum ProgramError {
    DataTooSmall,
}

// Decode the counter the way a by-hand Borsh reader would: a little-endian u64.
fn read_counter(data: &[u8]) -> Result<u64, ProgramError> {
    if data.len() < 8 {
        return Err(ProgramError::DataTooSmall);
    }
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&data[..8]);
    Ok(u64::from_le_bytes(bytes))
}

// Re-encode the counter back into the account buffer, little-endian.
fn write_counter(data: &mut [u8], value: u64) -> Result<(), ProgramError> {
    if data.len() < 8 {
        return Err(ProgramError::DataTooSmall);
    }
    data[..8].copy_from_slice(&value.to_le_bytes());
    Ok(())
}

// The "program entry point": stateless code over a mutable account buffer.
fn process_instruction(data: &mut [u8], instruction: &Instruction) -> Result<u64, ProgramError> {
    let current = read_counter(data)?;
    let next = match instruction {
        Instruction::Increment => current + 1, // intentionally unchecked — Exercise 5 asks you to harden this
        Instruction::SetTo(value) => *value,
    };
    write_counter(data, next)?;
    Ok(next)
}

fn main() {
    let mut account = Account {
        owner: "CounterProgram1111",
        data: [0u8; 8],
    };

    // The runtime hands the program a mutable view of account data each call.
    let after_set = process_instruction(&mut account.data, &Instruction::SetTo(41)).unwrap();
    let after_inc = process_instruction(&mut account.data, &Instruction::Increment).unwrap();

    let final_counter = read_counter(&account.data).unwrap();

    println!("after set = {}", after_set);
    println!("after increment = {}", after_inc);
    println!("counter = {}", final_counter);
    println!("owner = {}", account.owner);
}`,
  smart_contract_platform_compare: `// The Solana vs Sei(CosmWasm) vs EVM mental model, encoded as data.
//
// Every on-chain platform answers the same four questions differently:
//   1. Where does contract state live?
//   2. What does the code actually run as (the execution target)?
//   3. How is data serialized across the host boundary?
//   4. What shape is the entry point the runtime calls?
//
// We model each platform as an enum variant, attach those four facts, and
// print one line per platform so the contrasts sit side by side.

#[derive(Debug, Clone, Copy)]
enum Platform {
    Solana,
    SeiCosmWasm,
    EvmSolidity,
}

struct PlatformModel {
    name: &'static str,
    state_model: &'static str,
    execution_target: &'static str,
    serialization: &'static str,
    entry_shape: &'static str,
}

fn describe(platform: Platform) -> PlatformModel {
    match platform {
        Platform::Solana => PlatformModel {
            name: "Solana",
            state_model: "external accounts",
            execution_target: "SBF",
            serialization: "Borsh",
            entry_shape: "process_instruction",
        },
        Platform::SeiCosmWasm => PlatformModel {
            name: "Sei/CosmWasm",
            state_model: "contract-owned kv",
            execution_target: "wasm",
            serialization: "JSON/serde",
            entry_shape: "instantiate/execute/query",
        },
        Platform::EvmSolidity => PlatformModel {
            name: "EVM/Solidity",
            state_model: "contract storage",
            execution_target: "EVM bytecode",
            serialization: "ABI",
            entry_shape: "selector dispatch",
        },
    }
}

fn main() {
    let platforms = [Platform::Solana, Platform::SeiCosmWasm, Platform::EvmSolidity];

    for platform in platforms {
        let model = describe(platform);
        println!(
            "{} | state={} | target={} | serde={} | entry={}",
            model.name,
            model.state_model,
            model.execution_target,
            model.serialization,
            model.entry_shape
        );
    }
}`,
}
