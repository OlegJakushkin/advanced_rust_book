#[derive(Debug, Clone, Copy)]
enum Target {
    Native,
    Container,
    Wasm,
}

fn artifact_name(app: &str, version: &str, target: Target) -> String {
    match target {
        // Native: the binary name carries the exact target triple so two
        // fleet hosts never disagree about which libc/linkage they got.
        Target::Native => format!("{}-x86_64-unknown-linux-musl", app),
        // Container: a registry-qualified tag, versioned like an image, not
        // like a file. The registry path is the consumer's contract.
        Target::Container => format!("ghcr.io/acme/{}:{}", app, version),
        // Wasm: a .wasm artifact named for its wasm target, never a native
        // binary name. The browser loader, not a libc, is the runtime.
        Target::Wasm => format!("{}-wasm32-unknown-unknown.wasm", app),
    }
}

fn main() {
    let app = "pricing";
    let version = "1.2.0";

    println!("native = {}", artifact_name(app, version, Target::Native));
    println!("container = {}", artifact_name(app, version, Target::Container));
    println!("wasm = {}", artifact_name(app, version, Target::Wasm));
}
