#[derive(Debug, Clone, Copy)]
enum BuildTarget {
    LinuxGnu,
    LinuxMusl,
    Wasm,
    NativeLib,
}

fn artifact_name(service: &str, target: BuildTarget) -> String {
    match target {
        BuildTarget::LinuxGnu => format!("{}-x86_64-unknown-linux-gnu", service),
        BuildTarget::LinuxMusl => format!("{}-x86_64-unknown-linux-musl", service),
        BuildTarget::Wasm => format!("{}-wasm32-unknown-unknown.wasm", service),
        BuildTarget::NativeLib => format!("lib{}.so", service),
    }
}

fn is_static(target: BuildTarget) -> bool {
    matches!(target, BuildTarget::LinuxMusl)
}

fn main() {
    let service = "payments";

    println!("musl = {}", artifact_name(service, BuildTarget::LinuxMusl));
    println!("wasm = {}", artifact_name(service, BuildTarget::Wasm));
    println!("static = {}", is_static(BuildTarget::LinuxMusl));
}
