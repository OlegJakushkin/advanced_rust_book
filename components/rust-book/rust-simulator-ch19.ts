function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function parseDecimalToCents(value?: string): number {
  if (!value) return 0

  const match = value.match(/^(-?\d+)\.(\d{2})$/)
  if (match) {
    return Number(match[1]) * 100 + Number(match[2])
  }

  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function readEscapedJsonField(code: string, field: string, fallback: string): string {
  const pattern = new RegExp(`${escapeRegExp(field)}\\\\?":\\\\?"([^"\\\\]+)\\\\?"`)
  return code.match(pattern)?.[1] ?? fallback
}

export function simulateCh19Output(code: string, key?: string): string | null {
  if (key === "serialization_contracts_versioned_event") {
    const schema = Number(code.match(/schema_version:\s*(\d+)/)?.[1] ?? "2")
    const isCreated = /payload:\s*OrderEvent::Created/.test(code)
    const isCancelled = /payload:\s*OrderEvent::Cancelled/.test(code)
    const kind = isCreated ? "created" : isCancelled ? "cancelled" : "unknown"

    const totalCents = Number(
      code.match(/OrderEvent::Created\s*{[\s\S]*?total_cents:\s*(\d+)/)?.[1] ?? "0"
    )

    return `schema = ${schema}\nkind = ${kind}\ntotal cents = ${isCreated ? totalCents : 0}`
  }

  if (key === "serialization_contracts_custom_zero_copy") {
    const requestId = readEscapedJsonField(code, "request_id", "req-7")
    const route = readEscapedJsonField(code, "route", "/checkout")
    const amount = readEscapedJsonField(code, "amount_cents", "12.50")

    return `request = ${requestId}\nroute = ${route}\namount cents = ${parseDecimalToCents(amount)}`
  }

  if (key === "ch19_ex_versioned_event") {
    const schema = Number(code.match(/schema_version:\s*(\d+)/)?.[1] ?? "0")
    const isCreated = /payload:\s*OrderEvent::Created/.test(code)
    const totalCents = Number(
      code.match(/OrderEvent::Created\s*{[\s\S]*?total_cents:\s*(\d+)/)?.[1] ?? "0"
    )
    const hasJsonRoundTrip = /serde_json::to_string/.test(code) && /serde_json::from_str/.test(code)
    const hasTagAttribute = /#\s*\[\s*serde\(\s*tag\s*=\s*"kind"/.test(code)
    const emitsCreated = /"created"/.test(code)

    if (schema === 2 && isCreated && totalCents === 4200 && hasJsonRoundTrip && hasTagAttribute && emitsCreated) {
      return "version = 2\nkind = created\ntotal cents = 4200"
    }

    return `version = ${schema}\nkind = ${isCreated && emitsCreated ? "created" : "unknown"}\ntotal cents = ${
      isCreated ? totalCents : 0
    }`
  }

  return null
}
