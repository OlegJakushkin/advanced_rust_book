use std::rc::Rc;
use std::sync::Arc;
use std::thread;

struct ParserConfig {
    delimiter: Box<str>,
}

#[derive(Clone)]
struct UiTemplate {
    name: Rc<str>,
}

#[derive(Clone)]
struct SharedSchema {
    version: Arc<str>,
}

fn main() {
    let parser = ParserConfig {
        delimiter: "=>".into(),
    };
    let template = UiTemplate {
        name: Rc::from("invoice"),
    };
    let template_copy = template.clone();
    let schema = SharedSchema {
        version: Arc::from("v2"),
    };
    let schema_for_worker = schema.clone();

    let handle = thread::spawn(move || {
        format!("thread schema = {}", schema_for_worker.version)
    });

    println!("box delimiter = {}", parser.delimiter);
    println!("rc clones = {}", Rc::strong_count(&template_copy.name));
    println!("{}", handle.join().unwrap());
}
