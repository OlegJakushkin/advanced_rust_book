function parseNumber(code: string, pattern: RegExp, fallback: number): number {
  return Number(code.match(pattern)?.[1] ?? String(fallback))
}

function hasBalancedBlockRange(code: string): boolean {
  const hasRemainder = /remainder\s*=\s*rows\s*%\s*ranks/.test(code)
  const hasBalancedStart =
    /rank\.min\(\s*remainder\s*\)/.test(code) ||
    /std::cmp::min\(\s*rank\s*,\s*remainder\s*\)/.test(code)
  const hasBalancedLen =
    /usize::from\(\s*rank\s*<\s*remainder\s*\)/.test(code) ||
    /if\s+rank\s*<\s*remainder\s*\{\s*1\s*\}\s*else\s*\{\s*0\s*\}/s.test(code)

  return hasRemainder && hasBalancedStart && hasBalancedLen
}

function blockRange(rows: number, ranks: number, rank: number, balanced: boolean) {
  const base = Math.floor(rows / ranks)
  const remainder = rows % ranks

  if (balanced) {
    const start = rank * base + Math.min(rank, remainder)
    const len = base + (rank < remainder ? 1 : 0)
    return { start, end: start + len }
  }

  const start = rank * base
  return { start, end: start + base }
}

function rowCounts(rows: number, ranks: number, balanced: boolean): number[] {
  const counts: number[] = []
  const base = Math.floor(rows / ranks)
  const remainder = rows % ranks

  for (let rank = 0; rank < ranks; rank += 1) {
    counts.push(base + (balanced && rank < remainder ? 1 : 0))
  }

  return counts
}

function displacementsInCells(counts: number[], cols: number): number[] {
  const out: number[] = []
  let offset = 0

  for (const rowsForRank of counts) {
    out.push(offset)
    offset += rowsForRank * cols
  }

  return out
}

function denseSequence(rows: number, cols: number): number[] {
  return Array.from({ length: rows * cols }, (_, index) => index + 1)
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

export function simulateCh32Output(code: string, key?: string): string | null {
  if (key === "mpi_partition_dense_rows") {
    const rows = parseNumber(code, /let\s+rows\s*=\s*(\d+)/, 8)
    const cols = parseNumber(code, /let\s+cols\s*=\s*(\d+)/, 3)
    const ranks = parseNumber(code, /let\s+ranks\s*=\s*(\d+)/, 3)
    const rank = parseNumber(code, /let\s+rank\s*=\s*(\d+)/, 1)

    const balanced = hasBalancedBlockRange(code)
    const part = blockRange(rows, ranks, rank, balanced)
    const matrix = denseSequence(rows, cols)
    const subtotal = sum(matrix.slice(part.start * cols, part.end * cols))

    return `rank = ${rank}\nrows = ${part.start}..${part.end}\nlocal rows = ${
      part.end - part.start
    }\nsubtotal = ${subtotal.toFixed(1)}`
  }

  if (key === "mpi_collective_counts_and_allreduce") {
    const rows = parseNumber(code, /let\s+rows\s*=\s*(\d+)/, 10)
    const cols = parseNumber(code, /let\s+cols\s*=\s*(\d+)/, 4)
    const ranks = parseNumber(code, /let\s+ranks\s*=\s*(\d+)/, 3)
    const rank = parseNumber(code, /let\s+rank\s*=\s*(\d+)/, 1)

    const balanced =
      /row_counts\(/.test(code) &&
      /usize::from\(\s*rank\s*<\s*remainder\s*\)/.test(code)

    const counts = rowCounts(rows, ranks, balanced)
    const displs = displacementsInCells(counts, cols)

    // Each rank sums its own slice of the dense matrix; the allreduce folds
    // those partials into one total. This mirrors local_sums in the snippet.
    const matrix = denseSequence(rows, cols)
    const allreduce = counts.reduce((total, rowsForRank, index) => {
      const start = displs[index]
      const end = start + rowsForRank * cols
      return total + sum(matrix.slice(start, end))
    }, 0)

    return `counts = [${counts.join(", ")}]\ndispls = [${displs.join(", ")}]\nsend cells = ${
      counts[rank] * cols
    }\nallreduce = ${allreduce.toFixed(1)}`
  }

  if (key === "ch32_ex_block_partition") {
    const rows = parseNumber(code, /let\s+rows\s*=\s*(\d+)/, 11)
    const ranks = parseNumber(code, /let\s+ranks\s*=\s*(\d+)/, 4)
    const cols = parseNumber(code, /let\s+cols\s*=\s*(\d+)/, 5)

    const balanced = hasBalancedBlockRange(code)
    const lines: string[] = []

    for (let rank = 0; rank < ranks; rank += 1) {
      const part = blockRange(rows, ranks, rank, balanced)
      lines.push(`rank ${rank} = ${part.start}..${part.end}`)
    }

    const rank2 = blockRange(rows, ranks, 2, balanced)
    lines.push(`cells rank2 = ${(rank2.end - rank2.start) * cols}`)

    return lines.join("\n")
  }

  return null
}
