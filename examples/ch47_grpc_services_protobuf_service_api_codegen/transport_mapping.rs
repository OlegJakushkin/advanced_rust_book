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
    let service = InvoiceService;
    let invoice_id = service.create(&command);

    println!("tenant = {}", command.tenant);
    println!("customer = {}", command.customer_id);
    println!("total cents = {}", total_cents);
    println!("invoice = {}", invoice_id);
}
