#[derive(Debug, Clone)]
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
}
