use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll, Wake, Waker};

#[derive(Debug, Clone, Copy, PartialEq)]
enum Stage {
    Connect,
    Authenticate,
    Ready,
}

struct Handshake {
    stage: Stage,
    polls: u32,
}

impl Future for Handshake {
    type Output = &'static str;

    fn poll(mut self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Self::Output> {
        self.polls += 1;
        // TODO: advance `self.stage` one step per poll:
        //   Connect      -> Authenticate, return Poll::Pending
        //   Authenticate -> Ready,        return Poll::Pending
        //   Ready        -> return Poll::Ready("session-open")
        // The placeholder below completes immediately and never yields.
        Poll::Ready("not-implemented")
    }
}

struct NoopWake;

impl Wake for NoopWake {
    fn wake(self: Arc<Self>) {}
}

fn block_on<F: Future>(future: F) -> (F::Output, u32) {
    let waker = Waker::from(Arc::new(NoopWake));
    let mut cx = Context::from_waker(&waker);
    let mut future = Box::pin(future);
    let mut pending = 0u32;
    loop {
        match future.as_mut().poll(&mut cx) {
            Poll::Ready(value) => return (value, pending),
            Poll::Pending => {
                pending += 1;
                println!("poll = pending");
            }
        }
    }
}

fn main() {
    let handshake = Handshake {
        stage: Stage::Connect,
        polls: 0,
    };
    let (result, pending_count) = block_on(handshake);
    println!("result = {}", result);
    println!("pending count = {}", pending_count);
}
