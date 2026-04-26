mod c_shim {
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
        // - the function takes and returns plain integers.
        // - this call has no cross-language ownership or lifetime transfer.
        ffi_demo_abs(input)
    }
}

fn main() {
    let left = -7_i32;
    let right = 11_i32;

    println!("abs({}) = {}", left, safe_abs(left));
    println!("abs({}) = {}", right, safe_abs(right));
}
