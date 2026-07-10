trait Stage {
    fn name(&self) -> &'static str;
    fn run(&self, input: &str) -> String;

    // Default method: reuse name() and run() so every stage prints the same way.
    fn describe(&self, input: &str) -> String {
        format!("{} => {}", self.name(), self.run(input))
    }
}

struct Trim;
struct Wrap {
    tag: &'static str,
}

impl Stage for Trim {
    fn name(&self) -> &'static str {
        "trim"
    }
    fn run(&self, input: &str) -> String {
        input.trim().to_string()
    }
}

impl Stage for Wrap {
    fn name(&self) -> &'static str {
        "wrap"
    }
    fn run(&self, input: &str) -> String {
        format!("[{}]{}[/{}]", self.tag, input, self.tag)
    }
}

fn run_pipeline(stages: &[Box<dyn Stage>], input: &str) -> Vec<String> {
    stages.iter().map(|s| s.describe(input)).collect()
}

fn main() {
    let stages: Vec<Box<dyn Stage>> = vec![
        Box::new(Trim),
        Box::new(Wrap { tag: "b" }),
    ];

    for line in run_pipeline(&stages, "  hi  ") {
        println!("{}", line);
    }
    println!("stages = {}", stages.len());
}
