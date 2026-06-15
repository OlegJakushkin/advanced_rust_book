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
