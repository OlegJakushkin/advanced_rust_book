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

fn into_command(
    request: CreateInvoiceRequest,
    tenant: &str,
) -> Result<CreateInvoiceCommand, &'static str> {
    Err("unfinished")
}

fn main() {
    let request = CreateInvoiceRequest {
        customer_id: String::from("cust-7"),
        line_totals: vec![1_200_u64, 3_000],
    };

    let command = into_command(request, "acme").unwrap();
    let total_cents: u64 = command.line_totals.iter().copied().sum();

    println!("tenant = {}", command.tenant);
    println!("customer = {}", command.customer_id);
    println!("total cents = {}", total_cents);
}
