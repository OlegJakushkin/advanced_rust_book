export const DEFAULT_CODES_CH19: Record<string, string> = {
  serialization_contracts_versioned_event: `use serde::{Deserialize, Serialize};

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
}`,
  serialization_contracts_custom_zero_copy: `use std::borrow::Cow;

use serde::{Deserialize, Deserializer, Serialize, Serializer};

fn cents_as_decimal<S>(value: &u64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    let text = format!("{}.{:02}", value / 100, value % 100);
    serializer.serialize_str(&text)
}

fn decimal_as_cents<'de, D>(deserializer: D) -> Result<u64, D::Error>
where
    D: Deserializer<'de>,
{
    let text = Cow::<str>::deserialize(deserializer)?;
    let (units, cents) = text
        .split_once('.')
        .ok_or_else(|| serde::de::Error::custom("expected decimal amount"))?;

    let whole = units.parse::<u64>().map_err(serde::de::Error::custom)?;
    let frac = cents.parse::<u64>().map_err(serde::de::Error::custom)?;

    Ok(whole * 100 + frac)
}

#[derive(Debug, Serialize, Deserialize)]
struct BorrowedAudit<'a> {
    #[serde(borrow)]
    request_id: &'a str,
    #[serde(borrow)]
    route: Cow<'a, str>,
    #[serde(
        serialize_with = "cents_as_decimal",
        deserialize_with = "decimal_as_cents"
    )]
    amount_cents: u64,
}

fn main() {
    let raw = "{\\"request_id\\":\\"req-7\\",\\"route\\":\\"/checkout\\",\\"amount_cents\\":\\"12.50\\"}";
    let audit: BorrowedAudit<'_> = serde_json::from_str(raw).unwrap();

    println!("request = {}", audit.request_id);
    println!("route = {}", audit.route);
    println!("amount cents = {}", audit.amount_cents);
}`,
}
