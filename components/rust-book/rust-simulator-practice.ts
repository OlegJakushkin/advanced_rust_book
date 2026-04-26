type BackendDecision =
  | { kind: "Ok"; value: string }
  | { kind: "Err"; value: string }

type IfEvaluation =
  | { state: "taken"; decision: BackendDecision | null; consumed: number }
  | { state: "not-taken"; consumed: number }

type MatchStatement = {
  subject: string
  arms: string
  consumed: number
}

function decodeRustStringLiteral(value: string): string {
  return value
    .replace(/\\\\/g, "__BACKSLASH__")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/__BACKSLASH__/g, "\\")
}

function findMatchingBrace(source: string, openBraceIndex: number): number {
  let depth = 0
  let inString = false
  let escaped = false
  let inLineComment = false

  for (let index = openBraceIndex; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false
      }
      continue
    }

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }

      if (char === "\\") {
        escaped = true
        continue
      }

      if (char === '"') {
        inString = false
      }

      continue
    }

    if (char === "/" && next === "/") {
      inLineComment = true
      index += 1
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === "{") {
      depth += 1
      continue
    }

    if (char === "}") {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }

  return -1
}

function findTopLevelChar(source: string, startIndex: number, target: string): number {
  let parenDepth = 0
  let bracketDepth = 0
  let braceDepth = 0
  let inString = false
  let escaped = false
  let inLineComment = false

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false
      }
      continue
    }

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }

      if (char === "\\") {
        escaped = true
        continue
      }

      if (char === '"') {
        inString = false
      }

      continue
    }

    if (char === "/" && next === "/") {
      inLineComment = true
      index += 1
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === target && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      return index
    }

    if (char === "(") {
      parenDepth += 1
    } else if (char === ")") {
      parenDepth = Math.max(parenDepth - 1, 0)
    } else if (char === "[") {
      bracketDepth += 1
    } else if (char === "]") {
      bracketDepth = Math.max(bracketDepth - 1, 0)
    } else if (char === "{") {
      braceDepth += 1
    } else if (char === "}") {
      braceDepth = Math.max(braceDepth - 1, 0)
    }
  }

  return -1
}

function splitTopLevel(source: string, delimiter: string): string[] {
  const parts: string[] = []
  let current = ""
  let parenDepth = 0
  let bracketDepth = 0
  let braceDepth = 0
  let inString = false
  let escaped = false
  let inLineComment = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]

    if (inLineComment) {
      current += char
      if (char === "\n") {
        inLineComment = false
      }
      continue
    }

    if (inString) {
      current += char
      if (escaped) {
        escaped = false
        continue
      }

      if (char === "\\") {
        escaped = true
        continue
      }

      if (char === '"') {
        inString = false
      }

      continue
    }

    if (char === "/" && next === "/") {
      inLineComment = true
      current += char + next
      index += 1
      continue
    }

    if (char === '"') {
      inString = true
      current += char
      continue
    }

    if (char === "(") {
      parenDepth += 1
    } else if (char === ")") {
      parenDepth = Math.max(parenDepth - 1, 0)
    } else if (char === "[") {
      bracketDepth += 1
    } else if (char === "]") {
      bracketDepth = Math.max(bracketDepth - 1, 0)
    } else if (char === "{") {
      braceDepth += 1
    } else if (char === "}") {
      braceDepth = Math.max(braceDepth - 1, 0)
    }

    if (
      char === delimiter &&
      parenDepth === 0 &&
      bracketDepth === 0 &&
      braceDepth === 0
    ) {
      if (current.trim()) {
        parts.push(current.trim())
      }
      current = ""
      continue
    }

    current += char
  }

  if (current.trim()) {
    parts.push(current.trim())
  }

  return parts
}

function extractFunctionBody(code: string, functionName: string): string | null {
  const signature = new RegExp(`\\bfn\\s+${functionName}\\s*\\(`)
  const match = signature.exec(code)
  if (!match) return null

  const openBraceIndex = code.indexOf("{", match.index)
  if (openBraceIndex === -1) return null

  const closeBraceIndex = findMatchingBrace(code, openBraceIndex)
  if (closeBraceIndex === -1) return null

  return code.slice(openBraceIndex + 1, closeBraceIndex)
}

function extractDecision(source: string): BackendDecision | null {
  const match = source.match(/(?:return\s+)?(Ok|Err)\(\s*"((?:[^"\\]|\\.)*)"\s*\)/)
  if (!match) return null

  return {
    kind: match[1] as "Ok" | "Err",
    value: decodeRustStringLiteral(match[2]),
  }
}

function evaluateBooleanExpression(expression: string, s3: boolean, local: boolean): boolean | null {
  const normalized = expression
    .replace(/\bs3\b/g, s3 ? "true" : "false")
    .replace(/\blocal\b/g, local ? "true" : "false")
    .replace(/\^/g, "!==")
    .trim()

  if (!normalized) return null
  if (!/^[\s()!&|=<>truefals]+$/.test(normalized)) return null

  try {
    const evaluator = Function(`"use strict"; return (${normalized});`) as () => unknown
    const result = evaluator()
    return typeof result === "boolean" ? result : null
  } catch {
    return null
  }
}

