// In a real crate, a Cargo feature would usually select this at compile time.
const METRICS_ENABLED: bool = false;

fn metrics_backend() -> &'static str {
    if METRICS_ENABLED {
        "prometheus"
    } else {
        "disabled"
    }
}

fn main() {
    println!("metrics backend = {}", metrics_backend());
}
