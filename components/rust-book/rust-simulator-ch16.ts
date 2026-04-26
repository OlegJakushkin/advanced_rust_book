function parseOrderLines(code: string): Array<{ qty: number; price: number }> {
  const lines: Array<{ qty: number; price: number }> = []

  for (const match of code.matchAll(
    /add_line\([\s\S]*?Quantity::new\((\d+)\)\.unwrap\(\)\s*,\s*MoneyCents::new\((\d+)\)(?:\.unwrap\(\))?\s*\)/g
  )) {
    lines.push({
      qty: Number(match[1]),
      price: Number(match[2]),
    })
  }

  return lines
}

export function simulateCh16Output(code: string, key?: string): string | null {
  if (key === "ddd_order_aggregate") {
    const lines = parseOrderLines(code)
    const total = lines.reduce((sum, line) => sum + line.qty * line.price, 0)
    const state = /submit\(\)\.(?:unwrap|expect)\(/.test(code) || /submit\(\)\?/.test(code) ? "submitted" : "draft"

    return `lines = ${lines.length}\ntotal cents = ${total}\nstate = ${state}`
  }

  if (key === "ddd_event_sourced_account") {
    let events = 0
    let balance = 0

    for (const match of code.matchAll(
      /(?:AccountEvent::)?(Opened|Deposited|Withdrawn)\s*{\s*(?:opening_balance_cents|cents):\s*(-?\d+)\s*}/g
    )) {
      const kind = match[1]
      const cents = Number(match[2])
      events += 1

      switch (kind) {
        case "Opened":
          balance = cents
          break
        case "Deposited":
          balance += cents
          break
        case "Withdrawn":
          balance -= cents
          break
      }
    }

    return `events = ${events}\nbalance cents = ${balance}\nversion = ${events}`
  }

  if (key === "ch16_ex_order_invariants") {
    const hasQuantityGuard =
      /if\s+value\s*==\s*0/.test(code) &&
      /Err\(\s*"quantity must be greater than 0"\s*\)/.test(code)

    const incrementsLineCount = /self\.line_count\s*\+=\s*1/.test(code)

    const computesTotal =
      /self\.total_cents\s*\+=\s*qty\.get\(\)\s+as\s+u64\s*\*\s*unit_price_cents/.test(code) ||
      /self\.total_cents\s*\+=\s*unit_price_cents\s*\*\s*qty\.get\(\)\s+as\s+u64/.test(code) ||
      /self\.total_cents\s*\+=\s*\(\s*qty\.get\(\)\s+as\s+u64\s*\)\s*\*\s*unit_price_cents/.test(code)

    const zeroText = hasQuantityGuard ? 'Err("quantity must be greater than 0")' : "Ok(Quantity(0))"
    const lines = incrementsLineCount ? 1 : 0
    const total = computesTotal ? 1800 : 0

    return `zero = ${zeroText}\norder = OrderId(7)\nlines = ${lines}\ntotal cents = ${total}`
  }

  return null
}
