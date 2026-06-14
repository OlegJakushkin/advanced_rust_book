use anyhow::{Context, Result};
use std::io::{self, ErrorKind};

async fn read_artifact(name: &'static str) -> Result<&'static str> {
    match name {
        "manifest" => Ok("ready"),
        _ => Err(io::Error::new(ErrorKind::NotFound, "missing blob").into()),
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let manifest = tokio::spawn(async {
        read_artifact("manifest")
            .await
            .context("loading manifest")
    })
    .await
    .context("manifest task failed")??;

    let failed = read_artifact("lockfile")
        .await
        .context("loading lockfile")
        .err()
        .map(|err| format!("{:#}", err))
        .unwrap_or_else(|| String::from("none"));

    println!("manifest = {}", manifest);
    println!("failed = {}", failed);

    Ok(())
}
