mod billing {
    pub struct Invoice {
        id: u64,
        cents: u64,
    }

    impl Invoice {
        pub fn new(id: u64, cents: u64) -> Self {
            Self { id, cents }
        }

        pub fn id(&self) -> u64 {
            self.id
        }

        pub fn cents(&self) -> u64 {
            self.cents
        }
    }
}

trait Notifier {
    fn send(&self, invoice: &billing::Invoice) -> String;
}

struct EmailNotifier {
    prefix: &'static str,
}

impl Notifier for EmailNotifier {
    fn send(&self, invoice: &billing::Invoice) -> String {
        format!("{}{}", self.prefix, invoice.id())
    }
}

struct BillingService<N> {
    notifier: N,
    sent: usize,
}

impl<N: Notifier> BillingService<N> {
    fn process(&mut self, invoice: billing::Invoice) -> String {
        self.sent += 1;
        format!("invoice = {} cents = {}", invoice.id(), invoice.cents())
    }

    fn notify(&self, invoice: &billing::Invoice) -> String {
        self.notifier.send(invoice)
    }
}

fn main() {
    let mut service = BillingService {
        notifier: EmailNotifier {
            prefix: "queued email for ",
        },
        sent: 0,
    };

    let invoice = billing::Invoice::new(41, 1250);
    let notification = service.notify(&invoice);

    println!("{}", service.process(invoice));
    println!("notification = {}", notification);
    println!("sent = {}", service.sent);
}
