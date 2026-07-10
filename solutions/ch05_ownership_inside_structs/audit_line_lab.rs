struct AuditLine {
    raw: String,
}

impl AuditLine {
    fn new(raw: &str) -> Self {
        Self {
            // Own the line once, inside the struct.
            raw: raw.to_string(),
        }
    }

    fn level(&self) -> &str {
        // Borrowed view derived from &self: the text before the first colon.
        self.raw.split(':').next().unwrap_or("UNKNOWN")
    }
}

fn main() {
    let line = AuditLine::new("WARN: cache miss");
    println!("level = {}", line.level());
    println!("raw = {}", line.raw);
}
