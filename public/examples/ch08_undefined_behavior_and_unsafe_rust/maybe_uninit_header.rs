use std::mem::MaybeUninit;

fn build_header(tag: u8, size: u8) -> [u8; 4] {
    let mut bytes = MaybeUninit::<[u8; 4]>::uninit();
    let ptr = bytes.as_mut_ptr() as *mut u8;

    unsafe {
        // SAFETY:
        // - each element is written exactly once before `assume_init`.
        // - no reads occur before initialization completes.
        ptr.add(0).write(tag);
        ptr.add(1).write(size);
        ptr.add(2).write(tag ^ size);
        ptr.add(3).write(255);
        bytes.assume_init()
    }
}

fn main() {
    let header = build_header(7, 10);
    println!("{:?}", header);
}
