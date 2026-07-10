// The Solana vs Sei(CosmWasm) vs EVM mental model, encoded as data.
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
}
