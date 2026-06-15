use std::future::Future;
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
}
