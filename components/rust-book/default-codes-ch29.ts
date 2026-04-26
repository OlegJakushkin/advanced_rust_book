export const DEFAULT_CODES_CH29: Record<string, string> = {
  wasm_bindgen_string_array_boundary: `use wasm_bindgen::prelude::*;

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
}`,
  wasm_cpp_ffi_boundary: `mod cpp_shim {
    #[unsafe(no_mangle)]
    pub extern "C" fn cpp_route_score(ptr: *const u8, len: usize) -> u32 {
        if ptr.is_null() && len != 0 {
            return 0;
        }

        let bytes = unsafe {
            // SAFETY:
            // - ptr is either null with len == 0 or valid for len bytes.
            // - the shim only reads the bytes for the duration of the call.
            std::slice::from_raw_parts(ptr, len)
        };

        (bytes.len() as u32) * 10
    }
}

unsafe extern "C" {
    fn cpp_route_score(ptr: *const u8, len: usize) -> u32;
}

pub fn route_score(route: &str) -> u32 {
    unsafe {
        // SAFETY:
        // - route.as_ptr() is valid for route.len() bytes for the duration of the call.
        // - the shim borrows the bytes only for the duration of the call.
        cpp_route_score(route.as_ptr(), route.len())
    }
}

fn main() {
    let route = "/orders";
    println!("route = {}", route);
    println!("score = {}", route_score(route));
}`,
}
