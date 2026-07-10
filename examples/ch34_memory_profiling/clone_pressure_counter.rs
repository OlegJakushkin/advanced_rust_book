#[derive(Debug, Default)]
struct CloneStats {
    clones: usize,
    cloned_bytes: usize,
}

fn select_api_routes(routes: &[&str], stats: &mut CloneStats) -> Vec<String> {
    let mut out = Vec::with_capacity(routes.len());

    for &route in routes {
        if route.starts_with("/api/") {
            stats.clones += 1;
            stats.cloned_bytes += route.len();
            out.push(route.to_string());
        }
    }

    out
}

fn main() {
    let routes = ["/api/orders", "/health", "/api/users"];
    let mut stats = CloneStats::default();
    let selected = select_api_routes(&routes, &mut stats);

    println!("selected = {}", selected.len());
    println!("clones = {}", stats.clones);
    println!("cloned bytes = {}", stats.cloned_bytes);
}
