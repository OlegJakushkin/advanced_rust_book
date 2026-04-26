#[repr(C)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Status {
    Ok = 0,
    NullPtr = 1,
    EmptyInput = 2,
}

#[unsafe(no_mangle)]
pub extern "C" fn first_segment_len(
    ptr: *const u8,
    len: usize,
    out_len: *mut usize,
) -> Status {
    if out_len.is_null() {
        return Status::NullPtr;
    }

    if ptr.is_null() && len != 0 {
        return Status::NullPtr;
    }

    let bytes = unsafe {
        // SAFETY:
        // - ptr is either valid for len bytes or len == 0.
        // - the caller retains ownership of the input bytes.
        std::slice::from_raw_parts(ptr, len)
    };

    let segment = bytes.split(|&byte| byte == b'/').find(|part| !part.is_empty());

    let Some(segment) = segment else {
        return Status::EmptyInput;
    };

    unsafe {
        // SAFETY:
        // - out_len was checked for null above.
        // - the caller promises it points to writable usize storage.
        *out_len = segment.len();
    }

    Status::Ok
}

fn main() {
    let route = b"/api/orders";
    let mut len = 0_usize;

    let status = first_segment_len(route.as_ptr(), route.len(), &mut len);

    println!("status = {}", status as u32);
    println!("segment len = {}", len);
}
