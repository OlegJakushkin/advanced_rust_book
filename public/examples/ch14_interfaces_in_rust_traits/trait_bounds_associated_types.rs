trait RetryPolicy {
    type Decision;

    fn decide(&self, attempts: u32) -> Self::Decision;

    fn label(&self) -> &'static str {
        "policy"
    }

    fn should_log(&self) -> bool {
        true
    }
}

struct FixedLimit {
    max: u32,
}

impl RetryPolicy for FixedLimit {
    type Decision = bool;

    fn decide(&self, attempts: u32) -> Self::Decision {
        attempts < self.max
    }

    fn label(&self) -> &'static str {
        "fixed-limit"
    }
}

fn evaluate<P>(policy: &P, attempts: u32) -> String
where
    P: RetryPolicy<Decision = bool>,
{
    format!("{} => {}", policy.label(), policy.decide(attempts))
}

fn main() {
    let policy = FixedLimit { max: 3 };

    println!("{}", evaluate(&policy, 2));
    println!("log = {}", policy.should_log());
}
