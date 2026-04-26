#[cfg(feature = "metrics")]
fn metrics_backend() -> &'static str {
    "prometheus"
}

#[cfg(not(feature = "metrics"))]
fn metrics_backend() -> &'static str {
    "disabled"
}

fn main() {
    println!("metrics backend = {}", metrics_backend());
}