function parseLeadingIf(source: string): { condition: string; thenBody: string; elseSource: string | null; consumed: number } | null {
  const trimmed = source.trimStart()
  const offset = source.length - trimmed.length
  if (!trimmed.startsWith("if")) return null

  const openBraceIndex = findTopLevelChar(trimmed, 2, "{")
  if (openBraceIndex === -1) return null

  const condition = trimmed.slice(2, openBraceIndex).trim()
  const thenCloseIndex = findMatchingBrace(trimmed, openBraceIndex)
  if (thenCloseIndex === -1) return null

  const thenBody = trimmed.slice(openBraceIndex + 1, thenCloseIndex)
  let consumed = offset + thenCloseIndex + 1
  let elseSource: string | null = null

  const afterThen = trimmed.slice(thenCloseIndex + 1).trimStart()
  if (afterThen.startsWith("else")) {
    const elseBody = afterThen.slice(4).trimStart()
    elseSource = elseBody
    consumed =
      offset +
      thenCloseIndex +
      1 +
      (trimmed.slice(thenCloseIndex + 1).length - afterThen.length) +
      4 +
      (afterThen.length - elseBody.length)
  }

  return {
    condition,
    thenBody,
    elseSource,
    consumed,
  }
}

function evaluateLeadingIf(source: string, s3: boolean, local: boolean): IfEvaluation | null {
  const parsed = parseLeadingIf(source)
  if (!parsed) return null

  const conditionValue = evaluateBooleanExpression(parsed.condition, s3, local)
  if (conditionValue === null) {
    return { state: "taken", decision: null, consumed: parsed.consumed }
  }

  if (conditionValue) {
    return {
      state: "taken",
      decision: evaluateDecisionSource(parsed.thenBody, s3, local),
      consumed: parsed.consumed,
    }
  }

  if (!parsed.elseSource) {
    return {
      state: "not-taken",
      consumed: parsed.consumed,
    }
  }

  const elseTrimmed = parsed.elseSource.trim()
  if (elseTrimmed.startsWith("if")) {
    const nested = evaluateLeadingIf(elseTrimmed, s3, local)
    if (!nested) {
      return { state: "taken", decision: null, consumed: parsed.consumed }
    }

    return {
      state: nested.state,
      decision: "decision" in nested ? nested.decision : null,
      consumed: parsed.consumed,
    }
  }

  if (elseTrimmed.startsWith("{")) {
    const closeBraceIndex = findMatchingBrace(elseTrimmed, 0)
    if (closeBraceIndex === -1) {
      return { state: "taken", decision: null, consumed: parsed.consumed }
    }

    return {
      state: "taken",
      decision: evaluateDecisionSource(elseTrimmed.slice(1, closeBraceIndex), s3, local),
      consumed: parsed.consumed,
    }
  }

  return {
    state: "taken",
    decision: evaluateDecisionSource(elseTrimmed, s3, local),
    consumed: parsed.consumed,
  }
}

function parseLeadingMatch(source: string): MatchStatement | null {
  const trimmed = source.trimStart()
  const offset = source.length - trimmed.length
  if (!trimmed.startsWith("match")) return null

  const openBraceIndex = findTopLevelChar(trimmed, 5, "{")
  if (openBraceIndex === -1) return null

  const closeBraceIndex = findMatchingBrace(trimmed, openBraceIndex)
  if (closeBraceIndex === -1) return null

  return {
    subject: trimmed.slice(5, openBraceIndex).trim(),
    arms: trimmed.slice(openBraceIndex + 1, closeBraceIndex),
    consumed: offset + closeBraceIndex + 1,
  }
}

function matchPattern(pattern: string, order: [string, string], s3: boolean, local: boolean): boolean {
  const trimmed = pattern.trim()
  if (trimmed === "_") return true

  const values: Record<string, boolean> = { s3, local }
  const tupleMatch = trimmed.match(/^\(\s*(true|false|_)\s*,\s*(true|false|_)\s*\)$/)
  if (!tupleMatch) return false

  const first = tupleMatch[1]
  const second = tupleMatch[2]

  const compare = (segment: string, value: boolean) =>
    segment === "_" || (segment === "true" ? value : !value)

  return compare(first, values[order[0]]) && compare(second, values[order[1]])
}

function evaluateLeadingMatch(source: string, s3: boolean, local: boolean): BackendDecision | null {
  const parsed = parseLeadingMatch(source)
  if (!parsed) return null

  const subjectMatch = parsed.subject.match(/^\(\s*(s3|local)\s*,\s*(s3|local)\s*\)$/)
  if (!subjectMatch) return null

  const order = [subjectMatch[1], subjectMatch[2]] as [string, string]
  const arms = splitTopLevel(parsed.arms, ",")

  for (const arm of arms) {
    const arrowIndex = arm.indexOf("=>")
    if (arrowIndex === -1) continue

    const pattern = arm.slice(0, arrowIndex).trim()
    const expression = arm.slice(arrowIndex + 2).trim()

    const patterns = splitTopLevel(pattern, "|")
    const matches = patterns.some((candidate) => matchPattern(candidate, order, s3, local))
    if (!matches) continue

    if (expression.startsWith("{")) {
      const closeBraceIndex = findMatchingBrace(expression, 0)
      if (closeBraceIndex === -1) return null
      return evaluateDecisionSource(expression.slice(1, closeBraceIndex), s3, local)
    }

    return evaluateDecisionSource(expression, s3, local)
  }

  return null
}

