#[derive(Debug)]
enum Document {
    Draft { title: String },
    Review { title: String, reviewer: String },
    Published { title: String, slug: String },
}

impl Document {
    fn request_review(self, reviewer: &str) -> Self {
        match self {
            Document::Draft { title } => Document::Review {
                title,
                reviewer: reviewer.to_string(),
            },
            state => state,
        }
    }

    fn publish(self) -> Self {
        match self {
            Document::Review { title, .. } => {
                let slug = title.to_lowercase().replace(' ', "-");
                Document::Published { title, slug }
            }
            state => state,
        }
    }

    fn state(&self) -> &'static str {
        match self {
            Document::Draft { .. } => "draft",
            Document::Review { .. } => "review",
            Document::Published { .. } => "published",
        }
    }

    fn slug(&self) -> &str {
        match self {
            Document::Published { slug, .. } => slug,
            _ => "none",
        }
    }
}

fn main() {
    let doc = Document::Draft {
        title: String::from("Rust OOP"),
    }
    .request_review("mina")
    .publish();

    println!("state = {}", doc.state());
    println!("slug = {}", doc.slug());
}
