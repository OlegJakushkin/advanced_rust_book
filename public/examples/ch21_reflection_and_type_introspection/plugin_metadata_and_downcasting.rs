use std::any::Any;

#[derive(Debug, Clone, Copy)]
struct PluginMetadata {
    name: &'static str,
    kind: &'static str,
    config_format: &'static str,
}

trait Plugin {
    fn metadata(&self) -> PluginMetadata;
    fn run(&self, input: &str) -> String;
    fn as_any(&self) -> &dyn Any;
}

struct JsonFormatter {
    pretty: bool,
}

struct RedactSecrets;

impl Plugin for JsonFormatter {
    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            name: "json",
            kind: "formatter",
            config_format: "json",
        }
    }

    fn run(&self, input: &str) -> String {
        if self.pretty {
            format!("pretty({})", input)
        } else {
            format!("compact({})", input)
        }
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

impl Plugin for RedactSecrets {
    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            name: "redact",
            kind: "filter",
            config_format: "none",
        }
    }

    fn run(&self, input: &str) -> String {
        input.replace("token=", "token=***")
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

fn main() {
    let plugins: Vec<Box<dyn Plugin>> = vec![
        Box::new(JsonFormatter { pretty: true }),
        Box::new(RedactSecrets),
    ];

    let listed = plugins
        .iter()
        .map(|plugin| plugin.metadata().name)
        .collect::<Vec<_>>()
        .join(",");

    let pretty = plugins
        .iter()
        .find_map(|plugin| plugin.as_any().downcast_ref::<JsonFormatter>())
        .map(|json| json.pretty)
        .unwrap_or(false);

    println!("plugins = {}", listed);
    println!("json pretty = {}", pretty);
    println!("first kind = {}", plugins[0].metadata().kind);
}
