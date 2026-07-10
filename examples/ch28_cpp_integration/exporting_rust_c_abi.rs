#[unsafe(no_mangle)]
pub extern "C" fn sum_i32s(ptr: *const i32, len: usize, out_total: *mut i64) -> i32 {
    if out_total.is_null() {
        return 1;
    }

    if ptr.is_null() {
        return 2;
    }

    let slice = unsafe {
        // SAFETY:
        // - ptr is non-null and the caller promises it is valid for len i32 values.
        // - from_raw_parts requires a non-null, aligned pointer even when len == 0.
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
}
