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
    VerificationJob {
        proof_path: job.witness_path.clone(),
        public_output_count: 0,
        witness_included: true,
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
