#[derive(Debug)]
enum ClientMessage {
    Subscribe { stream: String },
    Ping { nonce: u64 },
    Close { reason: Option<String> },
}

#[derive(Debug)]
struct Envelope<T> {
    version: u16,
    trace_id: &'static str,
    session_id: &'static str,
    payload: T,
}

fn main() {
    let envelope = Envelope {
        version: 2,
        trace_id: "req-7",
        session_id: "sess-11",
        payload: ClientMessage::Subscribe {
            stream: String::from("task-progress"),
        },
    };

    let kind = match &envelope.payload {
        ClientMessage::Subscribe { .. } => "subscribe",
        ClientMessage::Ping { .. } => "ping",
        ClientMessage::Close { .. } => "close",
    };

    println!("version = {}", envelope.version);
    println!("kind = {}", kind);
    println!("trace = {}", envelope.trace_id);
}
