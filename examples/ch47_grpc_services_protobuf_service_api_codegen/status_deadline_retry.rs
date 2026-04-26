#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum GrpcCode {
    InvalidArgument,
    DeadlineExceeded,
    Unavailable,
    Cancelled,
}

#[derive(Debug, Clone, Copy)]
struct GrpcStatus {
    code: GrpcCode,
    message: &'static str,
}

#[derive(Debug, Clone, Copy)]
struct RetryDecision {
    retry: bool,
    reason: &'static str,
}

fn classify(status: GrpcStatus, idempotent: bool) -> RetryDecision {
    match status.code {
        GrpcCode::Unavailable | GrpcCode::DeadlineExceeded if idempotent => RetryDecision {
            retry: true,
            reason: "transient",
        },
        GrpcCode::Cancelled => RetryDecision {
            retry: false,
            reason: "caller_cancelled",
        },
        _ => RetryDecision {
            retry: false,
            reason: "do_not_retry",
        },
    }
}

fn should_abort(deadline_ms: u64, elapsed_ms: u64, cancelled: bool) -> bool {
    cancelled || elapsed_ms >= deadline_ms
}

fn main() {
    let unavailable = GrpcStatus {
        code: GrpcCode::Unavailable,
        message: "peer restarting",
    };
    let invalid = GrpcStatus {
        code: GrpcCode::InvalidArgument,
        message: "line_totals must not be empty",
    };

    let retry_unavailable = classify(unavailable, true);
    let retry_invalid = classify(invalid, true);

    println!("retry unavailable = {}", retry_unavailable.retry);
    println!("retry invalid = {}", retry_invalid.retry);
    println!("cancelled = {}", should_abort(150, 120, true));
}
