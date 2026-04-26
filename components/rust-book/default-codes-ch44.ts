export const DEFAULT_CODES_CH44: Record<string, string> = {
  packaging_target_matrix: `#[derive(Debug, Clone, Copy)]
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
}`,
  packaging_release_bundle: `#[derive(Debug)]
struct ReleaseBundle {
    profile: &'static str,
    artifacts: Vec<&'static str>,
    features: Vec<&'static str>,
    sbom: bool,
    signature: bool,
}

fn build_bundle(profile: &'static str, metrics: bool, admin: bool) -> ReleaseBundle {
    let mut artifacts = vec!["linux-musl", "container"];
    let mut features = vec!["core"];

    if metrics {
        features.push("metrics");
    }

    if admin {
        artifacts.push("native-lib");
        features.push("admin");
    }

    ReleaseBundle {
        profile,
        artifacts,
        features,
        sbom: true,
        signature: true,
    }
}

fn main() {
    let bundle = build_bundle("release", true, false);

    println!("profile = {}", bundle.profile);
    println!("artifacts = {}", bundle.artifacts.join(","));
    println!("features = {}", bundle.features.join(","));
    println!("signed = {}", bundle.sbom && bundle.signature);
}`,
}
