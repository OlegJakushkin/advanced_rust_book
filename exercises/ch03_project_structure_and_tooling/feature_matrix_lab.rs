fn selected_backend(s3: bool, local: bool) -> Result<&'static str, &'static str> {
    if s3 {
        return Ok("s3");
    }

    if local {
        return Ok("local");
    }

    Err("not configured")
}

fn main() {
    println!("none = {:?}", selected_backend(false, false));
    println!("s3 = {:?}", selected_backend(true, false));
    println!("local = {:?}", selected_backend(false, true));
    println!("both = {:?}", selected_backend(true, true));
}
