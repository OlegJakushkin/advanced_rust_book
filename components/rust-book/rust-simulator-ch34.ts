function parseQuotedList(source?: string): string[] {
  if (!source) return []
  return Array.from(source.matchAll(/"([^"]+)"/g), (match) => match[1])
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

export function simulateCh34Output(code: string, key?: string): string | null {
  if (key === "memory_profiling_clone_pressure_counter") {
    const routes = parseQuotedList(code.match(/let\s+routes\s*=\s*\[([^\]]+)\]/)?.[1])
    const selectedRoutes = routes.filter((route) => route.startsWith("/api/"))
    const countsClones = /stats\.clones\s*\+=\s*1/.test(code)
    const countsBytes = /stats\.cloned_bytes\s*\+=\s*route\.len\(\)/.test(code)

    const clones = countsClones ? selectedRoutes.length : 0
    const clonedBytes = countsBytes ? sum(selectedRoutes.map((route) => route.length)) : 0

    return `selected = ${selectedRoutes.length}\nclones = ${clones}\ncloned bytes = ${clonedBytes}`
  }

  if (key === "memory_profiling_rc_cycle_leak") {
    const hasBadCycle =
      /Some\(\s*Rc::clone\(&bad_root\)\s*\)/.test(code) ||
      /Some\(\s*Rc::clone\(\s*&bad_root\s*\)\s*\)/.test(code)

    const hasWeakParent =
      /Weak<\s*GoodNode\s*>/.test(code) &&
      /Rc::downgrade\(&good_root\)/.test(code)

    return `bad strong = ${hasBadCycle ? 2 : 1}\ngood strong = ${
      hasWeakParent ? 1 : 2
    }\ngood parent = ${hasWeakParent ? "root" : "none"}`
  }

  if (key === "ch34_ex_clone_pressure") {
    const routes = parseQuotedList(code.match(/let\s+routes\s*=\s*\[([^\]]+)\]/)?.[1])
    const selectedRoutes = routes.filter((route) => route.startsWith("/api/"))
    const hasBorrowedReturn =
      /fn\s+hot_routes\s*<\s*'a\s*>\s*\(\s*routes:\s*&'a\s*\[\s*&'a\s*str\s*\]\s*\)\s*->\s*Vec<\s*&'a\s*str\s*>/.test(
        code
      ) ||
      /fn\s+hot_routes\s*<\s*'a\s*>\s*\(\s*routes:\s*&'a\s*\[\s*&'a\s*str\s*\]\s*\)\s*->\s*Vec<&'a str>/.test(
        code
      )

    const pushesBorrowed = /out\.push\(\s*route\s*\)/.test(code)
    const avoidsClone = !/track_clone\(\s*route\s*\)/.test(code) && !/to_string\(\)/.test(code)

    const cloneCount = hasBorrowedReturn && pushesBorrowed && avoidsClone ? 0 : selectedRoutes.length

    return `selected = ${selectedRoutes.length}\nclones = ${cloneCount}`
  }

  return null
}
