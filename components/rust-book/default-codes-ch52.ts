export const DEFAULT_CODES_CH52: Record<string, string> = {
  zokrates_workflow_command_plan: `use std::path::PathBuf;

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
            // setup reads the compiled program from its default path; no -i here.
            args: vec!["setup".into()],
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
            // export-verifier consumes the verification key, not the compiled
            // program, and writes the Solidity contract to its default path.
            args: vec!["export-verifier".into()],
            artifact: PathBuf::from("artifacts/AgeCheckVerifier.sol"),
        },
        Invocation {
            stage: "verify",
            program: "zokrates",
            // verify takes the proof and verification key, not a compiled
            // program input, so it carries no -i flag.
            args: vec!["verify".into()],
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
}`,
  zokrates_ethereum_verifier_boundary: `#[derive(Debug, Clone)]
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
}`,
}
