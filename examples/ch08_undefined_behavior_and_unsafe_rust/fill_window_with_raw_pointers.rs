fn fill_window(buf: &mut [u8], start: usize, len: usize, value: u8) {
    assert!(start <= buf.len());
    assert!(start + len <= buf.len());

    let ptr = buf.as_mut_ptr();

    for offset in 0..len {
        unsafe {
            // SAFETY:
            // - `buf` is exclusively borrowed for the duration of the call.
            // - bounds were checked above, so `start + offset` is in-bounds.
            // - overwriting initialized `u8` values is fine because `u8` has no drop glue.
            ptr.add(start + offset).write(value);
        }
    }
}

fn main() {
    let mut packet = String::from("header:0000").into_bytes();
    fill_window(&mut packet, 7, 4, 57);

    println!("{}", std::str::from_utf8(&packet).unwrap());
}
