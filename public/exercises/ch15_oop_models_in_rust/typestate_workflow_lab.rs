struct DraftPost {
    title: String,
}

struct ReviewPost {
    title: String,
}

struct PublishedPost {
    title: String,
    slug: String,
}

impl DraftPost {
    fn new(title: &str) -> Self {
        Self {
            title: title.to_string(),
        }
    }

    fn request_review(self) -> ReviewPost {
        ReviewPost { title: self.title }
    }
}

impl ReviewPost {
    fn publish(self) -> PublishedPost {
        PublishedPost {
            title: self.title,
            slug: String::new(),
        }
    }
}

impl PublishedPost {
    fn slug(&self) -> &str {
        &self.slug
    }
}

fn main() {
    let draft = DraftPost::new("Rust OOP");
    let review = draft.request_review();
    let published = review.publish();

    println!("published = {}", !published.slug().is_empty());
    println!("slug = {}", published.slug());
}
