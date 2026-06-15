fn parse_port(raw: Option<&str>) -> Result<u16, &'static str> {
    let text = raw.unwrap();
    Ok(text.parse::<u16>().unwrap())
}

fn main() {
    println!("missing = {:?}", parse_port(None));
    println!("bad = {:?}", parse_port(Some("oops")));
    println!("ok = {:?}", parse_port(Some("8080")));
}
