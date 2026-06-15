export const DEFAULT_CODES_CH21: Record<string, string> = {
  reflection_any_typeid_registry: `use std::any::{Any, TypeId};
use std::collections::HashMap;

#[derive(Debug)]
struct RequestContext {
    trace_id: &'static str,
}

#[derive(Debug)]
struct RetryBudget(u32);

#[derive(Default)]
struct TypeMap {
    values: HashMap<TypeId, Box<dyn Any>>,
}

impl TypeMap {
    fn insert<T: 'static>(&mut self, value: T) {
        self.values.insert(TypeId::of::<T>(), Box::new(value));
    }

    fn get<T: 'static>(&self) -> Option<&T> {
        self.values.get(&TypeId::of::<T>())?.downcast_ref::<T>()
    }

    fn contains<T: 'static>(&self) -> bool {
        self.values.contains_key(&TypeId::of::<T>())
    }
}

fn main() {
    let mut request_scoped = TypeMap::default();
    request_scoped.insert(RequestContext { trace_id: "req-7" });
    request_scoped.insert(RetryBudget(3));

    println!("has context = {}", request_scoped.contains::<RequestContext>());
    println!("retries = {}", request_scoped.get::<RetryBudget>().unwrap().0);
    println!("trace = {}", request_scoped.get::<RequestContext>().unwrap().trace_id);
}`,
  reflection_plugin_metadata_downcast: `use std::any::Any;

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
}`,
  reflection_type_name_labels: `use std::any::type_name;

struct RetryBudget(u32);

fn label_of<T>(_value: &T) -> &'static str {
    // type_name returns a best-effort, human-readable string for diagnostics.
    // The exact text is not guaranteed stable across compiler versions, so it
    // is fine in a log line but must never become a schema or protocol key.
    type_name::<T>()
}

fn main() {
    let budget = RetryBudget(3);
    println!("retries = {}", budget.0);
    println!("type label = {}", label_of(&budget));
    println!("u32 label = {}", label_of(&budget.0));
}`,
}
