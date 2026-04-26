function collectQuotedMatches(code: string, pattern: RegExp): string[] {
  return Array.from(code.matchAll(pattern), (match) => match.slice(1).find(Boolean) ?? "")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

function parseStringNumberMap(code: string, mapName: string): Record<string, number> {
  const entries: Record<string, number> = {}
  const pattern = new RegExp(
    `${mapName}\\.insert\\(\\s*(?:String::from\\("([^"]+)"\\)|"([^"]+)"\\.to_string\\(\\)|"([^"]+)"\\.into\\(\\))\\s*,\\s*(\\d+)\\s*\\)`,
    "g"
  )

  for (const match of code.matchAll(pattern)) {
    const key = match[1] ?? match[2] ?? match[3]
    const value = Number(match[4])
    if (key) {
      entries[key] = value
    }
  }

  return entries
}

export function simulateCh11Output(code: string, key?: string): string | null {
  if (key === "hash_maps_sets_entry_api") {
    const routes = collectQuotedMatches(
      code,
      /record_hit\(\s*&mut\s+\w+\s*,\s*(?:String::from\("([^"]+)"\)|"([^"]+)"\.to_string\(\)|"([^"]+)"\.into\(\))\s*\)/g
    )

    const counts: Record<string, number> = {}
    for (const route of routes) {
      counts[route] = (counts[route] ?? 0) + 1
    }

    const lookupKeys = collectQuotedMatches(code, /counts\.get\("([^"]+)"\)/g)
    const firstKey = lookupKeys[0] ?? "api"
    const secondKey = lookupKeys[1] ?? "billing"

    return `api = ${counts[firstKey] ?? 0}\nbilling = ${counts[secondKey] ?? 0}\nroutes = ${Object.keys(counts).length}`
  }

  if (key === "hash_maps_sets_borrowed_lookup_ordered") {
    const active = new Set(
      collectQuotedMatches(
        code,
        /active\.insert\(\s*(?:String::from\("([^"]+)"\)|"([^"]+)"\.to_string\(\)|"([^"]+)"\.into\(\))\s*\)/g
      )
    )
    const counts = parseStringNumberMap(code, "counts")

    const apiKey = collectQuotedMatches(code, /counts\.get\("([^"]+)"\)/g)[0] ?? "api"
    const workerKey = collectQuotedMatches(code, /active\.contains\("([^"]+)"\)/g)[0] ?? "worker"

    const orderedText = Object.entries(counts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, count]) => `${name}=${count}`)
      .join(",")

    return `api count = ${counts[apiKey] ?? 0}\nhas worker = ${active.has(workerKey)}\nordered = ${orderedText}`
  }

  if (key === "ch11_ex_hash_maps_lab") {
    const usesEntry =
      /\.entry\(\s*\w+\s*\)\s*\.(?:or_insert|or_default)/.test(code) ||
      /\.entry\(\s*route\s*\)\s*\.(?:or_insert|or_default)/.test(code)

    const borrowedLookup = /get\(\s*route\s*\)/.test(code)
    const usesBTreeMap =
      /BTreeMap/.test(code) &&
      (/collect::<\s*BTreeMap/.test(code) || /BTreeMap::new\(\)/.test(code) || /let\s+\w+\s*:\s*BTreeMap/.test(code))

    const apiResult = borrowedLookup ? (usesEntry ? "Some(2)" : "Some(1)") : "None"
    const sorted = usesBTreeMap ? "api=2,billing=1" : "billing=1,api=2"

    return `api = ${apiResult}\nsorted = ${sorted}`
  }

  return null
}
