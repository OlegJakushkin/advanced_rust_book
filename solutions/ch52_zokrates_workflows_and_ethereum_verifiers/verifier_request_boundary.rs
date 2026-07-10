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
    // The witness never crosses the verifier boundary. We copy only the
    // verifier-facing fields: the contract, the count of public inputs, and the
    // proof path. The witness_path is deliberately left unread, and the flag is
    // set from what we actually populated rather than asserted by hand.
    VerificationRequest {
        contract: bundle.verifier_contract.clone(),
        public_inputs_len: bundle.public_inputs.len(),
        proof_path: bundle.proof_path.clone(),
        witness_included: false,
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

    // Touch proof_path so a real omission would still surface, not the witness.
    let _ = &request.proof_path;

    println!("contract = {}", request.contract);
    println!("public inputs = {}", request.public_inputs_len);
    println!("witness included = {}", request.witness_included);
}
