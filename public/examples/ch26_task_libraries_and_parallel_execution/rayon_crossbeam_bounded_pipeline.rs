use rayon::prelude::*;

fn main() {
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(2)
        .build()
        .unwrap();

    let (tx, rx) = crossbeam::channel::bounded::<Vec<u64>>(2);

    let (batches, total) = std::thread::scope(|scope| {
        scope.spawn(move || {
            tx.send(vec![1_u64, 2, 3, 4]).unwrap();
            tx.send(vec![5_u64, 6, 7, 8]).unwrap();
            tx.send(vec![9_u64, 10]).unwrap();
        });

        pool.install(|| {
            let mut batches = 0_u64;
            let mut total = 0_u64;

            while let Ok(batch) = rx.recv() {
                let subtotal: u64 = batch
                    .par_iter()
                    .copied()
                    .map(|value| value * 2)
                    .sum();

                total += subtotal;
                batches += 1;
            }

            (batches, total)
        })
    });

    println!("batches = {}", batches);
    println!("scaled total = {}", total);
    println!("pool threads = {}", 2);
}
