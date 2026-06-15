use std::sync::atomic::{AtomicUsize, Ordering};

static CLONES: AtomicUsize = AtomicUsize::new(0);

// Kept only to show the contrast: the original path called this for every
// selected route, so `clones` counted one deep copy per output element.
#[allow(dead_code)]
fn track_clone(value: &str) -> String {
    CLONES.fetch_add(1, Ordering::Relaxed);
    value.to_string()
}

// The filter only needs to *read* the routes to decide which survive, so it
// borrows. Returning Vec<&str> tied to the input lifetime removes every deep
// clone: no fresh buffers are allocated, and `track_clone` is never called.
fn hot_routes<'a>(routes: &[&'a str]) -> Vec<&'a str> {
    let mut out = Vec::with_capacity(routes.len());

    for &route in routes {
        if route.starts_with("/api/") {
            out.push(route); // borrow the existing &str; no allocation, no clone
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
