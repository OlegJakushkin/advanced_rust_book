#[derive(Debug)]
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
}
