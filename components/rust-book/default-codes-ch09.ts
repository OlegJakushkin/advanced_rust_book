export const DEFAULT_CODES_CH09: Record<string, string> = {
  smart_pointers_tree: `use std::cell::RefCell;
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
}`,
  smart_pointers_pin_poll: `use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll, Wake, Waker};

struct Countdown {
    remaining: u8,
}

impl Future for Countdown {
    type Output = &'static str;

    fn poll(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Self::Output> {
        let this = self.get_mut();

        if this.remaining == 0 {
            Poll::Ready("done")
        } else {
            this.remaining -= 1;
            Poll::Pending
        }
    }
}

struct NoopWake;

impl Wake for NoopWake {
    fn wake(self: Arc<Self>) {}
}

fn main() {
    let waker = Waker::from(Arc::new(NoopWake));
    let mut cx = Context::from_waker(&waker);
    let mut task = Box::pin(Countdown { remaining: 2 });

    loop {
        match Future::poll(task.as_mut(), &mut cx) {
            Poll::Ready(value) => {
                println!("ready = {}", value);
                break;
            }
            Poll::Pending => {
                println!("pending = {}", task.as_ref().get_ref().remaining);
            }
        }
    }
}`,
}
