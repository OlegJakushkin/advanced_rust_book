function parseStringField(code: string, field: string, fallback: string): string {
  const patterns = [
    new RegExp(`${field}:\\s*"([^"]+)"`),
    new RegExp(`${field}:\\s*String::from\\("([^"]+)"\\)`),
  ]

  for (const pattern of patterns) {
    const value = code.match(pattern)?.[1]
    if (value) return value
  }

  return fallback
}

function parseBoolField(code: string, field: string, fallback: boolean): boolean {
  const raw = code.match(new RegExp(`${field}:\\s*(true|false)`))?.[1]
  if (raw === undefined) return fallback
  return raw === "true"
}

function parseNumberField(code: string, field: string, fallback: number): number {
  const raw = code.match(new RegExp(`${field}:\\s*([\\d_]+)`))?.[1]
  if (!raw) return fallback
  const parsed = Number(raw.replace(/_/g, ""))
  return Number.isNaN(parsed) ? fallback : parsed
}

export function simulateCh49Output(code: string, key?: string): string | null {
  if (key === "https_tls_topology_policy") {
    const external = code.match(/external_tls:\s*TlsTermination::(\w+)/)?.[1] ?? "LoadBalancer"
    const internal = code.match(/internal_peer_auth:\s*PeerAuth::(\w+)/)?.[1] ?? "Mtls"
    const trustedProxyHops = parseNumberField(code, "trusted_proxy_hops", 1)
    const alpn = parseStringField(code, "app_protocol", "h2")

    const externalText =
      external === "LoadBalancer"
        ? "load-balancer"
        : external === "ReverseProxy"
          ? "reverse-proxy"
          : "in-process"

    const internalText = internal === "Mtls" ? "mtls" : "tls-only"
    const forwardedProto = trustedProxyHops > 0 ? "trusted-proxy-only" : "ignore-forwarded-proto"

    return `external = ${externalText}\ninternal = ${internalText}\nforwarded proto = ${forwardedProto}\nalpn = ${alpn}`
  }

  if (key === "https_tls_security_defaults") {
    const cookieName = parseStringField(code, "name", "__Host-session")
    const secure = parseBoolField(code, "secure", true)
    const httpOnly = parseBoolField(code, "http_only", true)
    const sameSite = parseStringField(code, "same_site", "Lax")
    const hstsMaxAge = parseNumberField(code, "hsts_max_age_secs", 63_072_000)
    const allowedOrigin = parseStringField(code, "allowed_origin", "https://app.example.com")
    const renewBeforeDays = parseNumberField(code, "renew_before_days", 14)
    const daysLeft =
      Number(code.match(/rotate_now\(\s*([\d_]+)\s*\)/)?.[1]?.replace(/_/g, "") ?? "21") || 21

    const hardenedCookie = secure && httpOnly && sameSite !== "None"
    const corsMode = allowedOrigin === "*" ? "wildcard" : "locked-down"
    const hsts = hstsMaxAge > 0
    const rotateNow = daysLeft <= renewBeforeDays

    return `cookie = ${cookieName}\ncookie hardened = ${hardenedCookie}\ncors = ${corsMode}\nhsts = ${hsts}\nrotate now = ${rotateNow}`
  }

  if (key === "ch49_ex_harden_api_defaults") {
    const secure = parseBoolField(code, "secure", false)
    const httpOnly = parseBoolField(code, "http_only", false)
    const sameSite = parseStringField(code, "same_site", "None")
    const redirectHttp = parseBoolField(code, "redirect_http", false)
    const hstsMaxAge = parseNumberField(code, "hsts_max_age_secs", 0)
    const allowedOrigin = parseStringField(code, "allowed_origin", "*")

    const hardenedCookie = secure && httpOnly && sameSite !== "None"
    const corsMode = allowedOrigin === "*" ? "wildcard" : "locked-down"
    const hsts = redirectHttp && hstsMaxAge > 0

    return `redirect = ${redirectHttp}\ncookie hardened = ${hardenedCookie}\ncors = ${corsMode}\nhsts = ${hsts}`
  }

  return null
}
