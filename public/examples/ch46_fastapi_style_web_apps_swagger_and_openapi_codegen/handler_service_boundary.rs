#![allow(dead_code)]

#[derive(Debug, Clone)]
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

#[derive(Debug, Clone)]
struct Invoice {
    id: String,
    tenant: String,
    total_cents: u64,
}

#[derive(Debug)]
enum DomainError {
    EmptyInvoice,
    Unauthorized,
}

#[derive(Debug)]
enum ApiError {
    BadRequest(&'static str),
    Forbidden,
}

struct InvoiceService;

impl InvoiceService {
    fn create_invoice(&self, cmd: CreateInvoiceCommand) -> Result<Invoice, DomainError> {
        if cmd.line_totals.is_empty() {
            return Err(DomainError::EmptyInvoice);
        }

        let total_cents: u64 = cmd.line_totals.iter().copied().sum();

        Ok(Invoice {
            id: format!("inv-{}", cmd.customer_id),
            tenant: cmd.tenant,
            total_cents,
        })
    }
}

struct ApiState {
    invoices: InvoiceService,
    service_name: String,
}

#[derive(Debug)]
struct AuthenticatedUser {
    tenant: String,
    can_create: bool,
}

#[derive(Debug)]
struct CreatedInvoiceResponse {
    status: u16,
    request_id: String,
    invoice_id: String,
    tenant: String,
    total_cents: u64,
}

fn create_invoice_handler(
    state: &ApiState,
    actor: AuthenticatedUser,
    request_id: &str,
    body: CreateInvoiceRequest,
) -> Result<CreatedInvoiceResponse, ApiError> {
    if !actor.can_create {
        return Err(ApiError::Forbidden);
    }

    let cmd = CreateInvoiceCommand {
        tenant: actor.tenant,
        customer_id: body.customer_id,
        line_totals: body.line_totals,
    };

    let created = state
        .invoices
        .create_invoice(cmd)
        .map_err(|err| match err {
            DomainError::EmptyInvoice => ApiError::BadRequest("invoice must contain at least one line"),
            DomainError::Unauthorized => ApiError::Forbidden,
        })?;

    Ok(CreatedInvoiceResponse {
        status: 201,
        request_id: request_id.to_string(),
        invoice_id: created.id,
        tenant: created.tenant,
        total_cents: created.total_cents,
    })
}

fn main() {
    let state = ApiState {
        invoices: InvoiceService,
        service_name: String::from("billing-api"),
    };
    let actor = AuthenticatedUser {
        tenant: String::from("acme"),
        can_create: true,
    };
    let request = CreateInvoiceRequest {
        customer_id: String::from("42"),
        line_totals: vec![1_200_u64, 3_000],
    };

    let created = create_invoice_handler(&state, actor, "req-7", request).unwrap();

    println!("status = {}", created.status);
    println!("invoice = {}", created.invoice_id);
    println!("total cents = {}", created.total_cents);
    println!("request id = {}", created.request_id);
}
