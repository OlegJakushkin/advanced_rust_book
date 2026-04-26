function parseStringArg(code: string, pattern: RegExp, fallback: string): string {
  return code.match(pattern)?.[1] ?? fallback
}

function parseBoolArg(code: string, pattern: RegExp, fallback: boolean): boolean {
  const raw = code.match(pattern)?.[1]
  if (raw === undefined) return fallback
  return raw === "true"
}

function hasTargetMatrixLogic(code: string): boolean {
  return (
    /BuildTarget::LinuxMusl/.test(code) &&
    /BuildTarget::Wasm/.test(code) &&
    /x86_64-unknown-linux-musl/.test(code) &&
    /wasm32-unknown-unknown\.wasm/.test(code)
  )
}

function hasStaticLogic(code: string): boolean {
  return (
    /matches!\(\s*target\s*,\s*BuildTarget::LinuxMusl\s*\)/.test(code) ||
    /BuildTarget::LinuxMusl\s*=>\s*true/.test(code)
  )
}

function hasReleaseBundleLogic(code: string): boolean {
  return (
    /vec!\[\s*"linux-musl"\s*,\s*"container"\s*\]/.test(code) &&
    /features\.push\("metrics"\)/.test(code) &&
    /artifacts\.push\("native-lib"\)/.test(code) &&
    /sbom:\s*true/.test(code) &&
    /signature:\s*true/.test(code)
  )
}

export function simulateCh44Output(code: string, key?: string): string | null {
  if (key === "packaging_target_matrix") {
    const service = parseStringArg(code, /let\s+service\s*=\s*"([^"]+)"/, "payments")
    const hasTargets = hasTargetMatrixLogic(code)
    const hasStatic = hasStaticLogic(code)

    return `musl = ${
      hasTargets ? `${service}-x86_64-unknown-linux-musl` : `${service}-linux`
    }\nwasm = ${
      hasTargets ? `${service}-wasm32-unknown-unknown.wasm` : `${service}.wasm`
    }\nstatic = ${hasStatic}`
  }

  if (key === "packaging_release_bundle") {
    const profile = parseStringArg(code, /build_bundle\(\s*"([^"]+)"/, "release")
    const metrics = parseBoolArg(code, /build_bundle\(\s*"[^"]+"\s*,\s*(true|false)\s*,/, true)
    const admin = parseBoolArg(
      code,
      /build_bundle\(\s*"[^"]+"\s*,\s*(?:true|false)\s*,\s*(true|false)\s*\)/,
      false
    )

    const artifacts = ["linux-musl", "container"]
    const features = ["core"]

    if (metrics) {
      features.push("metrics")
    }

    if (admin) {
      artifacts.push("native-lib")
      features.push("admin")
    }

    const signed = hasReleaseBundleLogic(code)

    return `profile = ${profile}\nartifacts = ${artifacts.join(",")}\nfeatures = ${features.join(
      ","
    )}\nsigned = ${signed}`
  }

  if (key === "ch44_ex_packaging_matrix") {
    const app = parseStringArg(code, /let\s+app\s*=\s*"([^"]+)"/, "pricing")
    const version = parseStringArg(code, /let\s+version\s*=\s*"([^"]+)"/, "1.2.0")

    const hasNative =
      /Target::Native/.test(code) && /x86_64-unknown-linux-musl/.test(code)
    const hasContainer =
      /Target::Container/.test(code) &&
      /ghcr\.io\/acme/.test(code) &&
      /format!\(\s*"ghcr\.io\/acme\/\{\}:\{\}"/.test(code)
    const hasWasm =
      /Target::Wasm/.test(code) && /wasm32-unknown-unknown\.wasm/.test(code)

    const ready = hasNative && hasContainer && hasWasm

    return `native = ${
      ready ? `${app}-x86_64-unknown-linux-musl` : "broken"
    }\ncontainer = ${
      ready ? `ghcr.io/acme/${app}:${version}` : "broken"
    }\nwasm = ${
      ready ? `${app}-wasm32-unknown-unknown.wasm` : "broken"
    }`
  }

  return null
}
