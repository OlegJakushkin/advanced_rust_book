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

export function simulateCh29Output(code: string, key?: string): string | null {
  if (key === "wasm_bindgen_string_array_boundary") {
    const callMatch = code.match(/build_label\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/)
    const service = callMatch?.[1] ?? "billing"
    const route = callMatch?.[2] ?? "/ready"
    const bytes = parseNumericList(code.match(/sum_bytes\(\s*&\[\s*([^\]]+)\]/)?.[1])

    const usesBindgen = (code.match(/#\s*\[\s*wasm_bindgen\s*\]/g) ?? []).length >= 2
    const sumsBytes = /bytes\.iter\(\)\.map\(\|&\w+\|\s*\w+\s+as\s+u32\)\.sum/.test(code)

    return `label = ${usesBindgen ? `${service}::${route}` : "broken"}\nsum = ${
      usesBindgen && sumsBytes ? bytes.reduce((acc, value) => acc + value, 0) : 0
    }`
  }

  if (key === "wasm_cpp_ffi_boundary") {
    const route = code.match(/let\s+route\s*=\s*"([^"]+)"/)?.[1] ?? "/orders"
    const hasExternC = /unsafe\s+extern\s+"C"\s*{/.test(code) && /pub\s+extern\s+"C"\s+fn\s+cpp_route_score/.test(code)
    const borrowsBytes = /cpp_route_score\(\s*route\.as_ptr\(\)\s*,\s*route\.len\(\)\s*\)/.test(code)
    const computesLenScore = /\(\s*bytes\.len\(\)\s+as\s+u32\s*\)\s*\*\s*10/.test(code)

    return `route = ${route}\nscore = ${
      hasExternC && borrowsBytes && computesLenScore ? route.length * 10 : 0
    }`
  }

  if (key === "ch29_ex_scale_bytes") {
    const input = parseNumericList(code.match(/scale_bytes\(\s*&\[\s*([^\]]+)\]/)?.[1])
    const factor = Number(code.match(/scale_bytes\(\s*&\[[^\]]+\]\s*,\s*(\d+)\s*\)/)?.[1] ?? "0")

    const hasBindgen = /#\s*\[\s*wasm_bindgen\s*\]/.test(code)
    const hasSignature =
      /fn\s+scale_bytes\s*\(\s*input:\s*&\[\s*u8\s*\]\s*,\s*factor:\s*u8\s*\)\s*->\s*Vec<\s*u8\s*>/.test(code)

    const usesIterator =
      /input\.iter\(\)\.map\(\|&\w+\|\s*\w+\s*\*\s*factor\)\.collect/.test(code) ||
      /input\.iter\(\)\.copied\(\)\.map\(\|\w+\|\s*\w+\s*\*\s*factor\)\.collect/.test(code)

    const usesLoop =
      /for\s+&?\w+\s+in\s+input/.test(code) &&
      /push\(\s*\w+\s*\*\s*factor\s*\)/.test(code)

    if (hasBindgen && hasSignature && (usesIterator || usesLoop)) {
      const data = input.map((value) => value * factor)
      return `len = ${data.length}\ndata = [${data.join(", ")}]`
    }

    return "len = 0\ndata = []"
  }

  return null
}
