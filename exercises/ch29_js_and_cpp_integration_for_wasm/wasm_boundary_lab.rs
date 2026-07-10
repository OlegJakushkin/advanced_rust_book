// Models the WebAssembly boundary contracts in plain std Rust.
// Two separate heaps with one shared byte array is simulated here by
// passing borrowed slices in and returning owned values out.

fn build_label(service: &str, route: &str) -> String {
    // &str copied in, owned String copied back out.
    format!("{}::{}", service, route)
}

fn sum_bytes(bytes: &[u8]) -> u32 {
    // borrowed slice copied in, u32 rides back with no copy.
    bytes.iter().map(|&value| value as u32).sum()
}

fn route_score(route: &str) -> u32 {
    // Pointer-plus-length C-ABI crossing, modeled: score is len * 10.
    (route.len() as u32) * 10
}

fn route_scores(routes: &[&str]) -> Vec<u32> {
    // TODO: score every route in a single batched crossing,
    // reusing route_score, and return one u32 per route.
    Vec::new()
}

fn main() {
    let label = build_label("billing", "/ready");
    let total = sum_bytes(&[1_u8, 2, 3, 4]);
    let score = route_score("/orders");
    let scores = route_scores(&["/a", "/bb", "/ccc"]);

    println!("label = {}", label);
    println!("sum = {}", total);
    println!("score = {}", score);
    println!("batch crossings = {}", if scores.is_empty() { 0 } else { 1 });
}
