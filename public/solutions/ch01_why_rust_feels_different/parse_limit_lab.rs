fn parse_limit(input: Option<&str>) -> Result<usize, &'static str> {
    match input {
        None => Ok(100),
        Some(raw) => match raw.parse::<usize>() {
            Ok(0) => Err("limit must be greater than 0"),
            Ok(limit) => Ok(limit),
            Err(_) => Err("invalid number"),
        },
    }
}

fn main() {
    println!("default = {:?}", parse_limit(None));
    println!("zero = {:?}", parse_limit(Some("0")));
    println!("value = {:?}", parse_limit(Some("25")));
}
