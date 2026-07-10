#[derive(Debug, Clone)]
struct PublicClaim {
    model_id: String,
    quantization_bits: u8,
    token_count: usize,
    output_commitment: String,
}

#[derive(Debug, Clone)]
struct WitnessMaterial {
    prompt_tokens: Vec<u32>,
    attention_mask: Vec<u8>,
}

#[derive(Debug, Clone)]
struct ProofArtifact {
    circuit_id: String,
    proof_bytes_len: usize,
    verifier_key_id: String,
}

#[derive(Debug, Clone)]
struct VerificationRequest {
    claim: PublicClaim,
    proof: ProofArtifact,
}

fn build_verification_request(claim: PublicClaim, proof: ProofArtifact) -> VerificationRequest {
    VerificationRequest { claim, proof }
}

fn main() {
    let claim = PublicClaim {
        model_id: String::from("llm-int8:v3"),
        quantization_bits: 8,
        token_count: 128,
        output_commitment: String::from("out:9af1"),
    };

    let _witness = WitnessMaterial {
        prompt_tokens: vec![101_u32, 202, 303],
        attention_mask: vec![1_u8, 1, 1],
    };

    let proof = ProofArtifact {
        circuit_id: String::from("ezkl-circuit:v3"),
        proof_bytes_len: 2_048,
        verifier_key_id: String::from("vk:2026-04"),
    };

    let request = build_verification_request(claim, proof);

    println!("model = {}", request.claim.model_id);
    println!("public tokens = {}", request.claim.token_count);
    println!("proof bytes = {}", request.proof.proof_bytes_len);
    println!("witness kept private = {}", true);
}
