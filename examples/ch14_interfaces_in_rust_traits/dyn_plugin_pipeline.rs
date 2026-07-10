trait Plugin {
    fn name(&self) -> &'static str;
    fn run(&self, input: &str) -> String;
}

struct Uppercase;

struct Prefix {
    value: &'static str,
}

impl Plugin for Uppercase {
    fn name(&self) -> &'static str {
        "uppercase"
    }

    fn run(&self, input: &str) -> String {
        input.to_uppercase()
    }
}

impl Plugin for Prefix {
    fn name(&self) -> &'static str {
        "prefix"
    }

    fn run(&self, input: &str) -> String {
        format!("{}{}", self.value, input)
    }
}

fn run_all(plugins: &[Box<dyn Plugin>], input: &str) -> Vec<String> {
    plugins
        .iter()
        .map(|plugin| format!("{} => {}", plugin.name(), plugin.run(input)))
        .collect()
}

fn main() {
    let plugins: Vec<Box<dyn Plugin>> = vec![
        Box::new(Uppercase),
        Box::new(Prefix { value: "svc-" }),
    ];

    for line in run_all(&plugins, "rust") {
        println!("{}", line);
    }
}
