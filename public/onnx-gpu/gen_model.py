"""Generate a small but compute-heavy MLP as model.onnx (no training needed).

Four Gemm layers with ReLU between them, fixed batch — enough matmul FLOPs that a
GPU clearly beats the CPU. Weights are random but seeded, so the model (and the
CPU-vs-GPU comparison) is reproducible.
"""
import numpy as np
import onnx
from onnx import helper, numpy_helper, TensorProto

np.random.seed(0)
BATCH, DIN, H, DOUT = 128, 1024, 4096, 10
dims = [DIN, H, H, H, DOUT]

nodes, inits = [], []
prev = "input"
for i in range(len(dims) - 1):
    a, b = dims[i], dims[i + 1]
    w = (np.random.randn(a, b).astype(np.float32) * (1.0 / np.sqrt(a)))
    bias = np.zeros(b, dtype=np.float32)
    inits.append(numpy_helper.from_array(w, f"W{i}"))
    inits.append(numpy_helper.from_array(bias, f"B{i}"))
    gemm_out = f"gemm{i}"
    nodes.append(helper.make_node("Gemm", [prev, f"W{i}", f"B{i}"], [gemm_out], name=f"gemm{i}"))
    if i < len(dims) - 2:
        relu_out = f"relu{i}"
        nodes.append(helper.make_node("Relu", [gemm_out], [relu_out], name=f"relu{i}"))
        prev = relu_out
    else:
        prev = gemm_out

graph = helper.make_graph(
    nodes, "mlp",
    [helper.make_tensor_value_info("input", TensorProto.FLOAT, [BATCH, DIN])],
    [helper.make_tensor_value_info(prev, TensorProto.FLOAT, [BATCH, DOUT])],
    initializer=inits,
)
model = helper.make_model(graph, opset_imports=[helper.make_operatorsetid("", 13)])
model.ir_version = 9  # compatible with onnxruntime 1.18-1.20
onnx.checker.check_model(model)
onnx.save(model, "model.onnx")
print(f"wrote model.onnx  (batch={BATCH}, {DIN}->{H}->{H}->{H}->{DOUT}, output='{prev}')")
