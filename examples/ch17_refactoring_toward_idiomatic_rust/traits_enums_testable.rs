#[derive(Debug, Clone, Copy)]
enum DeliveryMode {
    Immediate,
    Retry,
}

trait Notifier {
    fn notify(&self, order_id: u64) -> String;
}

struct EmailNotifier;

impl Notifier for EmailNotifier {
    fn notify(&self, order_id: u64) -> String {
        format!("email:order-{}", order_id)
    }
}

struct OrderProcessor<N> {
    notifier: N,
    processed: usize,
}

impl<N: Notifier> OrderProcessor<N> {
    fn new(notifier: N) -> Self {
        Self {
            notifier,
            processed: 0,
        }
    }

    fn process(&mut self, order_id: u64, mode: DeliveryMode) -> String {
        self.processed += 1;

        match mode {
            DeliveryMode::Immediate => format!("charged = order-{}", order_id),
            DeliveryMode::Retry => format!("queued = order-{}", order_id),
        }
    }

    fn notify(&self, order_id: u64) -> String {
        self.notifier.notify(order_id)
    }
}

fn main() {
    let mut processor = OrderProcessor::new(EmailNotifier);
    let order_id = 7_u64;

    println!("{}", processor.process(order_id, DeliveryMode::Immediate));
    println!("notified = {}", processor.notify(order_id));
    println!("processed = {}", processor.processed);
}
