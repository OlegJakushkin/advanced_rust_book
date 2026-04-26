export const DEFAULT_CODES_CH16: Record<string, string> = {
  ddd_order_aggregate: `#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
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
}`,
  ddd_event_sourced_account: `#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct AccountId(u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AccountEvent {
    Opened { opening_balance_cents: i64 },
    Deposited { cents: i64 },
    Withdrawn { cents: i64 },
}

#[derive(Debug)]
enum DomainError {
    AlreadyOpened,
    NotOpen,
    InsufficientFunds,
}

#[derive(Debug)]
struct Account {
    id: AccountId,
    balance_cents: i64,
    version: usize,
    is_open: bool,
}

impl Account {
    fn rehydrate(id: AccountId, history: &[AccountEvent]) -> Result<Self, DomainError> {
        let mut account = Self {
            id,
            balance_cents: 0,
            version: 0,
            is_open: false,
        };

        for event in history {
            account.apply(*event)?;
            account.version += 1;
        }

        Ok(account)
    }

    fn apply(&mut self, event: AccountEvent) -> Result<(), DomainError> {
        match event {
            AccountEvent::Opened {
                opening_balance_cents,
            } => {
                if self.is_open {
                    return Err(DomainError::AlreadyOpened);
                }

                self.balance_cents = opening_balance_cents;
                self.is_open = true;
                Ok(())
            }
            AccountEvent::Deposited { cents } => {
                if !self.is_open {
                    return Err(DomainError::NotOpen);
                }

                self.balance_cents += cents;
                Ok(())
            }
            AccountEvent::Withdrawn { cents } => {
                if !self.is_open {
                    return Err(DomainError::NotOpen);
                }

                if self.balance_cents < cents {
                    return Err(DomainError::InsufficientFunds);
                }

                self.balance_cents -= cents;
                Ok(())
            }
        }
    }
}

fn main() {
    let history = vec![
        AccountEvent::Opened {
            opening_balance_cents: 1000,
        },
        AccountEvent::Deposited { cents: 400 },
        AccountEvent::Withdrawn { cents: 150 },
    ];

    let account = Account::rehydrate(AccountId(7), &history).unwrap();

    println!("events = {}", history.len());
    println!("balance cents = {}", account.balance_cents);
    println!("version = {}", account.version);
}`,
}
