use std::cell::RefCell;
use std::rc::{Rc, Weak};

#[derive(Debug)]
struct Node {
    name: String,
    parent: RefCell<Weak<Node>>,
    children: RefCell<Vec<Rc<Node>>>,
}

impl Node {
    fn new(name: &str) -> Rc<Node> {
        Rc::new(Node {
            name: String::from(name),
            parent: RefCell::new(Weak::new()),
            children: RefCell::new(Vec::new()),
        })
    }
}

// Parent owns the child with a strong edge; child observes the parent
// with a weak edge, so the two-node graph stays acyclic.
fn attach(parent: &Rc<Node>, child: &Rc<Node>) {
    parent.children.borrow_mut().push(Rc::clone(child));
    *child.parent.borrow_mut() = Rc::downgrade(parent);
}

fn parent_name(node: &Rc<Node>) -> String {
    node.parent
        .borrow()
        .upgrade()
        .map(|p| p.name.clone())
        .unwrap_or_else(|| String::from("none"))
}

fn main() {
    let root = Node::new("root");
    let leaf = Node::new("leaf");

    attach(&root, &leaf);

    println!("root children = {}", root.children.borrow().len());
    println!("leaf parent = {}", parent_name(&leaf));
    println!("root strong = {}", Rc::strong_count(&root));
    println!("root weak = {}", Rc::weak_count(&root));
    println!("leaf parent (after root drop) = {}", {
        drop(root);
        parent_name(&leaf)
    });
}
