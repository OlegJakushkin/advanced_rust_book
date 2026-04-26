use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum OrderEvent {
    Created {
        order_id: String,
        total_cents: u64,
    },
    Cancelled {
        order_id: String,
        reason: Option<String>,
    },
}

#[derive(Debug, Serialize, Deserialize)]
struct MessageEnvelope<T> {
    schema_version: u16,
    message_id: String,
    #[serde(default)]
    trace_id: Option<String>,
    payload: T,
}

fn main() {
    let envelope = MessageEnvelope {
        schema_version: 2,
        message_id: String::from("msg-100"),
        trace_id: Some(String::from("trace-9")),
        payload: OrderEvent::Created {
            order_id: String::from("ord-7"),
            total_cents: 4200,
        },
    };

    let json = serde_json::to_string(&envelope).unwrap();
    let decoded: MessageEnvelope<OrderEvent> = serde_json::from_str(&json).unwrap();

    let kind = match &decoded.payload {
        OrderEvent::Created { .. } => "created",
        OrderEvent::Cancelled { .. } => "cancelled",
    };

    println!("version = {}", decoded.schema_version);
    println!("kind = {}", kind);
}
