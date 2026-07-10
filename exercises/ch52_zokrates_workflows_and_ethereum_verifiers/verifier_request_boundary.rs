#[derive(Debug, Clone)]
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
}
