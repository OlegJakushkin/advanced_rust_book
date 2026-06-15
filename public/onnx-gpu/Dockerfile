# Real ONNX-on-GPU runner for Chapter 54.
# CUDA + cuDNN base (ONNX Runtime's CUDA EP needs both). Python builds the model;
# onnxruntime-gpu provides the CUDA-enabled ONNX Runtime shared library that the
# Rust `ort` crate loads dynamically.
FROM nvidia/cuda:12.6.2-cudnn-runtime-ubuntu22.04

ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates pkg-config gcc libc6-dev python3 python3-pip \
 && rm -rf /var/lib/apt/lists/*

# numpy+onnx build the model; onnxruntime-gpu (no-deps) supplies the CUDA-enabled
# ONNX Runtime lib and reuses the image's system cuDNN/cuBLAS rather than pulling
# its own multi-GB CUDA wheels.
RUN pip3 install --no-cache-dir "numpy<2" onnx==1.16.2 \
 && pip3 install --no-cache-dir --no-deps onnxruntime-gpu==1.22.0

# Point the ort crate at the CUDA-enabled ONNX Runtime that ships with onnxruntime-gpu.
RUN ort_so="$(find / -name 'libonnxruntime.so*' -path '*onnxruntime*' 2>/dev/null | head -1)" \
 && echo "ORT lib: $ort_so" \
 && ln -sf "$ort_so" /usr/local/lib/libonnxruntime.so \
 && ldconfig
ENV ORT_DYLIB_PATH=/usr/local/lib/libonnxruntime.so

ENV RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo PATH=/usr/local/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal

WORKDIR /work
COPY Cargo.toml ./Cargo.toml
RUN mkdir -p src && printf 'fn main(){}\n' > src/main.rs && cargo build --release ; rm -rf src

COPY gen_model.py ./gen_model.py
RUN python3 gen_model.py

COPY src ./src
RUN touch src/*.rs && cargo build --release

ENTRYPOINT ["/work/target/release/onnx_infer"]
