export type RustRuntimeProfile = "base" | "async" | "web" | "wasm" | "cpp"

/** Maps chapter ids (ch01-…, ch02-…) to c2w browser runtime profiles. */
export function runtimeProfileForChapterId(chapterId: string): RustRuntimeProfile {
  const match = chapterId.match(/^ch(\d+)-/)
  if (!match) {
    return "base"
  }

  const chapter = Number.parseInt(match[1], 10)
  if (Number.isNaN(chapter)) {
    return "base"
  }

  if (chapter >= 46 && chapter <= 50) {
    return "web"
  }
  if (chapter === 28) {
    return "cpp"
  }
  if (chapter === 29 || chapter === 44) {
    return "wasm"
  }
  if (
    (chapter >= 22 && chapter <= 27) ||
    chapter === 34 ||
    chapter === 36 ||
    (chapter >= 41 && chapter <= 43) ||
    chapter === 45 ||
    chapter === 48
  ) {
    return "async"
  }

  // ch32 (MPI) uses base + in-browser simulator until an mpi profile ships under 1 GiB.
  return "base"
}

export const RUNTIME_PROFILE_ROWS: Array<{
  profile: RustRuntimeProfile
  chapters: string
  image: string
  notes: string
}> = [
  {
    profile: "base",
    chapters: "01–21, 30–31, 33–40, 51–54",
    image: "amd64-debian-wasi-base",
    notes: "Serde, tracing core, ownership and data-structure homework",
  },
  {
    profile: "async",
    chapters: "22–27, 34, 36, 41–43, 45, 48",
    image: "amd64-debian-wasi-async",
    notes: "Tokio, futures, rayon, crossbeam",
  },
  {
    profile: "web",
    chapters: "46–50",
    image: "amd64-debian-wasi-web",
    notes: "tonic, prost, protobuf-compiler (prebuilt offline)",
  },
  {
    profile: "wasm",
    chapters: "29, 44",
    image: "amd64-debian-wasi-wasm",
    notes: "wasm-bindgen CLI and wasm32-unknown-unknown prebuilds",
  },
  {
    profile: "cpp",
    chapters: "28",
    image: "amd64-debian-wasi-cpp",
    notes: "bindgen, clang, libclang for C ABI homework",
  },
]
