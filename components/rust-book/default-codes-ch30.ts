export const DEFAULT_CODES_CH30: Record<string, string> = {
  amqp_direct_exchange_routing: `use std::collections::HashMap;

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
}`,
  amqp_idempotent_consumer: `use std::collections::{HashSet, VecDeque};

#[derive(Debug, Clone)]
struct Delivery {
    message_id: &'static str,
    order_id: &'static str,
    attempt: u8,
}

#[derive(Default)]
struct Consumer {
    processed_ids: HashSet<String>,
    retry_queue: VecDeque<Delivery>,
    dlq: Vec<Delivery>,
    processed: usize,
    duplicates: usize,
    retried: usize,
}

impl Consumer {
    fn on_delivery(&mut self, delivery: Delivery) {
        if self.processed_ids.contains(delivery.message_id) {
            self.duplicates += 1;
            return;
        }

        if delivery.order_id == "ord-fail" {
            if delivery.attempt < 3 {
                self.retried += 1;
                self.retry_queue.push_back(Delivery {
                    attempt: delivery.attempt + 1,
                    ..delivery
                });
            } else {
                self.dlq.push(delivery);
            }
            return;
        }

        self.processed += 1;
        self.processed_ids.insert(delivery.message_id.to_string());
    }
}

fn main() {
    let mut consumer = Consumer::default();

    consumer.on_delivery(Delivery {
        message_id: "msg-1",
        order_id: "ord-1",
        attempt: 1,
    });
    consumer.on_delivery(Delivery {
        message_id: "msg-1",
        order_id: "ord-1",
        attempt: 1,
    });
    consumer.on_delivery(Delivery {
        message_id: "msg-2",
        order_id: "ord-fail",
        attempt: 1,
    });

    while let Some(delivery) = consumer.retry_queue.pop_front() {
        consumer.on_delivery(delivery);
    }

    consumer.on_delivery(Delivery {
        message_id: "msg-3",
        order_id: "ord-3",
        attempt: 1,
    });

    println!("processed = {}", consumer.processed);
    println!("duplicates = {}", consumer.duplicates);
    println!("retried = {}", consumer.retried);
    println!("dlq = {}", consumer.dlq.len());
}`,
}
