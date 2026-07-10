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

#[derive(Debug)]
enum DomainError {
    InvalidQuantity,
    EmptyOrder,
    CannotModifySubmittedOrder,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OrderStatus {
    Draft,
    Submitted,
}

#[derive(Debug)]
struct Order {
    status: OrderStatus,
    lines: Vec<(Quantity, u64)>,
}

impl Order {
    fn new() -> Self {
        Self { status: OrderStatus::Draft, lines: Vec::new() }
    }

    fn add_line(&mut self, qty: Quantity, unit_price_cents: u64) -> Result<(), DomainError> {
        if self.status == OrderStatus::Submitted {
            return Err(DomainError::CannotModifySubmittedOrder);
        }
        self.lines.push((qty, unit_price_cents));
        Ok(())
    }

    fn submit(&mut self) -> Result<(), DomainError> {
        // TODO: reject an empty order with DomainError::EmptyOrder,
        // otherwise move the status to Submitted and return Ok(()).
        self.status = OrderStatus::Submitted;
        Ok(())
    }

    fn total_cents(&self) -> u64 {
        // TODO: sum qty.get() as u64 * unit_price_cents over every line.
        0
    }

    fn status(&self) -> &'static str {
        match self.status {
            OrderStatus::Draft => "draft",
            OrderStatus::Submitted => "submitted",
        }
    }
}

fn main() {
    let mut order = Order::new();
    order.add_line(Quantity::new(2).unwrap(), 1500).unwrap();
    order.add_line(Quantity::new(3).unwrap(), 400).unwrap();

    let submitted = order.submit().is_ok();
    let blocked = order.add_line(Quantity::new(1).unwrap(), 100).is_err();
    let zero_qty = Quantity::new(0).is_err();

    println!("lines = {}", order.lines.len());
    println!("total cents = {}", order.total_cents());
    println!("state = {}", order.status());
    println!("submit ok = {}", submitted);
    println!("locked after submit = {}", blocked);
    println!("zero qty rejected = {}", zero_qty);
}
