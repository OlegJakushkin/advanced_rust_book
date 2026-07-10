fn write_magic(buf: &mut [u8]) -> Result<(), &'static str> {
    // Precondition check first: the unsafe block must inherit a true invariant.
    if buf.len() < 4 {
        return Err("buffer too small");
    }

    let ptr = buf.as_mut_ptr();

    // SAFETY:
    // - The length check above guarantees at least 4 writable bytes exist,
    //   so offsets 0..=3 are in-bounds.
    // - `buf` is exclusively borrowed as `&mut [u8]`, so no other access aliases it.
    // - `u8` has no drop glue, so overwriting initialized bytes needs no destructor.
    unsafe {
        ptr.add(0).write(82);
        ptr.add(1).write(83);
        ptr.add(2).write(84);
        ptr.add(3).write(33);
    }

    Ok(())
}

fn main() {
    let mut short = vec![0u8; 3];
    let mut ok = vec![0u8; 4];

    println!("short = {:?}", write_magic(&mut short));
    println!("value = {:?}", write_magic(&mut ok));
    println!("buf = {}", std::str::from_utf8(&ok).unwrap());
}
