use std::any::{Any, TypeId};
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
}
