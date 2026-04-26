function parseNumericList(source?: string): number[] {
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

function toHexPair(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, "0")
}

function hasManualSum(code: string): boolean {
  return (
    /let\s+mut\s+\w+\s*=\s*0/.test(code) &&
    (/for\s+&?\w+\s+in\s+&self\.ids/.test(code) ||
      /for\s+&?\w+\s+in\s+self\.ids\.iter\(\)/.test(code) ||
      /for\s+\w+\s+in\s+self\.ids/.test(code)) &&
    /\+=\s*\*?\w+/.test(code)
  )
}

export function simulateCh18Output(code: string, key?: string): string | null {
  if (key === "generics_batch_bounds") {
    const ids = Array.from(code.matchAll(/Job\s*{\s*id:\s*(\d+)/gs), (match) => Number(match[1]))
    const len = ids.length
    const firstKey = ids[0] ?? 0

    return `len = ${len}\nfirst key = ${firstKey}`
  }

  if (key === "generics_associated_types_const") {
    const encodedInput = parseNumericList(code.match(/encode\(\s*&\[\s*([^\]]+)\]/)?.[1])[0] ?? 31
    const items = parseNumericList(code.match(/items:\s*\[([^\]]+)\]/)?.[1])
    const sum = items.reduce((total, value) => total + value, 0)
    const last = items[items.length - 1] ?? 0

    return `hex = ${toHexPair(encodedInput)}\nsum = ${sum}\nlast = ${last}`
  }

  if (key === "ch18_ex_fixed_batch") {
    const ids = parseNumericList(code.match(/ids:\s*\[([^\]]+)\]/)?.[1])
    const hasLen =
      /fn\s+len\s*\(\s*&self\s*\)\s*->\s*usize[\s\S]*?(self\.ids\.len\(\)|N)/.test(code)
    const hasSum =
      /self\.ids\.iter\(\)(?:\.copied\(\))?\.sum(?:::<u32>)?\(\)/.test(code) || hasManualSum(code)

    return `len = ${hasLen ? ids.length : 0}\nsum = ${hasSum ? ids.reduce((total, value) => total + value, 0) : 0}`
  }

  return null
}
