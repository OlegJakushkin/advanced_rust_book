fn selected_backend(s3: bool, local: bool) -> Result<&'static str, &'static str> {
    // Reject impossible combinations explicitly instead of assuming exactly
    // one backend was configured. Both-on and neither-on are equally invalid.
    match (s3, local) {
        (true, false) => Ok("s3"),
        (false, true) => Ok("local"),
        _ => Err("choose exactly one backend"),
    }
}

fn main() {
    println!("none = {:?}", selected_backend(false, false));
    println!("s3 = {:?}", selected_backend(true, false));
    println!("local = {:?}", selected_backend(false, true));
    println!("both = {:?}", selected_backend(true, true));
}
