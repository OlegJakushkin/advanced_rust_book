export const DEFAULT_CODES_CH53: Record<string, string> = {
  zkml_verification_boundary_types: `#[derive(Debug, Clone)]
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
    // The witness was never passed to build_verification_request, so it cannot
    // reach this point. The type boundary, not this literal, is the enforcement.
    println!("witness kept private = {}", true);
}`,
  zkml_proving_queue_profile: `#[derive(Debug, Clone)]
struct ZkmlJob {
    artifact_id: String,
    gpu_requested: bool,
    batch_size: usize,
}

#[derive(Debug, Clone, Copy)]
struct StageTimes {
    witness_ms: u64,
    prove_ms: u64,
    verify_ms: u64,
    transfer_ms: u64,
}

fn queue_name(job: &ZkmlJob) -> &'static str {
    if job.gpu_requested {
        "zkml.gpu"
    } else {
        "zkml.cpu"
    }
}

fn dominant_stage(times: &StageTimes) -> &'static str {
    [
        ("witness", times.witness_ms),
        ("prove", times.prove_ms),
        ("verify", times.verify_ms),
        ("transfer", times.transfer_ms),
    ]
    .into_iter()
    .max_by_key(|(_, ms)| *ms)
    .map(|(name, _)| name)
    .unwrap()
}

fn end_to_end_ms(times: &StageTimes) -> u64 {
    times.witness_ms + times.prove_ms + times.verify_ms + times.transfer_ms
}

fn main() {
    let job = ZkmlJob {
        artifact_id: String::from("model-sha256:abc123"),
        gpu_requested: true,
        batch_size: 4,
    };

    let times = StageTimes {
        witness_ms: 320,
        prove_ms: 1_280,
        verify_ms: 40,
        transfer_ms: 240,
    };

    println!("route = {}", queue_name(&job));
    println!("dominant = {}", dominant_stage(&times));
    println!("e2e ms = {}", end_to_end_ms(&times));
    println!("artifact = {}", job.artifact_id);
}`,
}
