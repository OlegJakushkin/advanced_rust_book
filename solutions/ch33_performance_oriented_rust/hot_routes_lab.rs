#[derive(Debug)]
struct Request<'a> {
    route: &'a str,
    bytes: usize,
}

// Borrow-first, preallocated hot-route filter.
// - The result is sized once from a real bound (`requests.len()`), so the
//   Vec never reallocates while pushing on the hot path.
// - Routes are returned as `&str` views borrowed out of the input slice; no
//   route string is ever cloned or copied onto the heap. The returned views
//   are tied by lifetime `'a` to the input, so they live exactly as long as
//   the slice they came from.
fn hot_routes<'a>(requests: &'a [Request<'a>], min_bytes: usize) -> Vec<&'a str> {
    let mut out = Vec::with_capacity(requests.len());

    for request in requests {
        if request.bytes >= min_bytes {
            out.push(request.route);
        }
    }

    out
}

fn main() {
    let requests = [
        Request {
            route: "/health",
            bytes: 128,
        },
        Request {
            route: "/search",
            bytes: 900,
        },
        Request {
            route: "/checkout",
            bytes: 512,
        },
        Request {
            route: "/metrics",
            bytes: 64,
        },
    ];

    let hot = hot_routes(&requests, 512);

    println!("hot = {}", hot.len());
    println!("first = {}", hot.first().copied().unwrap_or("none"));
    println!("capacity ok = {}", hot.capacity() >= requests.len());
}
