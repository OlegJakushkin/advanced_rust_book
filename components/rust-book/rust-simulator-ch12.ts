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

function matchesAny(code: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(code))
}

function parseDenseSetup(code: string, variableName: string) {
  const fromElem = code.match(
    new RegExp(`${variableName}\\s*=\\s*Matrix::from_elem\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(-?\\d+)`, "s")
  )

  const rows = Number(fromElem?.[1] ?? "0")
  const cols = Number(fromElem?.[2] ?? "0")
  const fill = Number(fromElem?.[3] ?? "0")
  const data = Array.from({ length: rows * cols }, () => fill)

  const setRegex = new RegExp(`${variableName}\\.set\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(-?\\d+)\\s*\\)`, "g")
  for (const match of code.matchAll(setRegex)) {
    const row = Number(match[1])
    const col = Number(match[2])
    const value = Number(match[3])

    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      data[row * cols + col] = value
    }
  }

  return { rows, cols, data }
}

function parseFixedMatrixTrace(code: string): number {
  const fixedMatch = code.match(
    /let\s+fixed\s*=\s*\[\s*\[([\s\S]*?)\]\s*,\s*\[([\s\S]*?)\]\s*\]\s*;/
  )

  if (!fixedMatch) return 0

  const firstRow = parseNumbers(fixedMatch[1])
  const secondRow = parseNumbers(fixedMatch[2])

  return (firstRow[0] ?? 0) + (secondRow[1] ?? 0)
}

export function simulateCh12Output(code: string, key?: string): string | null {
  if (key === "matrices_row_major_dense") {
    const { rows, cols, data } = parseDenseSetup(code, "m")
    const getMatch = code.match(/m\.get\(\s*(\d+)\s*,\s*(\d+)\s*\)/)
    const rowMatch = code.match(/m\.row\(\s*(\d+)\s*\)/)

    const getRow = Number(getMatch?.[1] ?? "0")
    const getCol = Number(getMatch?.[2] ?? "2")
    const rowIndex = Number(rowMatch?.[1] ?? "1")

    const usesRowMajor = matchesAny(code, [
      /row\s*\*\s*self\.cols\s*\+\s*col/,
      /self\.cols\s*\*\s*row\s*\+\s*col/,
    ])
    const usesRowSlice = matchesAny(code, [
      /let\s+start\s*=\s*row\s*\*\s*self\.cols/,
      /let\s+start\s*=\s*self\.cols\s*\*\s*row/,
    ]) && /self\.data\[start\.\.start\s*\+\s*self\.cols\]/.test(code)

    if (usesRowMajor && usesRowSlice) {
      const value = data[getRow * cols + getCol] ?? 0
      const rowValues = data.slice(rowIndex * cols, rowIndex * cols + cols)

      return `last in row0 = ${value}\nrow1 sum = ${sum(rowValues)}`
    }

    const value = data[getRow * cols + getCol] ?? 0
    const wrongStart = rowIndex * Math.max(rows, 1)
    const wrongSlice = data.slice(wrongStart, wrongStart + cols)

    return `last in row0 = ${value}\nrow1 sum = ${sum(wrongSlice)}`
  }

  if (key === "matrices_views_const_generics") {
    const backing = parseNumbers(code.match(/let\s+backing\s*=\s*vec!\[([\s\S]*?)\]\s*;/)?.[1])
    const viewMatch = code.match(
      /let\s+view\s*=\s*MatrixView\s*{[\s\S]*?rows:\s*(\d+)[\s\S]*?cols:\s*(\d+)[\s\S]*?stride:\s*(\d+)[\s\S]*?offset:\s*(\d+)[\s\S]*?}/
    )
    const getMatch = code.match(/view\.get\(\s*(\d+)\s*,\s*(\d+)\s*\)/)

    const rows = Number(viewMatch?.[1] ?? "2")
    const cols = Number(viewMatch?.[2] ?? "2")
    const stride = Number(viewMatch?.[3] ?? "4")
    const offset = Number(viewMatch?.[4] ?? "0")
    const getRow = Number(getMatch?.[1] ?? "1")
    const getCol = Number(getMatch?.[2] ?? "1")

    const hasViewFormula = matchesAny(code, [
      /self\.offset\s*\+\s*row\s*\*\s*self\.stride\s*\+\s*col/,
      /row\s*\*\s*self\.stride\s*\+\s*self\.offset\s*\+\s*col/,
    ])
    const hasConstGenericTrace =
      /fn\s+trace\s*<\s*const\s+N:\s*usize\s*>/.test(code) &&
      /matrix\[\s*i\s*\]\[\s*i\s*\]/.test(code)

    const corner = hasViewFormula && getRow < rows && getCol < cols
      ? backing[offset + getRow * stride + getCol] ?? 0
      : backing[offset + getCol] ?? 0

    const trace = hasConstGenericTrace ? parseFixedMatrixTrace(code) : 0

    return `view corner = ${corner}\nfixed trace = ${trace}`
  }

  if (key === "ch12_ex_row_major_matrix") {
    const { rows, cols, data } = parseDenseSetup(code, "m")

    const hasRowMajor = matchesAny(code, [
      /row\s*\*\s*self\.cols\s*\+\s*col/,
      /self\.cols\s*\*\s*row\s*\+\s*col/,
    ])
    const hasRowSlice = matchesAny(code, [
      /let\s+start\s*=\s*row\s*\*\s*self\.cols/,
      /let\s+start\s*=\s*self\.cols\s*\*\s*row/,
    ]) && /self\.data\[start\.\.start\s*\+\s*self\.cols\]/.test(code)

    if (hasRowMajor && hasRowSlice) {
      const a01 = data[1] ?? 0
      const row1 = data.slice(cols, cols * 2)
      return `a01 = ${a01}\nrow1 sum = ${sum(row1)}\ncells = ${rows * cols}`
    }

    const a01 = data[1] ?? 0
    const wrongStart = rows
    const wrongRow = data.slice(wrongStart, wrongStart + cols)
    return `a01 = ${a01}\nrow1 sum = ${sum(wrongRow)}\ncells = ${rows * cols}`
  }

  return null
}
