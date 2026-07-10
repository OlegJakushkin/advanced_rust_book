#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
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
}
