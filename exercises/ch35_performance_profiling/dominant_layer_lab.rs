#[derive(Debug)]
struct PipelineStats {
    cpu_us: u64,
    io_wait_us: u64,
    lock_wait_us: u64,
    serialize_us: u64,
}

fn layers(stats: &PipelineStats) -> [(&'static str, u64); 4] {
    [
        ("cpu", stats.cpu_us),
        ("io", stats.io_wait_us),
        ("lock", stats.lock_wait_us),
        ("serialize", stats.serialize_us),
    ]
}

fn wall_time(stats: &PipelineStats) -> u64 {
    layers(stats).iter().map(|(_, value)| value).sum()
}

fn dominant(stats: &PipelineStats) -> (&'static str, u64) {
    // TODO: return the (name, micros) of the layer that owns the most time.
    // Scan layers(stats) and pick the entry with the largest micros value.
    ("none", 0)
}

fn main() {
    let stats = PipelineStats {
        cpu_us: 410,
        io_wait_us: 120,
        lock_wait_us: 90,
        serialize_us: 180,
    };

    let wall = wall_time(&stats);
    let (name, micros) = dominant(&stats);
    let share = micros * 100 / wall;

    println!("dominant = {}", name);
    println!("wall us = {}", wall);
    println!("dominant share = {}", share);
}
