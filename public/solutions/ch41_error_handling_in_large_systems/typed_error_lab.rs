#[derive(Debug, PartialEq, Eq)]
enum ConfigError {
    MissingPort,
    InvalidPort,
}

fn parse_port(raw: Option<&str>) -> Result<u16, ConfigError> {
    // ok_or promotes absence into a typed, matchable error; '?' short-circuits.
    let text = raw.ok_or(ConfigError::MissingPort)?;
    // map_err rewrites the std ParseIntError into our small contract.
    text.parse::<u16>().map_err(|_| ConfigError::InvalidPort)
}

fn main() {
    println!("missing = {:?}", parse_port(None));
    println!("bad = {:?}", parse_port(Some("oops")));
    println!("ok = {:?}", parse_port(Some("8080")));
}
