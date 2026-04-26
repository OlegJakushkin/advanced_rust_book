export const DEFAULT_CODES_CH48: Record<string, string> = {
  websocket_connection_io_split: `use tokio::sync::{mpsc, watch};

#[derive(Debug)]
enum InboundFrame {
    Text(String),
    Ping(u64),
    Close,
}

#[derive(Debug)]
enum OutboundFrame {
    Text(String),
    Pong(u64),
    Close,
}

#[tokio::main]
async fn main() {
    let (inbound_tx, mut inbound_rx) = mpsc::channel::<InboundFrame>(4);
    let (outbound_tx, mut outbound_rx) = mpsc::channel::<OutboundFrame>(4);
    let (shutdown_tx, mut shutdown_rx) = watch::channel(false);

    let reader = tokio::spawn(async move {
        inbound_tx
            .send(InboundFrame::Text(String::from("ready")))
            .await
            .unwrap();
        inbound_tx.send(InboundFrame::Ping(7)).await.unwrap();
        inbound_tx.send(InboundFrame::Close).await.unwrap();
    });

    let app = tokio::spawn(async move {
        let mut inbound = 0_u32;

        while let Some(frame) = inbound_rx.recv().await {
            inbound += 1;

            match frame {
                InboundFrame::Text(text) => {
                    outbound_tx
                        .send(OutboundFrame::Text(format!("echo:{}", text)))
                        .await
                        .unwrap();
                }
                InboundFrame::Ping(nonce) => {
                    outbound_tx.send(OutboundFrame::Pong(nonce)).await.unwrap();
                }
                InboundFrame::Close => {
                    let _ = outbound_tx.send(OutboundFrame::Close).await;
                    shutdown_tx.send(true).unwrap();
                    break;
                }
            }
        }

        inbound
    });

    let writer = tokio::spawn(async move {
        let mut outbound = 0_u32;

        loop {
            tokio::select! {
                _ = shutdown_rx.changed() => {
                    if *shutdown_rx.borrow() {
                        break outbound;
                    }
                }
                Some(frame) = outbound_rx.recv() => {
                    match frame {
                        OutboundFrame::Text(_) | OutboundFrame::Pong(_) | OutboundFrame::Close => {
                            outbound += 1;
                        }
                    }
                }
            }
        }
    });

    reader.await.unwrap();
    let inbound = app.await.unwrap();
    let outbound = writer.await.unwrap();

    println!("inbound = {}", inbound);
    println!("outbound = {}", outbound);
    println!("closed = {}", true);
}`,
  websocket_bounded_fanout_slow_consumers: `use std::collections::{HashMap, VecDeque};

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
}`,
}
