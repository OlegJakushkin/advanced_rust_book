export const DEFAULT_CODES_CH42: Record<string, string> = {
  testing_property_invariant_harness: `#[derive(Debug, Clone, Copy)]
struct Quota {
    limit: u32,
    used: u32,
}

impl Quota {
    fn try_reserve(&mut self, qty: u32) -> bool {
        // Plain addition is fine for these small demo values; in production
        // use self.used.saturating_add(qty) so a huge qty cannot overflow.
        if self.used + qty > self.limit {
            return false;
        }

        self.used += qty;
        true
    }
}

fn invariant_holds(limit: u32, ops: &[u32]) -> bool {
    let mut quota = Quota { limit, used: 0 };

    for &qty in ops {
        let _accepted = quota.try_reserve(qty);
        if quota.used > quota.limit {
            return false;
        }
    }

    true
}

fn main() {
    let limit = 8_u32;
    let scenarios: &[&[u32]] = &[
        &[1_u32, 1, 1],
        &[4_u32, 4],
        &[5_u32, 4],
        &[2_u32, 2, 2, 2],
        &[8_u32],
    ];

    let all_valid = scenarios
        .iter()
        .all(|ops| invariant_holds(limit, ops));

    println!("cases = {}", scenarios.len());
    println!("all valid = {}", all_valid);
    println!("limit = {}", limit);
}`,
  testing_async_idempotent_delivery_harness: `use std::collections::HashSet;
use std::sync::Arc;

use tokio::sync::Mutex;

#[derive(Default)]
struct FakeStore {
    applied: Mutex<HashSet<&'static str>>,
    duplicate_count: Mutex<usize>,
}

impl FakeStore {
    async fn apply_once(&self, event_id: &'static str) -> bool {
        let mut applied = self.applied.lock().await;
        if !applied.insert(event_id) {
            drop(applied);
            let mut duplicates = self.duplicate_count.lock().await;
            *duplicates += 1;
            return false;
        }

        true
    }

    async fn processed(&self) -> usize {
        self.applied.lock().await.len()
    }

    async fn duplicates(&self) -> usize {
        *self.duplicate_count.lock().await
    }
}

#[tokio::main]
async fn main() {
    let store = Arc::new(FakeStore::default());

    for event_id in ["evt-1", "evt-1", "evt-2"] {
        let _ = store.apply_once(event_id).await;
    }

    println!("processed = {}", store.processed().await);
    println!("duplicates = {}", store.duplicates().await);
    println!("deliveries = {}", 3);
}`,
}
