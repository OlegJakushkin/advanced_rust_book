#[derive(Debug, Clone, Copy)]
enum Target {
    Native,
    Container,
    Wasm,
}

fn artifact_name(app: &str, version: &str, target: Target) -> String {
    let _ = version;
    let _ = target;
    app.to_string()
}

fn main() {
    let app = "pricing";
    let version = "1.2.0";

    println!("native = {}", artifact_name(app, version, Target::Native));
    println!("container = {}", artifact_name(app, version, Target::Container));
    println!("wasm = {}", artifact_name(app, version, Target::Wasm));
}
