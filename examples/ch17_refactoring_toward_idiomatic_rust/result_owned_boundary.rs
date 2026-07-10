#[derive(Debug)]
enum ConfigError {
    MissingPort,
    InvalidPort,
}

#[derive(Debug)]
struct Endpoint {
    service: String,
    bind: String,
}

impl Endpoint {
    fn requires_tls(&self) -> bool {
        self.bind.ends_with(":443")
    }
}

fn parse_port(raw: Option<&str>) -> Result<u16, ConfigError> {
    let text = raw.ok_or(ConfigError::MissingPort)?;
    text.parse::<u16>().map_err(|_| ConfigError::InvalidPort)
}

fn load_endpoint(service: &str, host: &str, port_raw: Option<&str>) -> Result<Endpoint, ConfigError> {
    let port = parse_port(port_raw)?;

    Ok(Endpoint {
        service: service.to_string(),
        bind: format!("{}:{}", host, port),
    })
}

fn main() {
    let endpoint = load_endpoint("billing", "127.0.0.1", Some("443")).unwrap();

    println!("endpoint = {}@{}", endpoint.service, endpoint.bind);
    println!("requires tls = {}", endpoint.requires_tls());
}
