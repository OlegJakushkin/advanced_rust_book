use std::collections::HashSet;
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
}
