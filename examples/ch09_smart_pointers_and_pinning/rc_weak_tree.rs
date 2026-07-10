use std::cell::RefCell;
use std::rc::{Rc, Weak};

#[derive(Debug)]
struct Node {
    name: String,
    parent: RefCell<Weak<Node>>,
    children: RefCell<Vec<Rc<Node>>>,
}

fn main() {
    let root = Rc::new(Node {
        name: String::from("root"),
        parent: RefCell::new(Weak::new()),
        children: RefCell::new(Vec::new()),
    });

    let leaf = Rc::new(Node {
        name: String::from("leaf"),
        parent: RefCell::new(Weak::new()),
        children: RefCell::new(Vec::new()),
    });

    root.children.borrow_mut().push(Rc::clone(&leaf));
    *leaf.parent.borrow_mut() = Rc::downgrade(&root);

    let parent_name = leaf
        .parent
        .borrow()
        .upgrade()
        .map(|node| node.name.clone())
        .unwrap_or_else(|| String::from("none"));

    println!("root children = {}", root.children.borrow().len());
    println!("leaf parent = {}", parent_name);
    println!("root strong = {}", Rc::strong_count(&root));
}
