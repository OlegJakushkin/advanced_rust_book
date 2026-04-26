use std::ops::Range;

#[derive(Debug, Clone, Copy)]
struct SegmentId(usize);

struct ParsedCommand {
    raw: String,
    segments: Vec<Range<usize>>,
}

impl ParsedCommand {
    fn new(raw: &str) -> Self {
        let raw = raw.to_string();
        let mut search_from = 0usize;
        let mut segments = Vec::new();

        for segment in raw.split_whitespace() {
            let start = raw[search_from..]
                .find(segment)
                .map(|offset| search_from + offset)
                .expect("segment must exist in raw buffer");
            let end = start + segment.len();
            segments.push(start..end);
            search_from = end;
        }

        Self { raw, segments }
    }

    fn segment(&self, id: SegmentId) -> &str {
        let range = &self.segments[id.0];
        &self.raw[range.clone()]
    }
}

fn main() {
    let command = ParsedCommand::new("deploy api blue");
    println!("segment = {}", command.segment(SegmentId(1)));
}
