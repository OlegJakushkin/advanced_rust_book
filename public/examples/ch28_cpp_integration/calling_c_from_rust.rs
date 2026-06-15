mod c_shim {
    #[unsafe(no_mangle)]
    pub extern "C" fn ffi_demo_abs(input: i32) -> i32 {
        input.wrapping_abs()
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
}
