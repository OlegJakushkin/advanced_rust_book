use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Clone)]
struct Order {
    id: &'static str,
    lines: Vec<u64>,
}

#[derive(Debug, Error)]
enum DomainError {
    #[error("order {order_id} has no lines")]
    EmptyOrder { order_id: &'static str },
}

#[derive(Debug, Error)]
enum InfraError {
    #[error("order {order_id} not found in store")]
    MissingOrder { order_id: &'static str },
}

#[derive(Debug, Error)]
enum ServiceError {
    #[error(transparent)]
    Domain(#[from] DomainError),
    #[error(transparent)]
    Infra(#[from] InfraError),
}

fn load_order<'a>(
    store: &'a HashMap<&'static str, Order>,
    order_id: &'static str,
) -> Result<&'a Order, InfraError> {
    store
        .get(order_id)
        .ok_or(InfraError::MissingOrder { order_id })
}

fn total_cents(order: &Order) -> Result<u64, DomainError> {
    if order.lines.is_empty() {
        return Err(DomainError::EmptyOrder {
            order_id: order.id,
        });
    }

    Ok(order.lines.iter().copied().sum())
}

fn bill_order(
    store: &HashMap<&'static str, Order>,
    order_id: &'static str,
) -> Result<u64, ServiceError> {
    let order = load_order(store, order_id)?;
    Ok(total_cents(order)?)
}

fn main() {
    let mut store = HashMap::new();
    store.insert(
        "ord-ok",
        Order {
            id: "ord-ok",
            lines: vec![1200_u64, 3000],
        },
    );
    store.insert(
        "ord-empty",
        Order {
            id: "ord-empty",
            lines: vec![],
        },
    );

    println!("ok = {}", bill_order(&store, "ord-ok").unwrap());
    println!("missing = {}", bill_order(&store, "ord-missing").unwrap_err());
    println!("empty = {}", bill_order(&store, "ord-empty").unwrap_err());
}
