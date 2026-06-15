use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn build_label(service: &str, route: &str) -> String {
    format!("{}::{}", service, route)
}

#[wasm_bindgen]
pub fn sum_bytes(bytes: &[u8]) -> u32 {
    bytes.iter().map(|&value| value as u32).sum()
}

fn main() {
    let label = build_label("billing", "/ready");
    let total = sum_bytes(&[1_u8, 2, 3, 4]);

    println!("label = {}", label);
    println!("sum = {}", total);
}
