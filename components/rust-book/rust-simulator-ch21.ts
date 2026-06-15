export function simulateCh21Output(code: string, key?: string): string | null {
  if (key === "reflection_any_typeid_registry") {
    const hasTypeMapOps =
      /TypeId::of::<T>\(\)/.test(code) &&
      /downcast_ref::<T>\(\)/.test(code) &&
      /Box::new\(\s*value\s*\)/.test(code)

    const insertsContext = /insert\(\s*RequestContext\s*{/.test(code)
    const traceId = code.match(/trace_id:\s*"([^"]+)"/)?.[1] ?? "req-7"
    const retries = Number(code.match(/RetryBudget\((\d+)\)/)?.[1] ?? "3")

    if (hasTypeMapOps) {
      return `has context = ${insertsContext}\nretries = ${retries}\ntrace = ${insertsContext ? traceId : "none"}`
    }

    return "has context = false\nretries = 0\ntrace = none"
  }

  if (key === "reflection_plugin_metadata_downcast") {
    const names = Array.from(code.matchAll(/name:\s*"([^"]+)"/g), (match) => match[1])
    const firstName = names[0] ?? "json"
    const secondName = names[1] ?? "redact"
    const firstKind = code.match(/kind:\s*"([^"]+)"/)?.[1] ?? "formatter"
    const prettyValue = code.match(/JsonFormatter\s*{\s*pretty:\s*(true|false)\s*}/)?.[1] ?? "true"
    const hasDowncast = /downcast_ref::<\s*JsonFormatter\s*>\(\)/.test(code)

    return `plugins = ${firstName},${secondName}\njson pretty = ${hasDowncast ? prettyValue : "false"}\nfirst kind = ${firstKind}`
  }

  if (key === "reflection_type_name_labels") {
    const retries = Number(code.match(/RetryBudget\((\d+)\)/)?.[1] ?? "3")
    return `retries = ${retries}\ntype label = type_name_labels::RetryBudget\nu32 label = u32`
  }

  if (key === "ch21_ex_typemap_lab") {
    const hasInsert =
      /self\.values\.insert\(\s*TypeId::of::<T>\(\)\s*,\s*Box::new\(\s*value\s*\)\s*\)/.test(code) ||
      (/TypeId::of::<T>\(\)/.test(code) && /Box::new\(\s*value\s*\)/.test(code) && /fn\s+insert<\s*T:\s*'static\s*>/.test(code))

    const hasGet =
      /self\.values\.get\(\s*&TypeId::of::<T>\(\)\s*\)\?\s*\.downcast_ref::<T>\(\)/s.test(code) ||
      (/TypeId::of::<T>\(\)/.test(code) && /downcast_ref::<T>\(\)/.test(code) && /fn\s+get<\s*T:\s*'static\s*>/.test(code))

    if (hasInsert && hasGet) {
      return "port = 8080\nlabel = billing\nmissing bool = true"
    }

    return "port = 0\nlabel = none\nmissing bool = true"
  }

  return null
}
