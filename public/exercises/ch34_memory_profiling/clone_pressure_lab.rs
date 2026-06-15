use std::sync::atomic::{AtomicUsize, Ordering};

static CLONES: AtomicUsize = AtomicUsize::new(0);

fn track_clone(value: &str) -> String {
    CLONES.fetch_add(1, Ordering::Relaxed);
    value.to_string()
}

fn hot_routes(routes: &[&str]) -> Vec<String> {
    let mut out = Vec::with_capacity(routes.len());

    for &route in routes {
        if route.starts_with("/api/") {
            out.push(track_clone(route));
        }
    }

    out
}

fn main() {
    let routes = ["/api/orders", "/health", "/api/users"];
    CLONES.store(0, Ordering::Relaxed);

    let selected = hot_routes(&routes);

    println!("selected = {}", selected.len());
    println!("clones = {}", CLONES.load(Ordering::Relaxed));
}
