fn parse_port(raw: Option<&str>) -> Result<u16, &'static str> {
    // Missing input is an absent Option: convert None into a named error.
    let text = raw.ok_or("missing port")?;
    // Malformed input is a parse failure: convert it into a different error.
    text.parse::<u16>().map_err(|_| "invalid port")
}

fn main() {
    println!("missing = {:?}", parse_port(None));
    println!("bad = {:?}", parse_port(Some("oops")));
    println!("ok = {:?}", parse_port(Some("8080")));
}
