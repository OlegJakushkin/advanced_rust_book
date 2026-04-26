export const DEFAULT_CODES_CH28: Record<string, string> = {
  cpp_integration_calling_c_abi: `mod c_shim {
    #[unsafe(no_mangle)]
    pub extern "C" fn ffi_demo_abs(input: i32) -> i32 {
        input.abs()
    }
}

unsafe extern "C" {
    fn ffi_demo_abs(input: i32) -> i32;
}

fn safe_abs(input: i32) -> i32 {
    unsafe {
        // SAFETY:
        // - ffi_demo_abs uses the C ABI.
        // - the function takes a plain i32 and returns a plain i32.
        // - there is no cross-language ownership transfer in this call.
        ffi_demo_abs(input)
    }
}

fn main() {
    let left = -7_i32;
    let right = 11_i32;

    println!("abs({}) = {}", left, safe_abs(left));
    println!("abs({}) = {}", right, safe_abs(right));
}`,
  cpp_integration_export_rust_c_abi: `#[unsafe(no_mangle)]
pub extern "C" fn sum_i32s(ptr: *const i32, len: usize, out_total: *mut i64) -> i32 {
    if out_total.is_null() {
        return 1;
    }

    if ptr.is_null() && len != 0 {
        return 2;
    }

    let slice = unsafe {
        // SAFETY:
        // - ptr is either non-null for len elements, or len == 0.
        // - the caller promises the memory is readable for len i32 values.
        std::slice::from_raw_parts(ptr, len)
    };

    let total = slice.iter().map(|&value| value as i64).sum::<i64>();

    unsafe {
        // SAFETY:
        // - out_total was checked for null above.
        // - the caller promises it points to writable i64 storage.
        *out_total = total;
    }

    0
}

fn main() {
    let values = [3_i32, 4, 5];
    let mut total = -1_i64;

    let status = sum_i32s(values.as_ptr(), values.len(), &mut total);

    println!("status = {}", status);
    println!("total = {}", total);
}`,
}
