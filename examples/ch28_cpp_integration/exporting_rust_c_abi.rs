#[unsafe(no_mangle)]
pub extern "C" fn sum_i32s(ptr: *const i32, len: usize, out_total: *mut i64) -> i32 {
    if out_total.is_null() {
        return 1;
    }

    if ptr.is_null() && len != 0 {
        return 2;
    }

    let slice = unsafe {
        // SAFETY:
        // - ptr is either valid for len i32 values or len == 0.
        // - the caller retains ownership of the input buffer.
        std::slice::from_raw_parts(ptr, len)
    };

    let total = slice.iter().map(|&value| value as i64).sum::<i64>();

    unsafe {
        // SAFETY:
        // - out_total was checked for null above.
        // - the caller promises this points to writable i64 storage.
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
}
