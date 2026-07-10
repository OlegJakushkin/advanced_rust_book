use std::future::Future;
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
}
