struct FileHandle {
    name: String,
}

impl Drop for FileHandle {
    fn drop(&mut self) {
        println!("drop {}", self.name);
    }
}

fn ship(handle: FileHandle) {
    println!("shipping {}", handle.name);
}

fn main() {
    let handle = FileHandle {
        name: String::from("audit.log"),
    };

    println!("before move");
    ship(handle);
    println!("after ship");
}
