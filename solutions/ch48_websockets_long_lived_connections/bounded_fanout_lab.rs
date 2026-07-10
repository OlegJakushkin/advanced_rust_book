use std::collections::{HashMap, VecDeque};

#[derive(Debug, Default)]
struct Client {
    pending: VecDeque<String>,
}

#[derive(Debug)]
struct Hub {
    clients: HashMap<&'static str, Client>,
    max_pending: usize,
    delivered: usize,
    evicted: Vec<&'static str>,
}

impl Hub {
    fn new(max_pending: usize) -> Self {
        Self {
            clients: HashMap::new(),
            max_pending,
            delivered: 0,
            evicted: Vec::new(),
        }
    }

    fn add_client(&mut self, id: &'static str, pending: usize) {
        let mut queue = VecDeque::new();
        for _ in 0..pending {
            queue.push_back(String::from("old"));
        }

        self.clients.insert(id, Client { pending: queue });
    }

    fn broadcast(&mut self, payload: &str) {
        // Iterate over a stable, sorted snapshot of ids so eviction order is
        // deterministic regardless of HashMap iteration order.
        let mut ids: Vec<_> = self.clients.keys().copied().collect();
        ids.sort_unstable();

        for id in ids {
            // The capacity check happens BEFORE the push: a client already at
            // the bound is too slow for this policy and is evicted instead of
            // being allowed to grow memory further.
            let at_limit = self
                .clients
                .get(id)
                .map(|client| client.pending.len() >= self.max_pending)
                .unwrap_or(false);

            if at_limit {
                self.clients.remove(id);
                self.evicted.push(id);
                continue;
            }

            if let Some(client) = self.clients.get_mut(id) {
                client.pending.push_back(payload.to_string());
                self.delivered += 1;
            }
        }
    }
}

fn main() {
    let mut hub = Hub::new(2);
    hub.add_client("alpha", 0);
    hub.add_client("beta", 2);
    hub.add_client("gamma", 1);

    hub.broadcast("first");
    hub.broadcast("second");

    println!("active = {}", hub.clients.len());
    println!(
        "evicted = {}",
        if hub.evicted.is_empty() {
            "none".to_string()
        } else {
            hub.evicted.join(",")
        }
    );
    println!("delivered = {}", hub.delivered);
}