function findTopLevelSemicolon(source: string): number {
  return findTopLevelChar(source, 0, ";")
}

function evaluateDecisionSource(source: string, s3: boolean, local: boolean): BackendDecision | null {
  let remaining = source.trim()

  while (remaining.length > 0) {
    if (remaining.startsWith("match")) {
      const decision = evaluateLeadingMatch(remaining, s3, local)
      if (decision) return decision

      const parsedMatch = parseLeadingMatch(remaining)
      if (!parsedMatch) return null
      remaining = remaining.slice(parsedMatch.consumed).trimStart()
      continue
    }

    if (remaining.startsWith("if")) {
      const evaluation = evaluateLeadingIf(remaining, s3, local)
      if (!evaluation) return null

      if (evaluation.state === "taken") {
        return evaluation.decision
      }

      remaining = remaining.slice(evaluation.consumed).trimStart()
      continue
    }

    const directDecision = extractDecision(remaining)
    if (directDecision) return directDecision

    const semicolonIndex = findTopLevelSemicolon(remaining)
    if (semicolonIndex === -1) {
      break
    }

    remaining = remaining.slice(semicolonIndex + 1).trimStart()
  }

  return null
}

function extractSimpleBranchValue(body: string, branchName: "s3" | "local"): string | null {
  const blockMatch = body.match(new RegExp(`if\\s+${branchName}\\b[^{]*\\{([\\s\\S]*?)\\}`))
  if (!blockMatch) return null

  return extractDecision(blockMatch[1])?.value ?? null
}

function inferFallbackDecision(body: string, s3: boolean, local: boolean): BackendDecision {
  const exactOne =
    /s3\s*==\s*local/.test(body) ||
    (/s3\s*&&\s*local/.test(body) && /!s3\s*&&\s*!local/.test(body)) ||
    /match\s*\(\s*s3\s*,\s*local\s*\)/.test(body)

  const s3Value = extractSimpleBranchValue(body, "s3") ?? "s3"
  const localValue = extractSimpleBranchValue(body, "local") ?? "local"
  const errorValue =
    Array.from(body.matchAll(/Err\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g)).at(-1)?.[1]
      ? decodeRustStringLiteral(
          Array.from(body.matchAll(/Err\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g)).at(-1)?.[1] ?? "not configured"
        )
      : "not configured"

  if (exactOne) {
    if (s3 === local) {
      return { kind: "Err", value: errorValue }
    }

    return s3
      ? { kind: "Ok", value: s3Value }
      : { kind: "Ok", value: localValue }
  }

  const firstS3Index = body.indexOf("if s3")
  const firstLocalIndex = body.indexOf("if local")

  if (s3 && local) {
    if (firstLocalIndex !== -1 && (firstS3Index === -1 || firstLocalIndex < firstS3Index)) {
      return { kind: "Ok", value: localValue }
    }

    return { kind: "Ok", value: s3Value }
  }

  if (s3) {
    return { kind: "Ok", value: s3Value }
  }

  if (local) {
    return { kind: "Ok", value: localValue }
  }

  return { kind: "Err", value: errorValue }
}

function formatDecision(decision: BackendDecision): string {
  return `${decision.kind}("${decision.value}")`
}

function renderFormatString(format: string, decision: BackendDecision): string {
  const decodedFormat = decodeRustStringLiteral(format)
  if (/\{[^}]*\}/.test(decodedFormat)) {
    return decodedFormat.replace(/\{[^}]*\}/, formatDecision(decision))
  }

  return `${decodedFormat}${formatDecision(decision)}`
}

function extractSelectedBackendPrints(code: string): Array<{ format: string; s3: boolean; local: boolean }> {
  return Array.from(
    code.matchAll(
      /println!\(\s*"((?:[^"\\]|\\.)*)"\s*,\s*selected_backend\(\s*(true|false)\s*,\s*(true|false)\s*\)\s*\)\s*;/g
    ),
    (match) => ({
      format: match[1],
      s3: match[2] === "true",
      local: match[3] === "true",
    })
  )
}

export function simulatePracticeOutput(code: string, key?: string): string | null {
  if (key !== "ch03_ex_feature_matrix") {
    return null
  }

  const calls = extractSelectedBackendPrints(code)
  if (calls.length === 0) {
    return null
  }

  const functionBody = extractFunctionBody(code, "selected_backend")
  if (!functionBody) {
    return null
  }

  const output = calls.map(({ format, s3, local }) => {
    const decision =
      evaluateDecisionSource(functionBody, s3, local) ??
      inferFallbackDecision(functionBody, s3, local)

    return renderFormatString(format, decision)
  })

  return output.join("\n")
}
