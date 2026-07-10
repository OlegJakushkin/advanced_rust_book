macro_rules! service_checks {
    // Match repeated `name => bool` pairs with an optional trailing comma.
    // The name is captured for readability at the call site; the count
    // depends only on the boolean status expression.
    ($($name:ident => $status:expr),* $(,)?) => {{
        let mut passed = 0;
        $(
            let _ = stringify!($name);
            if $status {
                passed += 1;
            }
        )*
        passed
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
