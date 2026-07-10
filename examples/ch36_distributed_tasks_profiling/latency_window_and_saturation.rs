#[derive(Debug, Clone, Copy)]
struct WindowStats {
    claimed: u32,
    completed: u32,
    retried: u32,
    queue_p95_ms: u64,
    run_p95_ms: u64,
    busy_workers: u32,
    total_workers: u32,
}

fn end_to_end_p95_ms(stats: &WindowStats) -> u64 {
    stats.queue_p95_ms + stats.run_p95_ms
}

fn worker_saturation(stats: &WindowStats) -> f64 {
    stats.busy_workers as f64 / stats.total_workers as f64
}

fn retry_rate(stats: &WindowStats) -> f64 {
    stats.retried as f64 / stats.claimed as f64
}

fn main() {
    let stats = WindowStats {
        claimed: 120,
        completed: 110,
        retried: 18,
        queue_p95_ms: 140,
        run_p95_ms: 320,
        busy_workers: 17,
        total_workers: 20,
    };

    println!("e2e p95 = {}", end_to_end_p95_ms(&stats));
    println!("queue p95 = {}", stats.queue_p95_ms);
    println!("worker saturation = {:.2}", worker_saturation(&stats));
    println!("retry rate = {:.2}", retry_rate(&stats));
}
