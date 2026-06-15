#[derive(Debug, Clone, Copy)]
struct WindowStats {
    requests: u64,
    errors: u64,
    queue_p95_ms: u64,
    handler_p95_ms: u64,
    busy_workers: u32,
    total_workers: u32,
}

fn success_rate(stats: &WindowStats) -> f64 {
    1.0 - stats.errors as f64 / stats.requests as f64
}

fn latency_budget_ms(stats: &WindowStats) -> u64 {
    stats.queue_p95_ms + stats.handler_p95_ms
}

fn saturation(stats: &WindowStats) -> f64 {
    stats.busy_workers as f64 / stats.total_workers as f64
}

fn burn_alert(stats: &WindowStats) -> bool {
    latency_budget_ms(stats) > 350 || success_rate(stats) < 0.995 || saturation(stats) > 0.90
}

fn main() {
    let stats = WindowStats {
        requests: 5_000,
        errors: 40,
        queue_p95_ms: 180,
        handler_p95_ms: 210,
        busy_workers: 19,
        total_workers: 20,
    };

    println!("latency budget = {}", latency_budget_ms(&stats));
    println!("success rate = {:.4}", success_rate(&stats));
    println!("alert = {}", burn_alert(&stats));
}
