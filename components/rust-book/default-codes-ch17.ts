export const DEFAULT_CODES_CH17: Record<string, string> = {
  refactoring_result_owned_api: `#[derive(Debug)]
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
}`,
  refactoring_traits_enums_testable: `#[derive(Debug, Clone, Copy)]
enum DeliveryMode {
    Immediate,
    Retry,
}

trait Notifier {
    fn notify(&self, order_id: u64) -> String;
}

struct EmailNotifier;

impl Notifier for EmailNotifier {
    fn notify(&self, order_id: u64) -> String {
        format!("email:order-{}", order_id)
    }
}

struct OrderProcessor<N> {
    notifier: N,
    processed: usize,
}

impl<N: Notifier> OrderProcessor<N> {
    fn new(notifier: N) -> Self {
        Self {
            notifier,
            processed: 0,
        }
    }

    fn process(&mut self, order_id: u64, mode: DeliveryMode) -> String {
        self.processed += 1;

        match mode {
            DeliveryMode::Immediate => format!("charged = order-{}", order_id),
            DeliveryMode::Retry => format!("queued = order-{}", order_id),
        }
    }

    fn notify(&self, order_id: u64) -> String {
        self.notifier.notify(order_id)
    }
}

fn main() {
    let mut processor = OrderProcessor::new(EmailNotifier);
    let order_id = 7_u64;

    println!("{}", processor.process(order_id, DeliveryMode::Immediate));
    println!("notified = {}", processor.notify(order_id));
    println!("processed = {}", processor.processed);
}`,
}
