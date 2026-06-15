//! Forward/backward-compatible decoding of a versioned record.

#[derive(Debug, PartialEq)]
struct Record {
    schema_version: u16,
    order_id: String,
    total_cents: u64,
    // Added in schema version 2. Old (v1) writers do not emit it.
    currency: String,
}

/// Encode a record as a tagged, line-oriented byte payload.
fn encode(rec: &Record) -> Vec<u8> {
    let body = format!(
        "v={};order_id={};total_cents={};currency={}",
        rec.schema_version, rec.order_id, rec.total_cents, rec.currency
    );
    body.into_bytes()
}

/// Decode a payload tolerantly: unknown fields are skipped, and a missing
/// `currency` field defaults so a v2 reader can still consume a v1 payload.
fn decode(bytes: &[u8]) -> Record {
    let text = String::from_utf8(bytes.to_vec()).unwrap();
    let mut schema_version = 0u16;
    let mut order_id = String::new();
    let mut total_cents = 0u64;
    let currency = String::from("USD");

    for field in text.split(';') {
        let (key, _value) = match field.split_once('=') {
            Some(pair) => pair,
            None => continue,
        };
        match key {
            // TODO: match each known key and assign its parsed value.
            // Leave currency at its default when the field is absent, and
            // ignore any key the reader does not recognize.
            _ => {}
        }
    }

    Record { schema_version, order_id, total_cents, currency }
}

fn main() {
    let v2 = Record {
        schema_version: 2,
        order_id: String::from("ord-7"),
        total_cents: 4200,
        currency: String::from("EUR"),
    };
    let round_trip = decode(&encode(&v2));
    println!("v2 currency = {}", round_trip.currency);
    println!("v2 round trip ok = {}", round_trip == v2);

    // A v1 producer omits `currency` and adds a field the reader has not seen.
    let v1_payload = b"v=1;order_id=ord-3;total_cents=999;region=eu";
    let upgraded = decode(v1_payload);
    println!("v1 schema = {}", upgraded.schema_version);
    println!("v1 currency = {}", upgraded.currency);
    println!("v1 total cents = {}", upgraded.total_cents);
}
