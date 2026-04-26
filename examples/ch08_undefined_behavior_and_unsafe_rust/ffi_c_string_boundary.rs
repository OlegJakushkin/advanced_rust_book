use std::ffi::{c_char, CStr, CString};

unsafe extern "C" fn c_strlen(ptr: *const c_char) -> usize {
    if ptr.is_null() {
        return 0;
    }

    unsafe { CStr::from_ptr(ptr).to_bytes().len() }
}

fn safe_strlen(text: &CStr) -> usize {
    unsafe {
        // SAFETY:
        // - `text.as_ptr()` comes from a live `CStr`.
        // - `CStr` guarantees a valid, NUL-terminated byte sequence for reads.
        c_strlen(text.as_ptr())
    }
}

fn main() {
    let text = CString::new("rust").unwrap();
    println!("len = {}", safe_strlen(text.as_c_str()));
}
