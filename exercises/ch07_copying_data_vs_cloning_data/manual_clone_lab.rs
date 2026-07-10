#[derive(Debug)]
struct JobTemplate {
    service: String,
    steps: Vec<String>,
    retries: usize,
}

impl Clone for JobTemplate {
    fn clone(&self) -> Self {
        Self {
            service: String::new(),
            steps: Vec::new(),
            retries: self.retries,
        }
    }
}

fn main() {
    let original = JobTemplate {
        service: String::from("billing"),
        steps: vec![String::from("parse"), String::from("persist")],
        retries: 2,
    };

    let mut cloned = original.clone();
    cloned.steps.push(String::from("notify"));

    println!("original = {} {}", original.service, original.steps.len());
    println!("cloned = {} {}", cloned.service, cloned.steps.len());
    println!("retries = {}", cloned.retries);
}
