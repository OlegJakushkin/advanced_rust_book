function parseBoolText(code: string, pattern: RegExp, fallback: boolean): boolean {
  const match = code.match(pattern)?.[1]
  if (match === undefined) return fallback
  return match === "true"
}

export function simulateCh14Output(code: string, key?: string): string | null {
  if (key === "traits_bounds_associated_types") {
    const max = Number(code.match(/FixedLimit\s*{\s*max:\s*(\d+)/)?.[1] ?? "3")
    const attempts = Number(code.match(/evaluate\(\s*&policy\s*,\s*(\d+)\s*\)/)?.[1] ?? "2")
    const label =
      code.match(/impl\s+RetryPolicy\s+for\s+FixedLimit[\s\S]*?fn\s+label\(&self\)\s*->\s*&'static str\s*{\s*"([^"]+)"/)
        ?.[
        1
      ] ?? "fixed-limit"

    const decision = /attempts\s*<=\s*self\.max/.test(code)
      ? attempts <= max
      : /attempts\s*<\s*self\.max/.test(code)
        ? attempts < max
        : /attempts\s*>=\s*self\.max/.test(code)
          ? attempts >= max
          : false

    const shouldLog = parseBoolText(code, /fn\s+should_log\(&self\)\s*->\s*bool\s*{\s*(true|false)\s*}/, true)

    return `${label} => ${decision}\nlog = ${shouldLog}`
  }

  if (key === "traits_dyn_plugin_pipeline") {
    const input = code.match(/run_all\(\s*&plugins\s*,\s*"([^"]+)"\s*\)/)?.[1] ?? "rust"
    const prefix = code.match(/Prefix\s*{\s*value:\s*"([^"]+)"/)?.[1] ?? "svc-"
    const uppercaseName =
      code.match(/impl\s+Plugin\s+for\s+Uppercase[\s\S]*?fn\s+name\(&self\)\s*->\s*&'static str\s*{\s*"([^"]+)"/)?.[1] ??
      "uppercase"
    const prefixName =
      code.match(/impl\s+Plugin\s+for\s+Prefix[\s\S]*?fn\s+name\(&self\)\s*->\s*&'static str\s*{\s*"([^"]+)"/)?.[1] ??
      "prefix"

    const uppercaseOutput = /to_uppercase\(\)/.test(code) ? input.toUpperCase() : input
    const prefixOutput =
      /format!\(\s*"\{\}\{\}"[\s\S]*self\.value[\s\S]*input/.test(code) ||
      (/self\.value/.test(code) && /format!\(/.test(code))
        ? `${prefix}${input}`
        : input

    return `${uppercaseName} => ${uppercaseOutput}\n${prefixName} => ${prefixOutput}`
  }

  if (key === "ch14_ex_plugin_api") {
    const usesDynPluginVector = /Vec<\s*Box<\s*dyn\s+Plugin\s*>\s*>/.test(code)
    const usesUppercase = /to_uppercase\(\)/.test(code)
    const usesSuffix =
      /format!\(\s*"\{\}-done"\s*,\s*input\s*\)/.test(code) ||
      /push_str\(\s*"-done"\s*\)/.test(code) ||
      /"rust-done"/.test(code)

    if (usesDynPluginVector && usesUppercase && usesSuffix) {
      return "uppercase => RUST\nsuffix => rust-done"
    }

    return "uppercase => rust\nsuffix => rust"
  }

  return null
}
