use std::borrow::Cow;

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

    if cents.len() != 2 {
        return Err(serde::de::Error::custom(
            "expected exactly two fractional digits",
        ));
    }

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
    let raw = "{\"request_id\":\"req-7\",\"route\":\"/checkout\",\"amount_cents\":\"12.50\"}";
    let audit: BorrowedAudit<'_> = serde_json::from_str(raw).unwrap();

    println!("request = {}", audit.request_id);
    println!("route = {}", audit.route);
    println!("amount cents = {}", audit.amount_cents);
}
