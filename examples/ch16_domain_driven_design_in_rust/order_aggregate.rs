#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct OrderId(u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct CustomerId(u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Quantity(u32);

impl Quantity {
    fn new(value: u32) -> Result<Self, DomainError> {
        if value == 0 {
            return Err(DomainError::InvalidQuantity);
        }
        Ok(Self(value))
    }

    fn get(self) -> u32 {
        self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct MoneyCents(u64);

impl MoneyCents {
    fn new(value: u64) -> Self {
        Self(value)
    }

    fn get(self) -> u64 {
        self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Sku(String);

impl Sku {
    fn new(value: &str) -> Result<Self, DomainError> {
        if value.trim().is_empty() {
            return Err(DomainError::EmptySku);
        }
        Ok(Self(value.to_string()))
    }
}

#[derive(Debug)]
struct OrderLine {
    sku: Sku,
    qty: Quantity,
    unit_price: MoneyCents,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OrderStatus {
    Draft,
    Submitted,
}

#[derive(Debug)]
enum DomainError {
    InvalidQuantity,
    EmptySku,
    EmptyOrder,
    CannotModifySubmittedOrder,
}

#[derive(Debug)]
struct Order {
    id: OrderId,
    customer_id: CustomerId,
    status: OrderStatus,
    lines: Vec<OrderLine>,
}

impl Order {
    fn new(id: OrderId, customer_id: CustomerId) -> Self {
        Self {
            id,
            customer_id,
            status: OrderStatus::Draft,
            lines: Vec::new(),
        }
    }

    fn add_line(&mut self, sku: Sku, qty: Quantity, unit_price: MoneyCents) -> Result<(), DomainError> {
        if self.status == OrderStatus::Submitted {
            return Err(DomainError::CannotModifySubmittedOrder);
        }

        self.lines.push(OrderLine {
            sku,
            qty,
            unit_price,
        });

        Ok(())
    }

    fn submit(&mut self) -> Result<(), DomainError> {
        if self.lines.is_empty() {
            return Err(DomainError::EmptyOrder);
        }

        self.status = OrderStatus::Submitted;
        Ok(())
    }

    fn total_cents(&self) -> u64 {
        self.lines
            .iter()
            .map(|line| line.qty.get() as u64 * line.unit_price.get())
            .sum()
    }

    fn status(&self) -> &'static str {
        match self.status {
            OrderStatus::Draft => "draft",
            OrderStatus::Submitted => "submitted",
        }
    }
}

fn main() {
    let mut order = Order::new(OrderId(1001), CustomerId(7));

    order
        .add_line(
            Sku::new("BOOK-1").unwrap(),
            Quantity::new(2).unwrap(),
            MoneyCents::new(1500),
        )
        .unwrap();

    order
        .add_line(
            Sku::new("PEN-9").unwrap(),
            Quantity::new(3).unwrap(),
            MoneyCents::new(400),
        )
        .unwrap();

    order.submit().unwrap();

    println!("lines = {}", order.lines.len());
    println!("total cents = {}", order.total_cents());
    println!("state = {}", order.status());
}
