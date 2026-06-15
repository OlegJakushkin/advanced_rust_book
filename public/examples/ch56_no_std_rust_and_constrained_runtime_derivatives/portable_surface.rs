#[cfg(feature = "alloc")]
extern crate alloc;

#[cfg(feature = "alloc")]
use alloc::vec::Vec;

fn checksum(bytes: &[u8]) -> u32 {
    bytes.iter().map(|&byte| byte as u32).sum()
}

#[cfg(feature = "alloc")]
fn encode_frame(tag: u8, payload: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(payload.len() + 1);
    out.push(tag);
    out.extend_from_slice(payload);
    out
}

#[cfg(feature = "std")]
fn write_diagnostic(service: &str, checksum: u32) -> String {
    format!("{}:{}", service, checksum)
}

fn main() {
    let payload = [1_u8, 2, 3];
    let sum = checksum(&payload);

    println!("portable modes = core|alloc|std");
    println!("checksum = {}", sum);
    println!("alloc-gated api = encode_frame");
}
