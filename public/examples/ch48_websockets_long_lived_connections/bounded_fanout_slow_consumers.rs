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
        let ids: Vec<_> = self.clients.keys().copied().collect();

        for id in ids {
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

    hub.broadcast("update");

    println!("active = {}", hub.clients.len());
    println!("evicted = {}", hub.evicted.join(","));
    println!("delivered = {}", hub.delivered);
}
