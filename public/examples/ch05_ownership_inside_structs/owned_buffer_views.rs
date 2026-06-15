struct LogLine {
    raw: String,
}

impl LogLine {
    fn new(raw: &str) -> Self {
        Self {
            raw: raw.to_string(),
        }
    }

    fn level(&self) -> &str {
        self.raw.split(':').next().unwrap_or("UNKNOWN")
    }

    fn message(&self) -> &str {
        self.raw
            .split_once(':')
            .map(|(_, message)| message.trim())
            .unwrap_or("")
    }
}

fn main() {
    let line = LogLine::new("INFO: user signed in");
    println!("level = {}", line.level());
    println!("message = {}", line.message());
}
