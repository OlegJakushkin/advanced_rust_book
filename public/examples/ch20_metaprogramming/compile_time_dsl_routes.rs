#[derive(Debug)]
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
}
