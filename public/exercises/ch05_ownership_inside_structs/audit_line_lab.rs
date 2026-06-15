struct AuditLine {
    raw: String,
}

impl AuditLine {
    fn new(raw: &str) -> Self {
        Self {
            raw: String::new(),
        }
    }

    fn level(&self) -> &str {
        "UNKNOWN"
    }
}

fn main() {
    let line = AuditLine::new("WARN: cache miss");
    println!("level = {}", line.level());
    println!("raw = {}", line.raw);
}
