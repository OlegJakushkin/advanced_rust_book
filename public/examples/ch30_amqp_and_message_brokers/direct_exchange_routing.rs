use std::collections::HashMap;

#[derive(Debug, Default)]
struct DirectExchange {
    bindings: HashMap<String, Vec<String>>,
}

impl DirectExchange {
    fn bind(&mut self, routing_key: &str, queue: &str) {
        self.bindings
            .entry(routing_key.to_string())
            .or_default()
            .push(queue.to_string());
    }

    fn route(&self, routing_key: &str) -> Vec<String> {
        self.bindings
            .get(routing_key)
            .cloned()
            .unwrap_or_default()
    }
}

fn main() {
    let mut exchange = DirectExchange::default();

    exchange.bind("orders.created", "billing");
    exchange.bind("orders.created", "search");
    exchange.bind("orders.cancelled", "billing");

    let created = exchange.route("orders.created");
    let cancelled = exchange.route("orders.cancelled");

    println!("created = {}", created.join(","));
    println!("cancelled = {}", cancelled.join(","));
    println!("unrouted = {}", exchange.route("orders.refunded").len());
}
