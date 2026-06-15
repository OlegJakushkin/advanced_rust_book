mod config {
    pub struct AppConfig {
        pub service_name: String,
        bind_addr: String,
    }

    impl AppConfig {
        pub fn new(service_name: &str, bind_addr: &str) -> Self {
            Self {
                service_name: service_name.to_string(),
                bind_addr: bind_addr.to_string(),
            }
        }

        pub fn bind_addr(&self) -> &str {
            &self.bind_addr
        }
    }
}

fn main() {
    let config = config::AppConfig::new("api", "127.0.0.1:8080");
    println!("{}@{}", config.service_name, config.bind_addr());
}
