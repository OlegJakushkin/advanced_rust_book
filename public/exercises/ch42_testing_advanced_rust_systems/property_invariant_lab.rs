#[derive(Debug, Clone, Copy)]
struct Quota {
    limit: u32,
    used: u32,
}

impl Quota {
    fn reserve(&mut self, qty: u32) -> bool {
        self.used += qty;
        true
    }
}

fn invariant_holds(limit: u32, ops: &[u32]) -> bool {
    let mut quota = Quota { limit, used: 0 };

    for &qty in ops {
        let _accepted = quota.reserve(qty);
        if quota.used > quota.limit {
            return false;
        }
    }

    true
}

fn main() {
    let scenarios: &[&[u32]] = &[
        &[1_u32, 1, 1],
        &[4_u32, 4],
        &[5_u32, 4],
        &[2_u32, 2, 2, 2],
        &[8_u32],
    ];

    let all_valid = scenarios.iter().all(|ops| invariant_holds(8, ops));
    let violations = scenarios.iter().filter(|ops| !invariant_holds(8, ops)).count();

    println!("cases = {}", scenarios.len());
    println!("all valid = {}", all_valid);
    println!("violations = {}", violations);
}
