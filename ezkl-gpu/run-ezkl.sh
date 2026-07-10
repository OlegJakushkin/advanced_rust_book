#!/usr/bin/env bash
# Chapter 53 — GPU-aware zkML end to end:
#   1) run the model's inference on the GPU (ONNX Runtime CUDA EP)
#   2) generate and verify a real zero-knowledge proof of that model (EZKL)
set -e
cd /work

echo "===== 1) GPU inference (ONNX Runtime CUDA execution provider) ====="
python3 gen_infer.py

echo
echo "===== 2) Real zero-knowledge proof of the model (EZKL) ====="
ezkl gen-settings -M model.onnx -O settings.json
ezkl calibrate-settings -M model.onnx -D input.json --target resources
ezkl compile-circuit -M model.onnx --compiled-circuit model.ezkl -S settings.json
ezkl get-srs -S settings.json
ezkl setup -M model.ezkl --vk-path vk.key --pk-path pk.key
ezkl gen-witness -M model.ezkl -D input.json -O witness.json
ezkl prove --witness witness.json -M model.ezkl --pk-path pk.key --proof-path proof.json
ezkl verify --proof-path proof.json -S settings.json --vk-path vk.key

echo
echo "===== zkML complete: GPU ran the inference, EZKL proved it ====="
echo "proof = $(wc -c < proof.json) bytes  (verified above: 'verified: true')"
