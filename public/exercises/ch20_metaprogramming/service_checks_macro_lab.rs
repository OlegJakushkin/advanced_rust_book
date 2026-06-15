macro_rules! service_checks {
    ($($name:ident => $status:expr),* $(,)?) => {{
        0
    }};
}

fn main() {
    let passed = service_checks!(
        health => true,
        orders => true,
        billing => false,
    );

    println!("passed = {}", passed);
    println!("total = {}", 3);
}
