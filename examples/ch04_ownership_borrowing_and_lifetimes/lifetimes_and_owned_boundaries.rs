fn first_segment(path: &str) -> &str {
    path.split('/').find(|segment| !segment.is_empty()).unwrap_or("root")
}

fn pick_longer<'a>(left: &'a str, right: &'a str) -> &'a str {
    if left.len() >= right.len() { left } else { right }
}

fn make_audit_label(service: &str, key: &str) -> String {
    format!("{}::{}", service, key)
}

fn main() {
    let route = String::from("/api/health");
    let segment = first_segment(&route);
    let longer = pick_longer("job", "request-id");
    let label = make_audit_label("gateway", segment);

    println!("segment = {}", segment);
    println!("longer = {}", longer);
    println!("label = {}", label);
}
