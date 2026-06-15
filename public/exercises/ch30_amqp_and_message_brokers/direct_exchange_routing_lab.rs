use std::collections::HashMap;

#[derive(Default)]
struct DirectExchange {
    bindings: HashMap<String, Vec<String>>,
    unrouted: usize,
}

impl DirectExchange {
    fn bind(&mut self, routing_key: &str, queue: &str) {
        self.bindings
            .entry(routing_key.to_string())
            .or_default()
            .push(queue.to_string());
    }

    fn route(&mut self, routing_key: &str) -> Vec<String> {
        // TODO: return the queues bound to routing_key.
        // If the key has no binding, increment self.unrouted and return an empty Vec.
        Vec::new()
    }
}

fn main() {
    let mut exchange = DirectExchange::default();
    exchange.bind("orders.created", "billing");
    exchange.bind("orders.created", "search");
    exchange.bind("orders.cancelled", "billing");

    let created = exchange.route("orders.created");
    let cancelled = exchange.route("orders.cancelled");
    let _ = exchange.route("orders.refunded");
    let _ = exchange.route("orders.archived");

    println!("orders.created -> {}", created.join(","));
    println!("orders.cancelled -> {}", cancelled.join(","));
    println!("unrouted total = {}", exchange.unrouted);
}
