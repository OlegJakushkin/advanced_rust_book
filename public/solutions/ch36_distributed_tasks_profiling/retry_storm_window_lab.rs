#[derive(Debug, Clone, Copy)]
struct WindowStats {
    claimed: u32,
    retried: u32,
    busy_workers: u32,
    total_workers: u32,
}

// Worker saturation: how much of the pool is doing work right now.
// busy / total. A high value next to a rising queue age means overload.
fn saturation(stats: &WindowStats) -> f64 {
    if stats.total_workers == 0 {
        return 0.0;
    }
    stats.busy_workers as f64 / stats.total_workers as f64
}

// Retry rate: fraction of claimed work that was a redelivery, not new work.
// retried / claimed. This is load amplification, not just error bookkeeping.
fn retry_rate(stats: &WindowStats) -> f64 {
    if stats.claimed == 0 {
        return 0.0;
    }
    stats.retried as f64 / stats.claimed as f64
}

// Storm rule, stated explicitly so a reviewer can see and change the policy.
const SATURATION_STORM_THRESHOLD: f64 = 0.85;
const RETRY_STORM_THRESHOLD: f64 = 0.30;

fn retry_storm(stats: &WindowStats) -> bool {
    saturation(stats) >= SATURATION_STORM_THRESHOLD
        && retry_rate(stats) >= RETRY_STORM_THRESHOLD
}

fn main() {
    let stats = WindowStats {
        claimed: 100,
        retried: 40,
        busy_workers: 9,
        total_workers: 10,
    };

    println!("saturation = {:.2}", saturation(&stats));
    println!("retry rate = {:.2}", retry_rate(&stats));
    println!("storm = {}", retry_storm(&stats));
}
