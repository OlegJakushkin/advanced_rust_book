#[derive(Debug, Clone)]
struct ProvingJob {
    model_id: String,
    gpu_requested: bool,
    public_outputs: Vec<String>,
    witness_path: String,
    proof_path: String,
}

#[derive(Debug, Clone)]
struct VerificationJob {
    proof_path: String,
    public_output_count: usize,
    witness_included: bool,
}

fn build_verification_job(job: &ProvingJob) -> VerificationJob {
    // The verifier lane references the proof artifact, counts the public
    // claims, and carries no witness material. model_id and witness_path are
    // proving-side custody and never cross into the verification request.
    VerificationJob {
        proof_path: job.proof_path.clone(),
        public_output_count: job.public_outputs.len(),
        witness_included: false,
    }
}

fn main() {
    let job = ProvingJob {
        model_id: String::from("llm-int8:v3"),
        gpu_requested: true,
        public_outputs: vec![String::from("token_hash"), String::from("score_hash")],
        witness_path: String::from("artifacts/witness.json"),
        proof_path: String::from("artifacts/proof.pf"),
    };

    let verify = build_verification_job(&job);
    let prove_queue = if job.gpu_requested { "zkml.gpu" } else { "zkml.cpu" };

    println!("prove queue = {}", prove_queue);
    println!("verify payload = {}", verify.public_output_count);
    println!("witness leaked = {}", verify.witness_included);
}
