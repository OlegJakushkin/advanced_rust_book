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

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function hasSafeFfiSumWrapper(code: string): boolean {
  const checksOut = /out_total\.is_null\(\)/.test(code)
  const checksInput = /ptr\.is_null\(\)\s*&&\s*len\s*!=\s*0/.test(code)
  const buildsSlice = /from_raw_parts\(\s*ptr\s*,\s*len\s*\)/.test(code)
  const assignsOut =
    /\*\s*out_total\s*=\s*total/.test(code) ||
    /\*\s*out_total\s*=\s*slice/.test(code)
  const computesTotal =
    /\.sum::<i64>\(\)/.test(code) ||
    (/let\s+mut\s+total\s*=\s*0(?:_i64)?/.test(code) &&
      /for\s+&?\w+\s+in\s+slice/.test(code) &&
      /\+=\s*\w+\s+as\s+i64/.test(code))

  return checksOut && checksInput && buildsSlice && assignsOut && computesTotal
}

export function simulateCh28Output(code: string, key?: string): string | null {
  if (key === "cpp_integration_calling_c_abi") {
    const left = Number(code.match(/let\s+left\s*=\s*(-?\d+)/)?.[1] ?? "-7")
    const right = Number(code.match(/let\s+right\s*=\s*(-?\d+)/)?.[1] ?? "11")
    const usesExternC = /extern\s+"C"/.test(code)
    const callsWrapper = /safe_abs\(\s*left\s*\)/.test(code) && /safe_abs\(\s*right\s*\)/.test(code)

    if (usesExternC && callsWrapper) {
      return `abs(${left}) = ${Math.abs(left)}\nabs(${right}) = ${Math.abs(right)}`
    }

    return `abs(${left}) = 0\nabs(${right}) = 0`
  }

  if (key === "cpp_integration_export_rust_c_abi") {
    const values = parseNumericList(code.match(/let\s+values\s*=\s*\[([^\]]+)\]/)?.[1])
    const total = sum(values)
    const wrapperIsSafe = hasSafeFfiSumWrapper(code)

    return `status = ${wrapperIsSafe ? 0 : 1}\ntotal = ${wrapperIsSafe ? total : -1}`
  }

  if (key === "ch28_ex_ffi_sum_wrapper") {
    const values = parseNumericList(code.match(/let\s+values\s*=\s*\[([^\]]+)\]/)?.[1])
    const total = sum(values)
    const wrapperIsSafe = hasSafeFfiSumWrapper(code)

    return `status = ${wrapperIsSafe ? 0 : 1}\ntotal = ${wrapperIsSafe ? total : -1}`
  }

  return null
}
