export const DEFAULT_CODES_CH14: Record<string, string> = {
  traits_bounds_associated_types: `trait RetryPolicy {
    type Decision;

    fn decide(&self, attempts: u32) -> Self::Decision;

    fn label(&self) -> &'static str {
        "policy"
    }

    fn should_log(&self) -> bool {
        true
    }
}

struct FixedLimit {
    max: u32,
}

impl RetryPolicy for FixedLimit {
    type Decision = bool;

    fn decide(&self, attempts: u32) -> Self::Decision {
        attempts < self.max
    }

    fn label(&self) -> &'static str {
        "fixed-limit"
    }
}

fn evaluate<P>(policy: &P, attempts: u32) -> String
where
    P: RetryPolicy<Decision = bool>,
{
    format!("{} => {}", policy.label(), policy.decide(attempts))
}

fn main() {
    let policy = FixedLimit { max: 3 };

    println!("{}", evaluate(&policy, 2));
    println!("log = {}", policy.should_log());
}`,
  traits_dyn_plugin_pipeline: `trait Plugin {
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
}`,
}
