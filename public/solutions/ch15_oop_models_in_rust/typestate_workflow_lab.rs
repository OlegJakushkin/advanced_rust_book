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
        // Deriving the slug here is the only way to construct a PublishedPost,
        // so a published value can never carry an empty slug.
        let slug = self.title.to_lowercase().replace(' ', "-");
        PublishedPost {
            title: self.title,
            slug,
        }
    }
}

impl PublishedPost {
    fn title(&self) -> &str {
        &self.title
    }

    fn slug(&self) -> &str {
        &self.slug
    }
}

fn main() {
    let draft = DraftPost::new("Rust OOP");
    let review = draft.request_review();
    let published = review.publish();

    let _ = published.title();
    println!("published = {}", !published.slug().is_empty());
    println!("slug = {}", published.slug());
}
