# Real GPU-aware zkML for Chapter 53: ONNX Runtime GPU inference + a genuine
# EZKL zero-knowledge proof of the model. CUDA + cuDNN base so the CUDA EP works.
FROM nvidia/cuda:12.6.2-cudnn-runtime-ubuntu22.04

ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir "numpy<2" onnx onnxruntime-gpu==1.22.0

# Install the real EZKL prover CLI (latest linux release).
RUN url="$(curl -sSL https://api.github.com/repos/zkonduit/ezkl/releases/latest | grep -o 'https://[^"]*linux-gnu[^"]*tar.gz' | head -1)" \
 && echo "ezkl asset: $url" \
 && curl -sSL "$url" -o /tmp/ezkl.tgz \
 && tar -xzf /tmp/ezkl.tgz -C /usr/local/bin ezkl \
 && chmod +x /usr/local/bin/ezkl && rm /tmp/ezkl.tgz \
 && ezkl --version

WORKDIR /work
COPY gen_infer.py run-ezkl.sh ./
RUN sed -i 's/\r$//' run-ezkl.sh && chmod +x run-ezkl.sh

ENTRYPOINT ["bash", "/work/run-ezkl.sh"]
