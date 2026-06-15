#![allow(dead_code)]

#[derive(Debug, Clone)]
struct ApiSchema {
    name: &'static str,
    required_fields: &'static [&'static str],
}

#[derive(Debug, Clone)]
struct ApiOperation {
    method: &'static str,
    path: &'static str,
    operation_id: &'static str,
    request: Option<ApiSchema>,
    response: ApiSchema,
    auth: bool,
}

#[derive(Debug)]
struct OpenApiDoc {
    title: &'static str,
    version: &'static str,
    swagger_ui_path: &'static str,
    operations: Vec<ApiOperation>,
}

#[derive(Debug)]
struct CodegenPlan {
    client_methods: Vec<&'static str>,
    server_stubs: usize,
}

fn build_doc() -> OpenApiDoc {
    OpenApiDoc {
        title: "Billing API",
        version: "2026-04",
        swagger_ui_path: "/docs",
        operations: vec![
            ApiOperation {
                method: "POST",
                path: "/v1/invoices",
                operation_id: "create_invoice",
                request: Some(ApiSchema {
                    name: "CreateInvoiceRequest",
                    required_fields: &["customer_id", "line_totals"],
                }),
                response: ApiSchema {
                    name: "CreatedInvoiceResponse",
                    required_fields: &["invoice_id", "total_cents"],
                },
                auth: true,
            },
            ApiOperation {
                method: "GET",
                path: "/v1/invoices/{id}",
                operation_id: "get_invoice",
                request: None,
                response: ApiSchema {
                    name: "InvoiceResponse",
                    required_fields: &["invoice_id", "total_cents"],
                },
                auth: true,
            },
        ],
    }
}

fn generate_code(doc: &OpenApiDoc) -> CodegenPlan {
    let client_methods = doc
        .operations
        .iter()
        .map(|op| op.operation_id)
        .collect::<Vec<_>>();

    CodegenPlan {
        server_stubs: doc.operations.len(),
        client_methods,
    }
}

fn main() {
    let doc = build_doc();
    let plan = generate_code(&doc);

    println!("operations = {}", doc.operations.len());
    println!("swagger = {}", doc.swagger_ui_path);
    println!("client methods = {}", plan.client_methods.join(","));
    println!("server stubs = {}", plan.server_stubs);
}
