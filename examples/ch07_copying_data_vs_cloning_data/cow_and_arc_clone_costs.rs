use std::borrow::Cow;
use std::sync::Arc;

fn normalize_label(input: &str) -> Cow<'_, str> {
    if input.bytes().all(|b| matches!(b, b'a'..=b'z' | b'0'..=b'9' | b'-')) {
        Cow::Borrowed(input)
    } else {
        Cow::Owned(input.trim().to_ascii_lowercase().replace(' ', "-"))
    }
}

fn main() {
    let borrowed = normalize_label("ready");
    let owned = normalize_label("Mixed Case");
    let schema = Arc::new(String::from("event.v1"));
    let worker_schema = Arc::clone(&schema);

    println!("borrowed = {}", borrowed);
    println!("owned = {}", owned);
    println!("strong count = {}", Arc::strong_count(&worker_schema));
}
