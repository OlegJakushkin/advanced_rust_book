function parseNumberList(source?: string): number[] {
  if (!source) return []

  return source
    .split(",")
    .map((part) =>
      part
        .trim()
        .replace(/_/g, "")
        .replace(/(?:i|u)(?:8|16|32|64|128|size)$/i, "")
    )
    .filter((part) => part.length > 0)
    .map((part) => Number(part))
    .filter((value) => !Number.isNaN(value))
}

function parseStringField(code: string, field: string, fallback: string): string {
  const patterns = [
    new RegExp(`${field}:\\s*String::from\\("([^"]+)"\\)`),
    new RegExp(`${field}:\\s*"([^"]+)"\\.to_string\\(\\)`),
    new RegExp(`${field}:\\s*"([^"]+)"\\.into\\(\\)`),
  ]

  for (const pattern of patterns) {
    const value = code.match(pattern)?.[1]
    if (value) return value
  }

  return fallback
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

export function simulateCh46Output(code: string, key?: string): string | null {
  if (key === "fastapi_style_handler_service_boundary") {
    const customerId = parseStringField(code, "customer_id", "42")
    const requestId =
      code.match(/create_invoice_handler\(\s*&state\s*,\s*actor\s*,\s*"([^"]+)"/)?.[1] ?? "req-7"
    const lineTotals = parseNumberList(code.match(/line_totals:\s*vec!\[([^\]]+)\]/)?.[1])
    const totalCents = sum(lineTotals)

    const hasServiceBoundary =
      /struct\s+InvoiceService/.test(code) &&
      /fn\s+create_invoice/.test(code) &&
      /CreateInvoiceCommand/.test(code) &&
      /state\s*\.\s*invoices\s*\.\s*create_invoice\(\s*cmd\s*\)/.test(code) &&
      /status:\s*201/.test(code)

    return `status = ${hasServiceBoundary ? 201 : 0}\ninvoice = ${
      hasServiceBoundary ? `inv-${customerId}` : "broken"
    }\ntotal cents = ${hasServiceBoundary ? totalCents : 0}\nrequest id = ${
      hasServiceBoundary ? requestId : "none"
    }`
  }

  if (key === "fastapi_style_openapi_codegen_scaffold") {
    const operationIds = Array.from(code.matchAll(/operation_id:\s*"([^"]+)"/g), (match) => match[1])
    const swaggerPath = code.match(/swagger_ui_path:\s*"([^"]+)"/)?.[1] ?? "disabled"
    const hasDoc = /fn\s+build_doc/.test(code) && /fn\s+generate_code/.test(code)

    return `operations = ${operationIds.length}\nswagger = ${
      hasDoc ? swaggerPath : "disabled"
    }\nclient methods = ${hasDoc ? operationIds.join(",") : "none"}\nserver stubs = ${
      hasDoc ? operationIds.length : 0
    }`
  }

  if (key === "ch46_ex_handler_boundary") {
    const customerId = parseStringField(code, "customer_id", "7")
    const tenant = parseStringField(code, "tenant", "acme")

    const hasCommand = /struct\s+CreateInvoiceCommand/.test(code)
    const mapsRequest =
      /tenant:\s*actor\.tenant(?:\.clone\(\))?/.test(code) &&
      /customer_id:\s*request\.customer_id(?:\.clone\(\))?/.test(code) &&
      /total_cents:\s*request\.total_cents/.test(code)
    const callsService = /service\.create\(\s*cmd\s*\)/.test(code)
    const returnsCreated =
      /Ok\(\s*\(\s*201\s*,\s*created\.id\s*,\s*created\.tenant\s*\)\s*\)/.test(code) ||
      /Ok\(\s*\(\s*201\s*,\s*invoice\.id\s*,\s*invoice\.tenant\s*\)\s*\)/.test(code)

    const success = hasCommand && mapsRequest && callsService && returnsCreated

    return `status = ${success ? 201 : 0}\ninvoice = ${
      success ? `inv-${customerId}` : "broken"
    }\ntenant = ${success ? tenant : "broken"}`
  }

  return null
}
