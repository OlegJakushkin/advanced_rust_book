use std::collections::{BTreeSet, HashMap, VecDeque};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
struct PeerId(&'static str);

#[derive(Debug, Clone)]
enum LocalCommand {
    Dial(PeerId),
    SendRequest {
        peer: PeerId,
        request_id: u64,
        body: String,
    },
    Publish {
        topic: &'static str,
        body: String,
    },
}

#[derive(Debug, Clone)]
enum NetworkEvent {
    ConnectionEstablished(PeerId),
    Response {
        peer: PeerId,
        request_id: u64,
        body: String,
    },
    Gossip {
        peer: PeerId,
        topic: &'static str,
        body: String,
    },
}

#[derive(Debug, Default)]
struct SwarmState {
    connected: BTreeSet<PeerId>,
    pending_requests: HashMap<u64, PeerId>,
    log: VecDeque<String>,
}

impl SwarmState {
    fn on_command(&mut self, command: LocalCommand) {
        match command {
            LocalCommand::Dial(peer) => {
                self.log.push_back(format!("dial {}", peer.0));
            }
            LocalCommand::SendRequest {
                peer,
                request_id,
                body,
            } => {
                self.pending_requests.insert(request_id, peer);
                self.log.push_back(format!("request {} {}", peer.0, body));
            }
            LocalCommand::Publish { topic, body } => {
                self.log.push_back(format!("publish {} {}", topic, body));
            }
        }
    }

    fn on_event(&mut self, event: NetworkEvent) {
        match event {
            NetworkEvent::ConnectionEstablished(peer) => {
                self.connected.insert(peer);
                self.log.push_back(format!("connected {}", peer.0));
            }
            NetworkEvent::Response {
                peer,
                request_id,
                body,
            } => {
                self.pending_requests.remove(&request_id);
                self.log.push_back(format!("response {} {}", peer.0, body));
            }
            NetworkEvent::Gossip { peer, topic, body } => {
                self.log
                    .push_back(format!("gossip {} {} {}", topic, peer.0, body));
            }
        }
    }
}

fn main() {
    let mut swarm = SwarmState::default();
    let peer = PeerId("peer-b");

    swarm.on_command(LocalCommand::Dial(peer));
    swarm.on_event(NetworkEvent::ConnectionEstablished(peer));
    swarm.on_command(LocalCommand::SendRequest {
        peer,
        request_id: 7,
        body: String::from("want-state"),
    });
    swarm.on_event(NetworkEvent::Response {
        peer,
        request_id: 7,
        body: String::from("state-v3"),
    });
    swarm.on_event(NetworkEvent::Gossip {
        peer,
        topic: "heads",
        body: String::from("tip=9"),
    });

    println!("connected = {}", swarm.connected.len());
    println!("pending = {}", swarm.pending_requests.len());
    println!(
        "last = {}",
        swarm.log.back().map(String::as_str).unwrap_or("none")
    );
}
