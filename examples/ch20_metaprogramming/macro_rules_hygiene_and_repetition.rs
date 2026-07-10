macro_rules! add_one {
    ($value:expr) => {{
        let temp = $value;
        temp + 1
    }};
}

macro_rules! sum_values {
    ($($value:expr),* $(,)?) => {{
        let mut total = 0;
        $(
            total += $value;
        )*
        total
    }};
}

fn main() {
    let total = 40;
    println!("next = {}", add_one!(total));
    println!("sum = {}", sum_values!(1, 2, 3));
    println!("outer total = {}", total);
}
