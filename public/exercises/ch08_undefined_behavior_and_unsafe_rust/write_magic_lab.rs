fn write_magic(buf: &mut [u8]) -> Result<(), &'static str> {
    let ptr = buf.as_mut_ptr();

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
