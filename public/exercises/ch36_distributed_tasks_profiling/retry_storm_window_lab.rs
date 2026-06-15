#[derive(Debug, Clone, Copy)]
struct WindowStats {
    claimed: u32,
    retried: u32,
    busy_workers: u32,
    total_workers: u32,
}

fn saturation(_stats: &WindowStats) -> f64 {
    0.0
}

fn retry_rate(_stats: &WindowStats) -> f64 {
    0.0
}

fn retry_storm(_stats: &WindowStats) -> bool {
    false
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
