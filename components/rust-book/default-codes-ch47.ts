export const DEFAULT_CODES_CH47: Record<string, string> = {
  grpc_transport_to_domain_mapping: `#[derive(Debug, Clone)]
struct CreateInvoiceRequest {
    customer_id: String,
    line_totals: Vec<u64>,
}

#[derive(Debug, Clone)]
struct CreateInvoiceCommand {
    tenant: String,
    customer_id: String,
    line_totals: Vec<u64>,
}

#[derive(Debug)]
enum TransportError {
    MissingCustomer,
    EmptyInvoice,
}

fn into_command(
    request: CreateInvoiceRequest,
    tenant: &str,
) -> Result<CreateInvoiceCommand, TransportError> {
    if request.customer_id.trim().is_empty() {
        return Err(TransportError::MissingCustomer);
    }

    if request.line_totals.is_empty() {
        return Err(TransportError::EmptyInvoice);
    }

    Ok(CreateInvoiceCommand {
        tenant: tenant.to_string(),
        customer_id: request.customer_id,
        line_totals: request.line_totals,
    })
}

struct InvoiceService;

impl InvoiceService {
    fn create(&self, command: &CreateInvoiceCommand) -> String {
        format!("inv-{}", command.customer_id)
    }
}

fn main() {
    let request = CreateInvoiceRequest {
        customer_id: String::from("cust-7"),
        line_totals: vec![1_200_u64, 3_000],
    };

    let command = into_command(request, "acme").unwrap();
    let total_cents: u64 = command.line_totals.iter().copied().sum();
    // This example extends the runnable lab with an InvoiceService step, so it
    // prints a fourth "invoice = ..." line the three-line lab does not.
    let service = InvoiceService;
    let invoice_id = service.create(&command);

    println!("tenant = {}", command.tenant);
    println!("customer = {}", command.customer_id);
    println!("total cents = {}", total_cents);
    println!("invoice = {}", invoice_id);
}`,
  grpc_status_deadline_retry: `#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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
}`,
}
