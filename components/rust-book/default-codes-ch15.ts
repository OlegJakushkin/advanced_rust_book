export const DEFAULT_CODES_CH15: Record<string, string> = {
  oop_models_composition_traits: `mod billing {
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
}`,
  oop_models_enum_state_machine: `#[derive(Debug)]
enum Document {
    Draft { title: String },
    Review { title: String, reviewer: String },
    Published { title: String, slug: String },
}

impl Document {
    fn request_review(self, reviewer: &str) -> Self {
        match self {
            Document::Draft { title } => Document::Review {
                title,
                reviewer: reviewer.to_string(),
            },
            state => state,
        }
    }

    fn publish(self) -> Self {
        match self {
            Document::Review { title, .. } => {
                let slug = title.to_lowercase().replace(' ', "-");
                Document::Published { title, slug }
            }
            state => state,
        }
    }

    fn state(&self) -> &'static str {
        match self {
            Document::Draft { .. } => "draft",
            Document::Review { .. } => "review",
            Document::Published { .. } => "published",
        }
    }

    fn slug(&self) -> &str {
        match self {
            Document::Published { slug, .. } => slug,
            _ => "none",
        }
    }
}

fn main() {
    let doc = Document::Draft {
        title: String::from("Rust OOP"),
    }
    .request_review("mina")
    .publish();

    println!("state = {}", doc.state());
    println!("slug = {}", doc.slug());
}`,
}
