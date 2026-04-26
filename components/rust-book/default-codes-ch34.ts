export const DEFAULT_CODES_CH34: Record<string, string> = {
  memory_profiling_clone_pressure_counter: `#[derive(Debug, Default)]
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
}`,
  memory_profiling_rc_cycle_leak: `use std::cell::RefCell;
use std::rc::{Rc, Weak};

#[derive(Debug)]
struct BadNode {
    name: &'static str,
    parent: RefCell<Option<Rc<BadNode>>>,
    children: RefCell<Vec<Rc<BadNode>>>,
}

#[derive(Debug)]
struct GoodNode {
    name: &'static str,
    parent: RefCell<Weak<GoodNode>>,
    children: RefCell<Vec<Rc<GoodNode>>>,
}

fn main() {
    let bad_root = Rc::new(BadNode {
        name: "root",
        parent: RefCell::new(None),
        children: RefCell::new(Vec::new()),
    });
    let bad_leaf = Rc::new(BadNode {
        name: "leaf",
        parent: RefCell::new(None),
        children: RefCell::new(Vec::new()),
    });

    bad_root.children.borrow_mut().push(Rc::clone(&bad_leaf));
    *bad_leaf.parent.borrow_mut() = Some(Rc::clone(&bad_root));

    let good_root = Rc::new(GoodNode {
        name: "root",
        parent: RefCell::new(Weak::new()),
        children: RefCell::new(Vec::new()),
    });
    let good_leaf = Rc::new(GoodNode {
        name: "leaf",
        parent: RefCell::new(Weak::new()),
        children: RefCell::new(Vec::new()),
    });

    good_root.children.borrow_mut().push(Rc::clone(&good_leaf));
    *good_leaf.parent.borrow_mut() = Rc::downgrade(&good_root);

    println!("bad strong = {}", Rc::strong_count(&bad_root));
    println!("good strong = {}", Rc::strong_count(&good_root));
    println!(
        "good parent = {}",
        good_leaf
            .parent
            .borrow()
            .upgrade()
            .map(|node| node.name)
            .unwrap_or("none")
    );
}`,
}
