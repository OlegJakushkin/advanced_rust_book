fn normalize_service_name(input: &str) -> String {
    input
        .trim()
        .to_ascii_lowercase()
        .replace(' ', "-")
}

fn main() {
    println!("{}", normalize_service_name(" Billing API "));
}

#[cfg(test)]
mod tests {
    use super::normalize_service_name;

    #[test]
    fn normalizes_spaces_and_case() {
        assert_eq!(normalize_service_name(" Billing API "), "billing-api");
    }
}
