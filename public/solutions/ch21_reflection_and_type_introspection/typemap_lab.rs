use std::any::{Any, TypeId};
use std::collections::HashMap;

#[derive(Default)]
struct TypeMap {
    values: HashMap<TypeId, Box<dyn Any>>,
}

impl TypeMap {
    fn insert<T: 'static>(&mut self, value: T) {
        // Store by concrete type id, erasing the value behind Box<dyn Any>.
        self.values.insert(TypeId::of::<T>(), Box::new(value));
    }

    fn get<T: 'static>(&self) -> Option<&T> {
        // Look up by the same TypeId key, then recover the concrete type.
        self.values.get(&TypeId::of::<T>())?.downcast_ref::<T>()
    }
}

fn main() {
    let mut map = TypeMap::default();
    map.insert::<u16>(8080);
    map.insert::<String>(String::from("billing"));

    println!("port = {}", map.get::<u16>().copied().unwrap_or(0));
    println!("label = {}", map.get::<String>().map(String::as_str).unwrap_or("none"));
    println!("missing bool = {}", map.get::<bool>().is_none());
}
