use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum OrderEvent {
    Created {
        order_id: String,
        customer_id: String,
        total_cents: u64,
    },
    Cancelled {
        order_id: String,
        reason: Option<String>,
    },
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
struct EventEnvelope {
    schema_version: u16,
    #[serde(default)]
    trace_id: Option<String>,
    event_id: String,
    payload: OrderEvent,
}

fn main() {
    let envelope = EventEnvelope {
        schema_version: 2,
        trace_id: None,
        event_id: String::from("evt-100"),
        payload: OrderEvent::Created {
            order_id: String::from("ord-7"),
            customer_id: String::from("cust-9"),
            total_cents: 4200,
        },
    };

    let json = serde_json::to_string(&envelope).unwrap();
    let decoded: EventEnvelope = serde_json::from_str(&json).unwrap();

    let kind = match &decoded.payload {
        OrderEvent::Created { .. } => "created",
        OrderEvent::Cancelled { .. } => "cancelled",
    };

    let total_cents = match decoded.payload {
        OrderEvent::Created { total_cents, .. } => total_cents,
        OrderEvent::Cancelled { .. } => 0,
    };

    println!("schema = {}", decoded.schema_version);
    println!("kind = {}", kind);
    println!("total cents = {}", total_cents);
}
