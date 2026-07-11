type ParsedMatrix = {
  rows: number
  cols: number
  data: number[]
}

function parseNumberList(source?: string): number[] {
  if (!source) return []

  return source
    .split(",")
    .map((part) =>
      part
        .trim()
        .replace(/_/g, "")
        .replace(/(?:f32|f64|i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize)$/i, "")
    )
    .filter((part) => part.length > 0)
    .map((part) => Number(part))
    .filter((value) => !Number.isNaN(value))
}

function parseMatrixFromVec(code: string, variable: string): ParsedMatrix | null {
  const match = code.match(
    new RegExp(
      `let\\s+${variable}\\s*=\\s*Matrix::from_vec\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*vec!\\[([\\s\\S]*?)\\]\\s*,?\\s*\\)`,
      "m"
    )
  )

  if (!match) return null

  return {
    rows: Number(match[1]),
    cols: Number(match[2]),
    data: parseNumberList(match[3]),
  }
}

function multiply(left: ParsedMatrix, right: ParsedMatrix): ParsedMatrix {
  const out = Array.from({ length: left.rows * right.cols }, () => 0)

  for (let i = 0; i < left.rows; i += 1) {
    for (let j = 0; j < right.cols; j += 1) {
      let acc = 0
      for (let k = 0; k < left.cols; k += 1) {
        acc += left.data[i * left.cols + k] * right.data[k * right.cols + j]
      }
      out[i * right.cols + j] = acc
    }
  }

  return {
    rows: left.rows,
    cols: right.cols,
    data: out,
  }
}

function checksum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function hasTiledMatmulLogic(code: string): boolean {
  const hasTileLoops =
    /step_by\(\s*tile\s*\)/.test(code) ||
    (/ii\s*<\s*a\.rows/.test(code) &&
      /kk\s*<\s*a\.cols/.test(code) &&
      /jj\s*<\s*b\.cols/.test(code) &&
      /ii\s*\+=\s*tile/.test(code) &&
      /kk\s*\+=\s*tile/.test(code) &&
      /jj\s*\+=\s*tile/.test(code))

  const hasInlineProduct = /a\.get\(\s*i\s*,\s*k\s*\)\s*\*\s*b\.get\(\s*k\s*,\s*j\s*\)/.test(code)

  // Some tiled implementations hoist `a.get(i, k)` into a local (e.g. `let a_ik = a.get(i, k);`)
  // before multiplying it against `b.get(k, j)` inside the innermost loop.
  const hasExtractedProduct =
    /a\.get\(\s*i\s*,\s*k\s*\)/.test(code) && /\w+\s*\*\s*b\.get\(\s*k\s*,\s*j\s*\)/.test(code)

  const hasMultiplyAccumulate =
    (hasInlineProduct || hasExtractedProduct) &&
    (/out\.set\(\s*i\s*,\s*j/.test(code) || /out\.data\[/.test(code))

  return hasTileLoops && hasMultiplyAccumulate
}

function parseFrontier(code: string): number[] {
  return parseNumberList(code.match(/let\s+frontier\s*=\s*vec!\[([^\]]+)\]/)?.[1])
}

function parseCsrShape(code: string): {
  rows: number
  cols: number
  indptr: number[]
  indices: number[]
  data: number[]
} {
  return {
    rows: Number(code.match(/rows:\s*(\d+)/)?.[1] ?? "0"),
    cols: Number(code.match(/cols:\s*(\d+)/)?.[1] ?? "0"),
    indptr: parseNumberList(code.match(/indptr:\s*vec!\[([^\]]+)\]/)?.[1]),
    indices: parseNumberList(code.match(/indices:\s*vec!\[([^\]]+)\]/)?.[1]),
    data: parseNumberList(code.match(/data:\s*vec!\[([^\]]+)\]/)?.[1]),
  }
}

function hasSparseFrontierLogic(code: string): boolean {
  return (
    /csr\.indptr\[row\]/.test(code) &&
    /csr\.indices\[edge\]/.test(code) &&
    /next\[col\]\s*=\s*1/.test(code)
  )
}

function computeNextFrontier(
  rows: number,
  cols: number,
  indptr: number[],
  indices: number[],
  data: number[],
  frontier: number[]
): number[] {
  const next = Array.from({ length: cols }, () => 0)

  for (let row = 0; row < rows; row += 1) {
    if ((frontier[row] ?? 0) === 0) continue

    const start = indptr[row] ?? 0
    const end = indptr[row + 1] ?? start

    for (let edge = start; edge < end; edge += 1) {
      const col = indices[edge]
      if (col !== undefined && (data[edge] ?? 0) !== 0) {
        next[col] = 1
      }
    }
  }

  return next
}

export function simulateCh40Output(code: string, key?: string): string | null {
  if (key === "matrix_games_tiled_matmul") {
    const left = parseMatrixFromVec(code, "a")
    const right = parseMatrixFromVec(code, "b")

    if (!left || !right || left.cols !== right.rows || !hasTiledMatmulLogic(code)) {
      return "naive == tiled = false\nc[1,2] = 0.00\nchecksum = 0.00"
    }

    const product = multiply(left, right)
    const cell = product.data[1 * product.cols + 2] ?? 0

    return `naive == tiled = true\nc[1,2] = ${cell.toFixed(2)}\nchecksum = ${checksum(
      product.data
    ).toFixed(2)}`
  }

  if (key === "matrix_games_sparse_frontier") {
    const { rows, cols, indptr, indices, data } = parseCsrShape(code)
    const frontier = parseFrontier(code)

    if (rows === 0 || cols === 0 || !hasSparseFrontierLogic(code)) {
      return "nnz = 0\nnext frontier = 0\ndense bytes = 0"
    }

    const next = computeNextFrontier(rows, cols, indptr, indices, data, frontier)

    return `nnz = ${data.length}\nnext frontier = ${next.join(",")}\ndense bytes = ${rows * cols * 4}`
  }

  if (key === "ch40_ex_tiled_matmul") {
    const left = parseMatrixFromVec(code, "a")
    const right = parseMatrixFromVec(code, "b")

    if (!left || !right || left.cols !== right.rows || !hasTiledMatmulLogic(code)) {
      return "equal = false\ncell = 0.00"
    }

    const product = multiply(left, right)
    const cell = product.data[1 * product.cols + 1] ?? 0

    return `equal = true\ncell = ${cell.toFixed(2)}`
  }

  return null
}
