#[derive(Debug, Copy, Clone)]
struct RequestId(u64);

#[derive(Debug, Clone)]
struct ServiceConfig {
    name: String,
    retries: usize,
}

impl ServiceConfig {
    fn name(&self) -> &str {
        &self.name
    }

    fn bump_retries(&mut self) {
        self.retries += 1;
    }

    fn replace_name(self, next: &str) -> Self {
        Self {
            name: next.to_string(),
            retries: self.retries,
        }
    }
}

fn main() {
    let request = RequestId(42);
    let request_copy = request;

    let mut live = ServiceConfig {
        name: String::from("ingest-v1"),
        retries: 1,
    };
    live.bump_retries();

    let replaced = live.clone().replace_name("ingest-v2");

    println!("request id copy = {}", request_copy.0);
    println!("live retries = {}", live.retries);
    println!("builder consumed = {}", replaced.name());
    println!("current name = {}", live.name());
}
