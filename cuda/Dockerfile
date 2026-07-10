# Real CUDA-from-Rust runner for Chapter 37.
#
# Small CUDA *base* image + just the NVRTC package (cudarc compiles the kernel at
# run time with NVRTC). The CUDA driver (libcuda) is injected by the NVIDIA
# Container Toolkit when the container starts with GPU access (docker-compose.yml).
FROM nvidia/cuda:12.6.2-base-ubuntu22.04

ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates pkg-config gcc libc6-dev cuda-nvrtc-12-6 \
 && rm -rf /var/lib/apt/lists/*

ENV RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo PATH=/usr/local/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal

WORKDIR /work
# Cache the cudarc dependency build with stub binaries first.
COPY Cargo.toml ./Cargo.toml
RUN mkdir -p src/bin \
 && printf 'fn main(){}\n' > src/bin/matmul_solution.rs \
 && printf 'fn main(){}\n' > src/bin/matmul_challenge.rs \
 && cargo build --release \
 && rm -rf src

# Build the real binaries. `touch` defeats the Docker/cargo stale-mtime trap:
# COPY preserves the host mtime, which can be older than the stub build, so cargo
# would otherwise think the stubs are still current and skip the rebuild.
COPY src ./src
RUN touch src/bin/*.rs && cargo build --release

COPY run-cuda.sh /usr/local/bin/run-cuda
RUN sed -i 's/\r$//' /usr/local/bin/run-cuda && chmod +x /usr/local/bin/run-cuda

ENTRYPOINT ["run-cuda"]
CMD ["matmul_solution"]
