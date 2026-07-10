#[derive(Debug)]
struct PipelineStats {
    cpu_us: u64,
    io_wait_us: u64,
    lock_wait_us: u64,
    serialize_us: u64,
    serialized_bytes: usize,
}

fn dominant(stats: &PipelineStats) -> &'static str {
    [
        ("cpu", stats.cpu_us),
        ("io", stats.io_wait_us),
        ("lock", stats.lock_wait_us),
        ("serialize", stats.serialize_us),
    ]
    .into_iter()
    .max_by_key(|(_, value)| *value)
    .map(|(name, _)| name)
    .unwrap()
}

fn wall_time(stats: &PipelineStats) -> u64 {
    stats.cpu_us + stats.io_wait_us + stats.lock_wait_us + stats.serialize_us
}

fn main() {
    let stats = PipelineStats {
        cpu_us: 410,
        io_wait_us: 120,
        lock_wait_us: 90,
        serialize_us: 180,
        serialized_bytes: 16_384,
    };

    println!("dominant = {}", dominant(&stats));
    println!("serialized bytes = {}", stats.serialized_bytes);
    println!("wall us = {}", wall_time(&stats));
}
