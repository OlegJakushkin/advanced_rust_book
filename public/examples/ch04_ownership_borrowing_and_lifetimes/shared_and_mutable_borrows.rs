fn request_size(line: &str) -> usize {
    line.len()
}

fn append_trace(line: &mut String, trace_id: &str) {
    line.push_str(" trace=");
    line.push_str(trace_id);
}

fn main() {
    let mut request = String::from("GET /ready");
    let len_before = request_size(&request);
    append_trace(&mut request, "abc-123");

    println!("len before = {}", len_before);
    println!("request = {}", request);
}
