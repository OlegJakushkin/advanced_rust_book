#[derive(Debug, Clone, PartialEq, Eq)]
struct VersionedValue {
    version: u64,
    author: &'static str,
    value: String,
}

fn pick_newer(local: VersionedValue, remote: VersionedValue) -> VersionedValue {
    if remote.version > local.version {
        remote
    } else if remote.version < local.version {
        local
    } else if remote.author > local.author {
        remote
    } else {
        local
    }
}

fn merge_peer_updates(
    current: VersionedValue,
    updates: Vec<VersionedValue>,
) -> VersionedValue {
    updates.into_iter().fold(current, pick_newer)
}

fn main() {
    let current = VersionedValue {
        version: 3,
        author: "peer-a",
        value: String::from("allow-read"),
    };

    let merged = merge_peer_updates(
        current,
        vec![
            VersionedValue {
                version: 4,
                author: "peer-b",
                value: String::from("allow-write"),
            },
            VersionedValue {
                version: 4,
                author: "peer-c",
                value: String::from("allow-write+audit"),
            },
        ],
    );

    println!("version = {}", merged.version);
    println!("author = {}", merged.author);
    println!("value = {}", merged.value);
}
