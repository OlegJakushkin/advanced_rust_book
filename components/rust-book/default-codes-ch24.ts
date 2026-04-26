export const DEFAULT_CODES_CH24: Record<string, string> = {
  async_rust_async_fn_await_block_on: `use std::future::Future;
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
}`,
  async_rust_manual_future_state_machine: `use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll, Wake, Waker};

#[derive(Debug, Clone, Copy)]
enum Stage {
    Start,
    Waiting,
    Done,
}

struct Handshake {
    stage: Stage,
    remaining_polls: u8,
}

impl Future for Handshake {
    type Output = &'static str;

    fn poll(mut self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Self::Output> {
        match self.stage {
            Stage::Start => {
                self.stage = Stage::Waiting;
                Poll::Pending
            }
            Stage::Waiting if self.remaining_polls > 0 => {
                self.remaining_polls -= 1;
                Poll::Pending
            }
            Stage::Waiting => {
                self.stage = Stage::Done;
                Poll::Ready("connected")
            }
            Stage::Done => Poll::Ready("connected"),
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
    let mut future = Box::pin(Handshake {
        stage: Stage::Start,
        remaining_polls: 1,
    });

    loop {
        match future.as_mut().poll(&mut cx) {
            Poll::Pending => {
                println!("pending stage = {:?}", future.as_ref().get_ref().stage);
                println!("pending retries = {}", future.as_ref().get_ref().remaining_polls);
            }
            Poll::Ready(value) => {
                println!("ready = {}", value);
                break;
            }
        }
    }
}`,
}
