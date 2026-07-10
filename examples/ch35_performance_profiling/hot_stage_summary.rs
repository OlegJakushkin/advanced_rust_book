#[derive(Debug, Clone, Copy)]
struct StageSample {
    name: &'static str,
    micros: u64,
}

fn hottest_stage(samples: &[StageSample]) -> (&'static str, u64, u64) {
    let total: u64 = samples.iter().map(|sample| sample.micros).sum();
    let hottest = samples
        .iter()
        .max_by_key(|sample| sample.micros)
        .copied()
        .unwrap();

    (hottest.name, hottest.micros, total)
}

fn main() {
    let samples = [
        StageSample {
            name: "parse",
            micros: 180,
        },
        StageSample {
            name: "serialize",
            micros: 620,
        },
        StageSample {
            name: "lock_wait",
            micros: 40,
        },
    ];

    let (stage, hottest, total) = hottest_stage(&samples);

    println!("hottest = {}", stage);
    println!("stage us = {}", hottest);
    println!("total us = {}", total);
}
