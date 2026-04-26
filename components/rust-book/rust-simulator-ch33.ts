type RequestItem = {
  route: string
  bytes: number
}

function parseRequests(code: string): RequestItem[] {
  return Array.from(
    code.matchAll(/Request\s*{\s*route:\s*"([^"]+)"\s*,\s*bytes:\s*(\d+)\s*,?\s*}/g),
    (match) => ({
      route: match[1],
      bytes: Number(match[2]),
    })
  )
}

function parseNumbers(source?: string): number[] {
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

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

export function simulateCh33Output(code: string, key?: string): string | null {
  if (key === "performance_allocation_borrowed_filter" || key === "ch33_ex_hot_routes") {
    const requests = parseRequests(code)
    const minBytes = Number(code.match(/hot_routes\(\s*&requests\s*,\s*(\d+)\s*\)/)?.[1] ?? "512")
    const usesInclusive = /request\.bytes\s*>=\s*min_bytes/.test(code)
    const usesCapacity = /Vec::with_capacity\(\s*requests\.len\(\)\s*\)/.test(code)

    const hot = requests.filter((request) =>
      usesInclusive ? request.bytes >= minBytes : request.bytes > minBytes
    )

    return `hot = ${hot.length}\nfirst = ${hot[0]?.route ?? "none"}\ncapacity ok = ${usesCapacity}`
  }

  if (key === "performance_row_major_scan") {
    const cols = Number(code.match(/cols:\s*(\d+)/)?.[1] ?? "4")
    const data = parseNumbers(code.match(/data:\s*vec!\[([^\]]+)\]/)?.[1])

    const usesRowMajorChunks = /\.chunks\(\s*self\.cols\s*\)/.test(code)
    const hasTotal = /self\.data\.iter\(\)\.copied\(\)\.sum/.test(code)

    if (!usesRowMajorChunks || !hasTotal || cols === 0) {
      return "row0 = 0\nrow1 = 0\ntotal = 0"
    }

    const row0 = sum(data.slice(0, cols))
    const row1 = sum(data.slice(cols, cols * 2))
    const total = sum(data)

    return `row0 = ${row0}\nrow1 = ${row1}\ntotal = ${total}`
  }

  return null
}
