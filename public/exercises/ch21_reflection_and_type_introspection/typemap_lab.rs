use std::any::{Any, TypeId};
use std::collections::HashMap;

#[derive(Default)]
struct TypeMap {
    values: HashMap<TypeId, Box<dyn Any>>,
}

impl TypeMap {
    fn insert<T: 'static>(&mut self, value: T) {
        // store by concrete type id
    }

    fn get<T: 'static>(&self) -> Option<&T> {
        None
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
