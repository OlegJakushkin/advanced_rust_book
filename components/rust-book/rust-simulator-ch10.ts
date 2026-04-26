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

function sliceRange(values: number[], startText?: string, endText?: string): number[] {
  const start = startText === undefined || startText === "" ? 0 : Number(startText)
  const end = endText === undefined || endText === "" ? values.length : Number(endText)
  return values.slice(start, end)
}

export function simulateCh10Output(code: string, key?: string): string | null {
  if (key === "arrays_slices_vectors_slice_api") {
    const fixed = parseNumericList(code.match(/let\s+fixed\s*=\s*\[([^\]]+)\]/)?.[1])
    const dynamic = parseNumericList(code.match(/let\s+dynamic\s*=\s*vec!\[([^\]]+)\]/)?.[1])
    const fixedTake = Number(code.match(/tail_sum\(\s*&fixed\s*,\s*(\d+)\s*\)/)?.[1] ?? "2")
    const dynamicTake = Number(code.match(/tail_sum\(\s*&dynamic\s*,\s*(\d+)\s*\)/)?.[1] ?? "3")

    const fixedTail = sum(fixed.slice(Math.max(fixed.length - fixedTake, 0)))
    const dynamicTail = sum(dynamic.slice(Math.max(dynamic.length - dynamicTake, 0)))

    return `fixed tail = ${fixedTail}\ndynamic tail = ${dynamicTail}`
  }

  if (key === "arrays_slices_vectors_capacity") {
    const ids = parseNumericList(code.match(/let\s+ids\s*=\s*\[([^\]]+)\]/)?.[1])
    const evenScaled = ids.filter((value) => value % 2 === 0).map((value) => value * 10)
    const extendValues = parseNumericList(code.match(/out\.extend\(\[([^\]]+)\]\)/)?.[1])
    const lastValue =
      extendValues.length > 0
        ? extendValues[extendValues.length - 1]
        : evenScaled.length > 0
          ? evenScaled[evenScaled.length - 1]
          : 0
    const preallocatesFromInput = /Vec::with_capacity\(\s*ids\.len\(\)\s*\)/.test(code)

    return `len = ${evenScaled.length}\ncan fit two more = ${preallocatesFromInput}\nlast = ${lastValue}`
  }

  if (key === "ch10_ex_window_sum") {
    const fixed = parseNumericList(code.match(/let\s+fixed\s*=\s*\[([^\]]+)\]/)?.[1])
    const dynamic = parseNumericList(code.match(/let\s+dynamic\s*=\s*vec!\[([^\]]+)\]/)?.[1])

    const fixedRange = code.match(/window_sum\(\s*&fixed\[(\d*)\.\.(\d*)\]\s*\)/)
    const dynamicRange = code.match(/window_sum\(\s*&dynamic\[(\d*)\.\.(\d*)\]\s*\)/)

    const fixedWindow = sliceRange(fixed, fixedRange?.[1], fixedRange?.[2])
    const dynamicWindow = sliceRange(dynamic, dynamicRange?.[1], dynamicRange?.[2])

    const hasSliceSignature =
      /fn\s+window_sum\s*\(\s*values:\s*&\s*\[\s*u32\s*\]\s*\)\s*->\s*u32/.test(code)
    const usesIteratorSum =
      /values\.iter\(\)(?:\.copied\(\))?(?:\.sum::<u32>\(\)|\.sum\(\))/.test(code)
    const usesLoopSum =
      /let\s+mut\s+\w+\s*=\s*0/.test(code) &&
      /for\s+&?\w+\s+in\s+values/.test(code) &&
      /\+=\s*\w+/.test(code)

    if (hasSliceSignature && (usesIteratorSum || usesLoopSum)) {
      return `fixed = ${sum(fixedWindow)}\ndynamic = ${sum(dynamicWindow)}`
    }

    return `fixed = ${fixedWindow[0] ?? 0}\ndynamic = ${dynamicWindow[0] ?? 0}`
  }

  return null
}
