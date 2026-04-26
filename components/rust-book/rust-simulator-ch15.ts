function pickFirstMatch(matches: Array<string | undefined>): string | null {
  for (const value of matches) {
    if (value !== undefined && value.length > 0) {
      return value
    }
  }
  return null
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function simulateCh15Output(code: string, key?: string): string | null {
  if (key === "oop_models_composition_traits") {
    const invoiceMatch = code.match(/Invoice::new\(\s*(\d+)\s*,\s*(\d+)\s*\)/)
    const prefix = code.match(/prefix:\s*"([^"]+)"/)?.[1] ?? "queued email for "
    const invoiceId = Number(invoiceMatch?.[1] ?? "41")
    const cents = Number(invoiceMatch?.[2] ?? "1250")
    const sent = /self\.sent\s*\+=\s*1/.test(code) ? 1 : 0

    return `invoice = ${invoiceId} cents = ${cents}\nnotification = ${prefix}${invoiceId}\nsent = ${sent}`
  }

  if (key === "oop_models_enum_state_machine") {
    const title =
      pickFirstMatch([
        code.match(/Document::Draft\s*{\s*title:\s*String::from\("([^"]+)"\)\s*}/)?.[1],
        code.match(/Document::Draft\s*{\s*title:\s*"([^"]+)"\.to_string\(\)\s*}/)?.[1],
        code.match(/Document::Draft\s*{\s*title:\s*"([^"]+)"\.into\(\)\s*}/)?.[1],
      ]) ?? "Rust OOP"

    const publishes =
      /fn\s+publish\s*\(\s*self\s*\)\s*->\s*Self/.test(code) &&
      /Document::Published\s*{\s*title,\s*slug\s*}/.test(code)

    const state = publishes ? "published" : "review"
    const slug = publishes ? slugify(title) : "none"

    return `state = ${state}\nslug = ${slug}`
  }

  if (key === "ch15_ex_typestate_post") {
    const hasReviewTransition = /fn\s+request_review\s*\(\s*self\s*\)\s*->\s*ReviewPost/.test(code)
    const hasPublishTransition = /fn\s+publish\s*\(\s*self\s*\)\s*->\s*PublishedPost/.test(code)
    const hasSlugField = /struct\s+PublishedPost\s*{[\s\S]*slug:\s*String/.test(code)
    const hasSlugMethod = /fn\s+slug\s*\(\s*&self\s*\)\s*->\s*&str/.test(code)
    const buildsSlug =
      /(to_lowercase|to_ascii_lowercase)\(\)\.replace\(\s*' '\s*,\s*"-"\s*\)/.test(code) ||
      /(to_lowercase|to_ascii_lowercase)\(\)\.replace\(\s*" "\s*,\s*"-"\s*\)/.test(code)

    if (hasReviewTransition && hasPublishTransition && hasSlugField && hasSlugMethod && buildsSlug) {
      return "published = true\nslug = rust-oop"
    }

    return "published = false\nslug = "
  }

  return null
}
