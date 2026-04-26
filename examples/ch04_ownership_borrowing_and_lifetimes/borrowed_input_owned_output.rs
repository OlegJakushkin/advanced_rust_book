fn build_cache_key(service: &str, route: &str) -> String {
    format!("{}:{}", service, route)
}

fn main() {
    println!("{}", build_cache_key("billing", "/v1/invoices"));
    println!("{}", build_cache_key("search", "/ready"));
}
