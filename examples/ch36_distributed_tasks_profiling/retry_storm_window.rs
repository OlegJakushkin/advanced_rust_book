#[derive(Debug, Clone, Copy)]
struct WindowStats {
    claimed: u32,
    retried: u32,
    busy_workers: u32,
    total_workers: u32,
}

fn saturation(stats: &WindowStats) -> f64 {
    stats.busy_workers as f64 / stats.total_workers as f64
}

fn retry_rate(stats: &WindowStats) -> f64 {
    stats.retried as f64 / stats.claimed as f64
}

fn retry_storm(stats: &WindowStats) -> bool {
    saturation(stats) >= 0.85 && retry_rate(stats) >= 0.30
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
