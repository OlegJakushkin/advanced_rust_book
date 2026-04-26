export const DEFAULT_CODES_CH20: Record<string, string> = {
  metaprogramming_macro_rules_hygiene: `macro_rules! add_one {
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
}`,
  metaprogramming_compile_time_dsl: `#[derive(Debug)]
struct Route {
    method: &'static str,
    path: &'static str,
    auth: bool,
}

macro_rules! routes {
    ($( $method:ident $path:literal => $auth:ident ),* $(,)?) => {{
        vec![
            $(
                Route {
                    method: stringify!($method),
                    path: $path,
                    auth: routes!(@auth $auth),
                }
            ),*
        ]
    }};
    (@auth public) => { false };
    (@auth private) => { true };
}

fn main() {
    let table = routes!(
        GET "/health" => public,
        POST "/orders" => private,
        DELETE "/orders/:id" => private,
    );

    let private_count = table.iter().filter(|route| route.auth).count();

    println!("routes = {}", table.len());
    println!("first = {} {}", table[0].method, table[0].path);
    println!("private = {}", private_count);
}`,
}
