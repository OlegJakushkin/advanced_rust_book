use futures::stream::{FuturesUnordered, StreamExt};

#[tokio::main]
async fn main() {
    let mut pending = FuturesUnordered::new();
    pending.push(async { 3_u32 });
    pending.push(async { 5_u32 });
    pending.push(async { 8_u32 });

    let mut total = 0_u32;
    let mut completed = 0_u32;

    while let Some(value) = pending.next().await {
        total += value;
        completed += 1;
    }

    println!("completed = {}", completed);
    println!("total = {}", total);
}
