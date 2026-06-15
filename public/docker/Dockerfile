# Toolchain image for building and running any file in the Advanced Rust corpus.
# Uses a current stable Rust (edition 2021 and 2024 both available) plus a
# nightly toolchain for the handful of examples that opt into unstable features.
FROM rust:1-slim-bookworm

# ca-certificates lets cargo fetch crates; the rest is kept minimal.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN rustup toolchain install nightly --profile minimal || true

# Pre-build the runner's dependency set so `cargo run` is fast at runtime.
WORKDIR /runner
COPY runner-Cargo.toml ./Cargo.toml
RUN mkdir -p src \
 && printf 'fn main() {}\n' > src/main.rs \
 && cargo build --release \
 && rm -f src/main.rs

# Install the runner script (normalise CRLF in case it was checked out on Windows).
COPY run.sh /usr/local/bin/run-book
RUN sed -i 's/\r$//' /usr/local/bin/run-book && chmod +x /usr/local/bin/run-book

WORKDIR /work
ENTRYPOINT ["run-book"]
CMD ["--help"]
