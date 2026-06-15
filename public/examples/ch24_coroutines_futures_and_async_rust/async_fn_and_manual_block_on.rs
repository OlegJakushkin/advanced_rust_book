use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll, Wake, Waker};

struct YieldOnce {
    value: &'static str,
    yielded: bool,
}

impl YieldOnce {
    fn new(value: &'static str) -> Self {
        Self {
            value,
            yielded: false,
        }
    }
}

impl Future for YieldOnce {
    type Output = &'static str;

    fn poll(mut self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Self::Output> {
        if self.yielded {
            Poll::Ready(self.value)
        } else {
            self.yielded = true;
            Poll::Pending
        }
    }
}

async fn build_label(service: &'static str, route: &'static str) -> String {
    let left = YieldOnce::new(service).await;
    let right = YieldOnce::new(route).await;
    format!("{}:{}", left, right)
}

struct NoopWake;

impl Wake for NoopWake {
    fn wake(self: Arc<Self>) {}
}

fn block_on<F: Future>(future: F) -> F::Output {
    let waker = Waker::from(Arc::new(NoopWake));
    let mut cx = Context::from_waker(&waker);
    let mut future = Box::pin(future);

    loop {
        match future.as_mut().poll(&mut cx) {
            Poll::Ready(value) => return value,
            Poll::Pending => println!("poll = pending"),
        }
    }
}

fn main() {
    let label = block_on(build_label("billing", "/ready"));
    println!("label = {}", label);
}
