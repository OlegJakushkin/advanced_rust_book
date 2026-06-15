use std::collections::{HashMap, VecDeque};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct PeerId(&'static str);

#[derive(Debug, Clone)]
enum Event {
    Connected(PeerId),
    Request {
        peer: PeerId,
        id: u64,
    },
    Response {
        peer: PeerId,
        id: u64,
        body: String,
    },
}

#[derive(Debug, Default)]
struct SwarmState {
    connected: Vec<PeerId>,
    pending: HashMap<u64, PeerId>,
    log: VecDeque<String>,
}

impl SwarmState {
    fn on_event(&mut self, event: Event) {
        match event {
            Event::Connected(peer) => {
                self.connected.push(peer);
            }
            Event::Request { peer, id } => {
                self.pending.insert(id, peer);
                self.log.push_back(format!("request {}", id));
            }
            Event::Response { peer, id, body } => {
                // Repaired branch: the pending map is the source of truth for
                // in-flight work, so the response must remove the entry that
                // its matching request inserted, then record itself in the log.
                self.pending.remove(&id);
                self.log
                    .push_back(format!("response {} {}", peer.0, body));
            }
        }
    }
}

fn main() {
    let mut state = SwarmState::default();
    let peer = PeerId("peer-b");

    state.on_event(Event::Connected(peer));
    state.on_event(Event::Request { peer, id: 7 });
    state.on_event(Event::Response {
        peer,
        id: 7,
        body: String::from("state-v3"),
    });

    println!("connected = {}", state.connected.len());
    println!("pending = {}", state.pending.len());
    println!("last = {}", state.log.back().map(String::as_str).unwrap_or("none"));
}
